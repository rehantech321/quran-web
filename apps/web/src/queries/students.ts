import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type {
  CreateManualLedgerEntryInput,
  CreateStudentInput,
  UpdateStudentInput,
} from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type { PointsLedgerEntry, Student } from "@/types/api";

export function useStudentsByCircle(circleId: string | undefined) {
  return useQuery({
    queryKey: ["circles", circleId, "students"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Student[] }>(
        `/circles/${circleId}/students`,
      );
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

export function useStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: ["students", studentId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Student }>(`/students/${studentId}`);
      return res.data.data;
    },
    enabled: Boolean(studentId),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      const res = await apiClient.post<{ data: Student }>("/students", input);
      return res.data.data;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({
        queryKey: ["circles", student.circleId, "students"],
      });
    },
  });
}

export function useUpdateStudent(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateStudentInput) => {
      const res = await apiClient.patch<{ data: Student }>(
        `/students/${studentId}`,
        input,
      );
      return res.data.data;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["students", studentId] });
      queryClient.invalidateQueries({
        queryKey: ["circles", student.circleId, "students"],
      });
    },
  });
}

export function useUploadStudentPhoto(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("photo", file);
      const res = await apiClient.post<{ data: Student }>(
        `/students/${studentId}/photo`,
        form,
        // The default (no timeout) means a request stuck on a bad mobile
        // connection just hangs forever with no feedback. 60s gives real
        // headroom even on a genuinely bad connection uploading the now
        // browser-compressed (typically 100-300KB) photo — see
        // imageCompression.ts. Measured a compressed real-world-sized photo
        // landing right at the edge of a 30s budget under a severely
        // throttled (~20KB/s) connection; 60s isn't just a round number.
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 },
      );
      return res.data.data;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["students", studentId] });
      queryClient.invalidateQueries({
        queryKey: ["circles", student.circleId, "students"],
      });
    },
  });
}

export function useAddManualPoints(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateManualLedgerEntryInput, "studentId">) => {
      const res = await apiClient.post<{ data: Student }>(
        `/students/${studentId}/points`,
        input,
      );
      return res.data.data;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["students", studentId] });
      queryClient.invalidateQueries({
        queryKey: ["circles", student.circleId, "students"],
      });
      queryClient.invalidateQueries({
        queryKey: ["students", studentId, "points-history"],
      });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      await apiClient.delete(`/students/${studentId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["circles"] }),
  });
}

export function useRegenerateStudentSlug(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ data: Student }>(
        `/students/${studentId}/regenerate-slug`,
      );
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students", studentId] }),
  });
}

export function useStudentPointsHistory(studentId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ["students", studentId, "points-history", page],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: {
          entries: PointsLedgerEntry[];
          total: number;
          page: number;
          limit: number;
        };
      }>(`/students/${studentId}/points-history`, { params: { page } });
      return res.data.data;
    },
    enabled: Boolean(studentId),
  });
}

/**
 * The QR endpoint requires staff auth (it encodes the student's private-link
 * slug — the same secret that bootstraps their session — so it can't be
 * anonymously fetchable). A plain `<img src>` can't carry an Authorization
 * header, so this fetches the PNG through the authenticated client and hands
 * back a blob object URL instead.
 */
export function useStudentQrObjectUrl(studentId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!studentId) return;
    let objectUrl: string | undefined;
    let cancelled = false;

    apiClient
      .get<ArrayBuffer>(`/students/${studentId}/qr.png`, { responseType: "arraybuffer" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([res.data], { type: "image/png" }));
        setUrl(objectUrl);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentId]);

  return url;
}
