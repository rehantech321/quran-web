export const ROLES = ["super_admin", "admin", "supervisor"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_AND_STUDENT_ROLES = [...ROLES, "student"] as const;
export type AnyRole = (typeof STAFF_AND_STUDENT_ROLES)[number];

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_METHODS = ["scan", "manual"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const TASK_ASSIGNMENT_TYPES = ["circle", "students"] as const;
export type TaskAssignmentType = (typeof TASK_ASSIGNMENT_TYPES)[number];

export const SUBMISSION_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const LEDGER_SOURCES = [
  "attendance",
  "grade",
  "question",
  "task",
  "manual",
] as const;
export type LedgerSource = (typeof LEDGER_SOURCES)[number];

export const GRADE_TO_POINTS_MODES = ["manual", "percentage"] as const;
export type GradeToPointsMode = (typeof GRADE_TO_POINTS_MODES)[number];

export const LEADERBOARD_PERIODS = ["week", "month", "term", "all"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

/** Default per-organization points configuration (§4 Organization.pointsConfig). */
export const DEFAULT_POINTS_CONFIG = {
  attendancePresent: 10,
  attendanceLate: -5,
  attendanceAbsent: -10,
  attendanceExcused: 0,
  defaultQuestionPoints: 20,
  gradeToPointsMode: "manual" as GradeToPointsMode,
};

export const DEFAULT_SESSION_DEFAULTS = {
  startTime: "19:45",
  lateAfter: "20:15",
};

export const DEFAULT_TIMEZONE = "Asia/Riyadh";

export const DEFAULT_THEME = {
  primary: "#0B3B2E",
  accent: "#C8A24A",
  sage: "#7FB98A",
};

/** nanoid alphabet for student access slugs — excludes ambiguous chars 0/O/1/l/I. */
export const STUDENT_SLUG_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
export const STUDENT_SLUG_LENGTH = 12;
