import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateCircleInput, UpdateCircleInput } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type { Circle, CircleWithStats } from "@/types/api";

export function useCircles() {
  return useQuery({
    queryKey: ["circles"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CircleWithStats[] }>("/circles");
      return res.data.data;
    },
  });
}

export function useCircle(circleId: string | undefined) {
  return useQuery({
    queryKey: ["circles", circleId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Circle }>(`/circles/${circleId}`);
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

export function useCreateCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCircleInput) => {
      const res = await apiClient.post<{ data: Circle }>("/circles", input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["circles"] }),
  });
}

export function useUpdateCircle(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCircleInput) => {
      const res = await apiClient.patch<{ data: Circle }>(`/circles/${circleId}`, input);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circles"] });
    },
  });
}

export function useDeleteCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (circleId: string) => {
      await apiClient.delete(`/circles/${circleId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["circles"] }),
  });
}
