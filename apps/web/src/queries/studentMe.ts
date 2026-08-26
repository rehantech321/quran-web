import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/apiClient";
import { useStudentAuthStore } from "@/store/studentAuthStore";
import type { MyStudentProfile, PointsLedgerEntry } from "@/types/api";

export function useMyProfile() {
  const token = useStudentAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["student", "me"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: MyStudentProfile }>("/students/me");
      return res.data.data;
    },
    enabled: Boolean(token),
  });
}

export function useMyPointsHistory(page = 1) {
  return useQuery({
    queryKey: ["student", "me", "points-history", page],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: {
          entries: PointsLedgerEntry[];
          total: number;
          page: number;
          limit: number;
        };
      }>("/students/me/points-history", { params: { page } });
      return res.data.data;
    },
  });
}
