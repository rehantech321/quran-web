import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/apiClient";
import type { AyahRange, MemorizationLogEntry } from "@/types/api";

export function useMemorizationHistory(circleId: string | undefined) {
  return useQuery({
    queryKey: ["memorization", circleId],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { entries: MemorizationLogEntry[]; total: number };
      }>("/memorization", { params: { circleId, limit: 100 } });
      return res.data.data.entries;
    },
    enabled: Boolean(circleId),
  });
}

export interface RecordMemorizationInput {
  studentId: string;
  circleId: string;
  date?: string;
  newMemorization?: Omit<AyahRange, "surahName">;
  revision?: Omit<AyahRange, "surahName">;
}

export function useRecordMemorization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordMemorizationInput) => {
      const res = await apiClient.post<{ data: MemorizationLogEntry }>(
        "/memorization",
        input,
      );
      return res.data.data;
    },
    onSuccess: (entry) =>
      queryClient.invalidateQueries({ queryKey: ["memorization", entry.circleId] }),
  });
}
