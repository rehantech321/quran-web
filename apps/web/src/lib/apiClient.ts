import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  // Staff and student sessions are mutually exclusive in this browser tab
  // (the app renders either the supervisor/admin UI or the student UI at a
  // time), so whichever token is present is the one to send.
  const staffToken = useAuthStore.getState().accessToken;
  const studentToken = useStudentAuthStore.getState().token;
  const token = staffToken ?? studentToken;
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
    const isStaffRequest = Boolean(useAuthStore.getState().accessToken);

    if (
      error.response?.status === 401 &&
      isStaffRequest &&
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

/** 409 — "this already exists / was already done" (e.g. a duplicate weekly grade). */
export function isConflictError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}
