import type { ApprovalStatus, SubmissionStatus } from "@/types/api";

/** Shared between the student's own task list and the staff task list, so a submission's status/color always reads the same way in both places. */
export function submissionTone(
  status: SubmissionStatus,
  approval?: ApprovalStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (approval === "approved") return "success";
  if (approval === "rejected") return "danger";
  if (status === "completed") return "info";
  if (status === "in_progress") return "warning";
  return "neutral";
}

export function submissionLabelKey(
  status: SubmissionStatus,
  approval?: ApprovalStatus,
): string {
  if (approval === "approved") return "tasks.approved";
  if (approval === "rejected") return "tasks.rejected";
  if (status === "completed") return "tasks.completedPending";
  if (status === "in_progress") return "tasks.inProgress";
  return "tasks.notStarted";
}
