import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const staffToken = useAuthStore.getState().accessToken;
  const studentToken = useStudentAuthStore.getState().token;
  // Both tokens live in localStorage, which is shared across every tab of
  // this origin — a staff member who's logged in and then opens a student's
  // own link (e.g. previewing their QR code) in the same browser ends up
  // with *both* tokens present at once, not "mutually exclusive" as assumed
  // here previously. Blindly preferring the staff token meant every
  // student-dashboard request after that got silently sent with the staff
  // token instead — which `requireStudentAuth` rejects outright (it's
  // signed with a different secret), breaking the student page entirely for
  // any staff member who still had an active session. Which identity is
  // "active" is determined by which app is currently on screen, not by
  // which session happens to exist in storage.
  const isStudentApp = window.location.pathname.startsWith("/student");
  const token = isStudentApp
    ? (studentToken ?? staffToken)
    : (staffToken ?? studentToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshStaffAccessToken(): Promise<string | null> {
  refreshPromise ??= axios
    .post(
      `${import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((res) => res.data.data.accessToken as string)
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const staffToken = useAuthStore.getState().accessToken;
    // Was *this specific request* actually sent with the staff token? Not
    // just "does a staff token currently exist" — with both tokens possibly
    // present at once (see the request interceptor above), a failed
    // student-app request shouldn't trigger a staff-session refresh just
    // because a staff session also happens to exist in this browser.
    const wasStaffRequest =
      Boolean(staffToken) && original?.headers?.Authorization === `Bearer ${staffToken}`;

    if (
      error.response?.status === 401 &&
      wasStaffRequest &&
      original &&
      !original._retried
    ) {
      original._retried = true;
      const newToken = await refreshStaffAccessToken();
      if (newToken) {
        useAuthStore.getState().setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(original);
      }
      useAuthStore.getState().clearAuth();
    }

    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return fallback;
}

/**
 * True when this wasn't really a rejection from *our* API at all: either the
 * request never got any response (dropped connection, timeout), or it got a
 * response that isn't our API's `{success:false, error:{...}}` shape — which
 * means something between the phone and our server intercepted it (a weak
 * mobile connection commonly gets a carrier-injected error/interstitial page
 * instead of ever reaching Nginx). Both cases are worth a distinct "your
 * connection is the problem" message instead of a generic app error, and
 * both are worth an automatic retry since the payload itself was never the
 * issue.
 */
export function isConnectionProblem(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  const body = error.response.data as ApiErrorBody | undefined;
  return !(body?.success === false && body.error?.message);
}
