import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/apiClient";
import { useStudentAuthStore, type StudentSession } from "@/store/studentAuthStore";

type ResolveResponse =
  { pinRequired: true } | { pinRequired: false; token: string; student: StudentSession };

export function useResolveStudentAccess(slug: string | undefined) {
  return useQuery({
    queryKey: ["student-access", slug],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ResolveResponse }>(
        `/student-access/${slug}`,
      );
      return res.data.data;
    },
    enabled: Boolean(slug),
    retry: false,
  });
}

export function useVerifyStudentPin(slug: string) {
  const setStudentAuth = useStudentAuthStore((s) => s.setStudentAuth);
  return useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiClient.post<{
        data: { token: string; student: StudentSession };
      }>(`/student-access/${slug}/verify-pin`, { pin });
      return res.data.data;
    },
    onSuccess: (data) => setStudentAuth(data.token, data.student),
  });
}
