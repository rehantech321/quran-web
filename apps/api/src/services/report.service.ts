import type { Types } from "mongoose";

import type { LeaderboardPeriod } from "@halaqat/shared";

import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { CircleGrade } from "../models/CircleGrade.js";
import { PointsLedger } from "../models/PointsLedger.js";
import { QuestionAnswer } from "../models/QuestionAnswer.js";
import { Student } from "../models/Student.js";
import { TaskSubmission } from "../models/TaskSubmission.js";
import { toCsv } from "../utils/csv.js";
import { renderSimpleReportPdf } from "../utils/pdf.js";
import { getCircle } from "./circle.service.js";
import { getStudent } from "./student.service.js";

export interface ReportDateRange {
  from?: Date;
  to?: Date;
}

function dateRangeFilter(range: ReportDateRange, field: string) {
  if (!range.from && !range.to) return {};
  const clause: Record<string, Date> = {};
  if (range.from) clause.$gte = range.from;
  if (range.to) clause.$lte = range.to;
  return { [field]: clause };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export interface StudentReportRow {
  studentId: Types.ObjectId;
  fullName: string;
  attendanceRate: number | null;
  avgGrade: number | null;
  questionAccuracy: number | null;
  tasksCompleted: number;
  totalPoints: number;
}

/** Circle summary + per-student breakdown, optionally scoped to a date range. */
export async function getCircleReport(
  organizationId: string,
  circleId: string,
  range: ReportDateRange = {},
) {
  const circle = await getCircle(organizationId, circleId);
  const students = await Student.find({ organizationId, circleId, deletedAt: null })
    .sort({ fullName: 1 })
    .lean();
  const studentIds = students.map((s) => s._id);

  const [attendance, grades, answers, approvedSubmissions, ledgerEntries] =
    await Promise.all([
      AttendanceRecord.find({
        studentId: { $in: studentIds },
        ...dateRangeFilter(range, "sessionDate"),
      }).lean(),
      CircleGrade.find({
        studentId: { $in: studentIds },
        ...dateRangeFilter(range, "weekOf"),
      }).lean(),
      QuestionAnswer.find({
        studentId: { $in: studentIds },
        ...dateRangeFilter(range, "answeredAt"),
      }).lean(),
      TaskSubmission.find({
        studentId: { $in: studentIds },
        approvalStatus: "approved",
        ...dateRangeFilter(range, "approvedAt"),
      }).lean(),
      range.from || range.to
        ? PointsLedger.find({
            studentId: { $in: studentIds },
            ...dateRangeFilter(range, "occurredAt"),
          }).lean()
        : null,
    ]);

  const perStudent: StudentReportRow[] = students.map((student) => {
    const sid = String(student._id);
    const studentAttendance = attendance.filter((a) => String(a.studentId) === sid);
    const studentGrades = grades.filter((g) => String(g.studentId) === sid);
    const studentAnswers = answers.filter((a) => String(a.studentId) === sid);
    const studentTasksCompleted = approvedSubmissions.filter(
      (s) => String(s.studentId) === sid,
    ).length;
    const totalPoints = ledgerEntries
      ? ledgerEntries
          .filter((e) => String(e.studentId) === sid)
          .reduce((sum, e) => sum + e.points, 0)
      : student.totalPoints;

    return {
      studentId: student._id,
      fullName: student.fullName,
      attendanceRate: percentage(
        studentAttendance.filter((a) => a.status === "present" || a.status === "late")
          .length,
        studentAttendance.length,
      ),
      avgGrade: average(studentGrades.map((g) => g.grade)),
      questionAccuracy: percentage(
        studentAnswers.filter((a) => a.isCorrect).length,
        studentAnswers.length,
      ),
      tasksCompleted: studentTasksCompleted,
      totalPoints,
    };
  });

  return {
    circle: { id: circle._id, name: circle.name },
    range,
    summary: {
      studentCount: students.length,
      avgAttendanceRate: average(
        perStudent.map((p) => p.attendanceRate).filter((v): v is number => v !== null),
      ),
      avgGrade: average(
        perStudent.map((p) => p.avgGrade).filter((v): v is number => v !== null),
      ),
      avgQuestionAccuracy: average(
        perStudent.map((p) => p.questionAccuracy).filter((v): v is number => v !== null),
      ),
      totalTasksCompleted: perStudent.reduce((sum, p) => sum + p.tasksCompleted, 0),
      totalPoints: perStudent.reduce((sum, p) => sum + p.totalPoints, 0),
    },
    students: perStudent,
  };
}

/** A single student's full report: summary stats plus recent history in each category. */
export async function getStudentReport(organizationId: string, studentId: string) {
  const student = await getStudent(organizationId, studentId);

  const [attendance, grades, answers, taskSubmissions, recentLedgerEntries] =
    await Promise.all([
      AttendanceRecord.find({ studentId: student._id }).sort({ sessionDate: -1 }).lean(),
      CircleGrade.find({ studentId: student._id }).sort({ weekOf: -1 }).lean(),
      QuestionAnswer.find({ studentId: student._id }).sort({ answeredAt: -1 }).lean(),
      TaskSubmission.find({ studentId: student._id }).lean(),
      PointsLedger.find({ studentId: student._id })
        .sort({ occurredAt: -1 })
        .limit(20)
        .lean(),
    ]);

  return {
    student: {
      id: student._id,
      fullName: student.fullName,
      circleId: student.circleId,
      totalPoints: student.totalPoints,
      pointsBreakdown: student.pointsBreakdown,
    },
    stats: {
      attendanceRate: percentage(
        attendance.filter((a) => a.status === "present" || a.status === "late").length,
        attendance.length,
      ),
      avgGrade: average(grades.map((g) => g.grade)),
      questionAccuracy: percentage(
        answers.filter((a) => a.isCorrect).length,
        answers.length,
      ),
      tasksApproved: taskSubmissions.filter((s) => s.approvalStatus === "approved")
        .length,
      sessionsRecorded: attendance.length,
    },
    recentAttendance: attendance.slice(0, 10),
    recentGrades: grades.slice(0, 10),
    recentAnswers: answers.slice(0, 10),
    recentLedgerEntries,
  };
}

function periodStartDate(period: LeaderboardPeriod): Date {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  switch (period) {
    case "week":
      return new Date(now - 7 * DAY_MS);
    case "month":
      return new Date(now - 30 * DAY_MS);
    case "term":
      return new Date(now - 90 * DAY_MS);
    case "all":
      return new Date(0);
  }
}

export interface LeaderboardEntry {
  rank: number;
  studentId: Types.ObjectId;
  fullName: string;
  photoUrl?: string;
  circleId: Types.ObjectId;
  points: number;
}

const LEADERBOARD_LIMIT = 100;

export async function getLeaderboard(
  organizationId: string,
  filter: { circleId?: string; period: LeaderboardPeriod },
): Promise<LeaderboardEntry[]> {
  const studentFilter: Record<string, unknown> = {
    organizationId,
    isActive: true,
    deletedAt: null,
  };
  if (filter.circleId) studentFilter.circleId = filter.circleId;

  if (filter.period === "all") {
    const students = await Student.find(studentFilter)
      .sort({ totalPoints: -1 })
      .limit(LEADERBOARD_LIMIT)
      .lean();
    return students.map((s, i) => ({
      rank: i + 1,
      studentId: s._id,
      fullName: s.fullName,
      photoUrl: s.photoUrl,
      circleId: s.circleId,
      points: s.totalPoints,
    }));
  }

  const students = await Student.find(studentFilter).lean();
  const since = periodStartDate(filter.period);
  const sums = await PointsLedger.aggregate<{ _id: Types.ObjectId; total: number }>([
    {
      $match: {
        studentId: { $in: students.map((s) => s._id) },
        occurredAt: { $gte: since },
      },
    },
    { $group: { _id: "$studentId", total: { $sum: "$points" } } },
  ]);
  const totalByStudentId = new Map(sums.map((s) => [String(s._id), s.total]));

  return students
    .map((s) => ({
      studentId: s._id,
      fullName: s.fullName,
      photoUrl: s.photoUrl,
      circleId: s.circleId,
      points: totalByStudentId.get(String(s._id)) ?? 0,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, LEADERBOARD_LIMIT)
    .map((entry, i) => ({ rank: i + 1, ...entry }));
}

const CIRCLE_REPORT_COLUMNS = [
  { key: "fullName", header: "الاسم" },
  { key: "attendanceRate", header: "نسبة الحضور %" },
  { key: "avgGrade", header: "متوسط الدرجات" },
  { key: "questionAccuracy", header: "دقة الإجابات %" },
  { key: "tasksCompleted", header: "المهام المكتملة" },
  { key: "totalPoints", header: "مجموع النقاط" },
];

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export async function exportCircleReport(
  organizationId: string,
  circleId: string,
  format: "csv" | "pdf",
): Promise<ExportResult> {
  const report = await getCircleReport(organizationId, circleId, {});
  const rows = report.students.map((s) => ({ ...s, studentId: s.studentId.toString() }));

  if (format === "csv") {
    return {
      buffer: Buffer.from(toCsv(rows, CIRCLE_REPORT_COLUMNS), "utf-8"),
      contentType: "text/csv; charset=utf-8",
      filename: `circle-report-${circleId}.csv`,
    };
  }

  const buffer = await renderSimpleReportPdf({
    title: `Circle report: ${report.circle.name}`,
    subtitle: `${report.summary.studentCount} students · total points ${report.summary.totalPoints}`,
    columns: [
      { key: "fullName", header: "Name", width: 140 },
      { key: "attendanceRate", header: "Attendance %", width: 90 },
      { key: "avgGrade", header: "Avg grade", width: 80 },
      { key: "questionAccuracy", header: "Quiz %", width: 70 },
      { key: "tasksCompleted", header: "Tasks", width: 60 },
      { key: "totalPoints", header: "Points", width: 60 },
    ],
    rows,
  });
  return {
    buffer,
    contentType: "application/pdf",
    filename: `circle-report-${circleId}.pdf`,
  };
}

export async function exportStudentReport(
  organizationId: string,
  studentId: string,
  format: "csv" | "pdf",
): Promise<ExportResult> {
  const report = await getStudentReport(organizationId, studentId);
  const rows = report.recentLedgerEntries.map((e) => ({
    date: e.occurredAt.toISOString().slice(0, 10),
    source: e.source,
    reason: e.reason,
    points: e.points,
  }));
  const columns = [
    { key: "date", header: "Date" },
    { key: "source", header: "Source" },
    { key: "reason", header: "Reason" },
    { key: "points", header: "Points" },
  ];

  if (format === "csv") {
    return {
      buffer: Buffer.from(toCsv(rows, columns), "utf-8"),
      contentType: "text/csv; charset=utf-8",
      filename: `student-report-${studentId}.csv`,
    };
  }

  const buffer = await renderSimpleReportPdf({
    title: `Student report: ${report.student.fullName}`,
    subtitle: `Total points ${report.student.totalPoints} · attendance ${report.stats.attendanceRate ?? "-"}% · avg grade ${report.stats.avgGrade ?? "-"}`,
    columns: [
      { key: "date", header: "Date", width: 90 },
      { key: "source", header: "Source", width: 90 },
      { key: "reason", header: "Reason", width: 220 },
      { key: "points", header: "Points", width: 60 },
    ],
    rows,
  });
  return {
    buffer,
    contentType: "application/pdf",
    filename: `student-report-${studentId}.pdf`,
  };
}
