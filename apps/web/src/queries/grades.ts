import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/apiClient";
import type { CircleGrade } from "@/types/api";

export function useGrades(circleId: string | undefined) {
  return useQuery({
    queryKey: ["grades", circleId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CircleGrade[] }>("/grades", {
        params: { circleId },
      });
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

export interface CreateGradeInput {
  studentId: string;
  circleId: string;
  weekOf: string;
  grade: number;
  points?: number;
  notes?: string;
}

export function useCreateGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGradeInput) => {
      const res = await apiClient.post<{ data: CircleGrade }>("/grades", input);
      return res.data.data;
    },
    onSuccess: (grade) =>
      queryClient.invalidateQueries({ queryKey: ["grades", grade.circleId] }),
  });
}

export function useUpdateGrade(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      grade?: number;
      points?: number;
      notes?: string;
    }) => {
      const res = await apiClient.patch<{ data: CircleGrade }>(`/grades/${id}`, input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grades", circleId] }),
  });
}
