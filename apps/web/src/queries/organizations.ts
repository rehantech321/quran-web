import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UpdateOrganizationInput } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { Organization } from "@/types/api";

export function useOrganization() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  return useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Organization }>(
        `/organizations/${organizationId}`,
      );
      return res.data.data;
    },
    enabled: Boolean(organizationId),
  });
}

export function useUpdateOrganization() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      const res = await apiClient.patch<{ data: Organization }>(
        `/organizations/${organizationId}`,
        input,
      );
      return res.data.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId] }),
  });
}
