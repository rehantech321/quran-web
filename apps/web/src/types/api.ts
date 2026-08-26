// Loosely-typed API response shapes for the frontend — mirrors the Mongoose
// models but as plain JSON (string ids, ISO date strings) since that's what
// crosses the wire.

export interface Circle {
  _id: string;
  organizationId: string;
  name: string;
  supervisorId: string;
  description?: string;
  schedule: { days: number[]; startTime: string; lateAfter: string };
  pointsConfigOverride?: Partial<PointsConfig>;
  isActive: boolean;
}

export interface CircleWithStats extends Circle {
  studentCount: number;
  todayAttendance: { recorded: number; total: number };
}

export interface PointsConfig {
  attendancePresent: number;
  attendanceLate: number;
  attendanceAbsent: number;
  attendanceExcused: number;
  defaultQuestionPoints: number;
  gradeToPointsMode: "manual" | "percentage";
}

export interface PointsBreakdown {
  attendance: number;
  grades: number;
  questions: number;
  tasks: number;
  manual: number;
}

export interface Student {
  _id: string;
  organizationId: string;
  circleId: string;
  fullName: string;
  photoUrl?: string;
  parentPhone: string;
  studentPhone?: string;
  dateOfBirth?: string;
  level?: string;
  accessSlug: string;
  barcodeValue: string;
  totalPoints: number;
  pointsBreakdown: PointsBreakdown;
  isActive: boolean;
  notes?: string;
}

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface AttendanceRecord {
  _id: string;
  circleId: string;
  studentId: string;
  sessionDate: string;
  status: AttendanceStatus;
  checkInAt?: string;
  method: "scan" | "manual";
  pointsAwarded: number;
  note?: string;
}

export interface AttendanceRosterEntry {
  studentId: string;
  fullName: string;
  photoUrl?: string;
  status: AttendanceStatus | "not_recorded";
  checkInAt?: string;
  pointsAwarded?: number;
  attendanceRecordId?: string;
}

export interface CircleGrade {
  _id: string;
  circleId: string;
  studentId: string;
  weekOf: string;
  grade: number;
  pointsAwarded: number;
  notes?: string;
}

export interface QuestionOption {
  key: string;
  text: string;
}

export interface WeeklyQuestion {
  _id: string;
  circleId: string;
  weekOf: string;
  questionText: string;
  options: QuestionOption[];
  correctOptionKey?: string;
  points: number;
  explanation?: string;
  isPublished: boolean;
}

export interface QuestionAnswer {
  _id: string;
  questionId: string;
  studentId: string;
  selectedOptionKey: string;
  isCorrect: boolean;
  pointsAwarded: number;
  answeredAt: string;
}

export type TaskAssignmentType = "circle" | "students";
export type SubmissionStatus = "not_started" | "in_progress" | "completed";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface WeeklyTask {
  _id: string;
  circleId: string;
  title: string;
  description?: string;
  points: number;
  dueDate: string;
  assignedTo: TaskAssignmentType;
  studentIds?: string[];
  isPublished: boolean;
}

export interface TaskSubmission {
  _id: string;
  taskId: string;
  studentId: string;
  status: SubmissionStatus;
  studentNote?: string;
  attachmentUrl?: string;
  completedAt?: string;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  pointsAwarded: number;
}

export interface PointsLedgerEntry {
  _id: string;
  circleId: string;
  studentId: string;
  source: "attendance" | "grade" | "question" | "task" | "manual";
  points: number;
  reason: string;
  reasonParams?: Record<string, unknown>;
  occurredAt: string;
  reversedAt?: string;
}

export interface OrgTheme {
  primary: string;
  accent: string;
  sage: string;
}

export interface Organization {
  _id: string;
  name: string;
  nameEn?: string;
  slug: string;
  logoUrl?: string;
  theme: OrgTheme;
  tagline?: string;
  timezone: string;
  pointsConfig: PointsConfig;
  sessionDefaults: { startTime: string; lateAfter: string };
  requireStudentPin: boolean;
}

export interface StaffMember {
  id: string;
  organizationId: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: "super_admin" | "admin" | "supervisor";
  avatarUrl?: string;
  isActive: boolean;
}
