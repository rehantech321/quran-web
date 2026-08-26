import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AttendanceStatus } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type { AttendanceRecord, AttendanceRosterEntry, Student } from "@/types/api";

function todayIso(): string {
  return new Date().toISOString();
}

export function useAttendanceRoster(
  circleId: string | undefined,
  date: string = todayIso(),
) {
  return useQuery({
    queryKey: ["attendance", circleId, date.slice(0, 10)],
    queryFn: async () => {
      const res = await apiClient.get<{ data: AttendanceRosterEntry[] }>("/attendance", {
        params: { circleId, date },
      });
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

interface ScanResult {
  record: AttendanceRecord;
  student: Student;
  alreadyRecorded: boolean;
}

export function useScanAttendance(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (barcodeValue: string) => {
      const res = await apiClient.post<{ data: ScanResult }>("/attendance/scan", {
        circleId,
        barcodeValue,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", circleId] });
    },
  });
}

export function useManualAttendance(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentId: string;
      sessionDate: string;
      status: AttendanceStatus;
      note?: string;
    }) => {
      const res = await apiClient.post<{ data: AttendanceRecord }>("/attendance/manual", {
        circleId,
        ...input,
      });
      return res.data.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendance", circleId] }),
  });
}

export function useUpdateAttendance(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: AttendanceStatus;
      note?: string;
    }) => {
      const res = await apiClient.patch<{ data: AttendanceRecord }>(`/attendance/${id}`, {
        status,
        note,
      });
      return res.data.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendance", circleId] }),
  });
}

export function useCloseSession(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionDate?: string) => {
      const res = await apiClient.post<{ data: { markedAbsent: number } }>(
        "/attendance/close-session",
        {
          circleId,
          sessionDate: sessionDate ?? todayIso(),
        },
      );
      return res.data.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendance", circleId] }),
  });
}
