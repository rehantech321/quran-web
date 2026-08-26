import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Role } from "@halaqat/shared";

export interface StaffUser {
  id: string;
  organizationId: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
}

interface AuthState {
  accessToken: string | null;
  user: StaffUser | null;
  setAuth: (accessToken: string, user: StaffUser) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

/**
 * The access token is short-lived (15m default) and only ever obtained via
 * login or /auth/refresh (which reads the httpOnly refresh cookie) — it's
 * fine to persist to localStorage since a stolen value expires quickly, and
 * this keeps a supervisor logged in across a page reload without an extra
 * round trip. The refresh cookie itself is never touched here.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ accessToken: null, user: null }),
    }),
    { name: "halaqat_staff_auth" },
  ),
);
