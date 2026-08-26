import { useMutation, useQuery } from "@tanstack/react-query";

import type { LoginInput } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import { useAuthStore, type StaffUser } from "@/store/authStore";

interface LoginResponse {
  accessToken: string;
  user: StaffUser;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiClient.post<{ data: LoginResponse }>("/auth/login", input);
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/auth/logout");
    },
    onSettled: () => {
      clearAuth();
    },
  });
}

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: StaffUser }>("/auth/me");
      return res.data.data;
    },
    enabled: Boolean(accessToken),
    retry: false,
  });
}
