import { useQuery } from "@tanstack/react-query";

import type { LeaderboardPeriod } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type {
  AttendanceRecord,
  CircleGrade,
  PointsBreakdown,
  PointsLedgerEntry,
  QuestionAnswer,
} from "@/types/api";

export interface CircleReportRow {
  studentId: string;
  fullName: string;
  attendanceRate: number | null;
  avgGrade: number | null;
  questionAccuracy: number | null;
  tasksCompleted: number;
  totalPoints: number;
}

export interface CircleReport {
  circle: { id: string; name: string };
  summary: {
    studentCount: number;
    avgAttendanceRate: number | null;
    avgGrade: number | null;
    avgQuestionAccuracy: number | null;
    totalTasksCompleted: number;
    totalPoints: number;
  };
  students: CircleReportRow[];
}

export function useCircleReport(circleId: string | undefined) {
  return useQuery({
    queryKey: ["reports", "circle", circleId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CircleReport }>(
        `/reports/circle/${circleId}`,
      );
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

export interface StudentReport {
  student: {
    id: string;
    fullName: string;
    circleId: string;
    totalPoints: number;
    pointsBreakdown: PointsBreakdown;
  };
  stats: {
    attendanceRate: number | null;
    avgGrade: number | null;
    questionAccuracy: number | null;
    tasksApproved: number;
    sessionsRecorded: number;
  };
  recentAttendance: AttendanceRecord[];
  recentGrades: CircleGrade[];
  recentAnswers: QuestionAnswer[];
  recentLedgerEntries: PointsLedgerEntry[];
}

export function useStudentReport(studentId: string | undefined) {
  return useQuery({
    queryKey: ["reports", "student", studentId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: StudentReport }>(
        `/reports/student/${studentId}`,
      );
      return res.data.data;
    },
    enabled: Boolean(studentId),
  });
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  fullName: string;
  photoUrl?: string;
  circleId: string;
  points: number;
}

export function useLeaderboard(
  circleId: string | undefined,
  period: LeaderboardPeriod = "all",
) {
  return useQuery({
    queryKey: ["reports", "leaderboard", circleId ?? "all", period],
    queryFn: async () => {
      const res = await apiClient.get<{ data: LeaderboardEntry[] }>(
        "/reports/leaderboard",
        {
          params: { circleId, period },
        },
      );
      return res.data.data;
    },
  });
}

/**
 * The export endpoint requires staff auth, so it can't be a plain `<a href>`
 * (no way to attach an Authorization header to a browser navigation). Fetches
 * the file through the authenticated client and triggers a save via a
 * throwaway blob-URL anchor instead — call this from a button's onClick.
 */
export async function downloadReportExport(
  type: "circle" | "student",
  format: "csv" | "pdf",
  id: string,
): Promise<void> {
  const res = await apiClient.get<ArrayBuffer>("/reports/export", {
    params: { type, format, id },
    responseType: "arraybuffer",
  });
  const contentType = format === "csv" ? "text/csv;charset=utf-8" : "application/pdf";
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: contentType }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${type}-report-${id}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
