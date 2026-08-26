import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateUserInput } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type { StaffMember } from "@/types/api";

export function useStaff() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: StaffMember[] }>("/users");
      return res.data.data;
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const res = await apiClient.post<{ data: StaffMember }>("/users", input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      isActive?: boolean;
      fullName?: string;
    }) => {
      const res = await apiClient.patch<{ data: StaffMember }>(`/users/${id}`, input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
