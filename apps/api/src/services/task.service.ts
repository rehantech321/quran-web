import mongoose, { Types } from "mongoose";

import type { SubmissionStatus } from "@halaqat/shared";

import { ConflictError, NotFoundError } from "../errors.js";
import { TaskSubmission } from "../models/TaskSubmission.js";
import { WeeklyTask } from "../models/WeeklyTask.js";
import { awardPoints, reverseEntriesForSource } from "./points.service.js";

export interface UpdateSubmissionStatusParams {
  organizationId: Types.ObjectId;
  taskId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: SubmissionStatus;
  studentNote?: string;
  attachmentUrl?: string;
}

/** Student-driven: moves a submission through not_started -> in_progress -> completed. Never touches points. */
export async function updateSubmissionStatus(params: UpdateSubmissionStatusParams) {
  const task = await WeeklyTask.findOne({
    _id: params.taskId,
    organizationId: params.organizationId,
  }).lean();
  if (!task) throw new NotFoundError("task");

  let submission = await TaskSubmission.findOne({
    taskId: params.taskId,
    studentId: params.studentId,
  });
  if (!submission) {
    submission = new TaskSubmission({
      organizationId: params.organizationId,
      taskId: params.taskId,
      studentId: params.studentId,
    });
  }

  submission.status = params.status;
  if (params.studentNote !== undefined) submission.studentNote = params.studentNote;
  if (params.attachmentUrl !== undefined) submission.attachmentUrl = params.attachmentUrl;
  if (params.status === "completed" && !submission.completedAt) {
    submission.completedAt = new Date();
  }

  await submission.save();
  return submission;
}

export interface ApproveSubmissionParams {
  submissionId: Types.ObjectId;
  approvedBy: Types.ObjectId;
}

/** Approves a submission and awards the task's points. Errors if already approved — reject first to re-approve. */
export async function approveSubmission(params: ApproveSubmissionParams) {
  const submission = await TaskSubmission.findById(params.submissionId);
  if (!submission) throw new NotFoundError("task_submission");
  if (submission.approvalStatus === "approved") {
    throw new ConflictError("task_submission_already_approved");
  }

  const task = await WeeklyTask.findById(submission.taskId).lean();
  if (!task) throw new NotFoundError("task");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      submission.approvalStatus = "approved";
      submission.approvedBy = params.approvedBy;
      submission.approvedAt = new Date();
      submission.rejectionReason = undefined;
      submission.pointsAwarded = task.points;
      await submission.save({ session });

      await awardPoints({
        organizationId: submission.organizationId,
        circleId: task.circleId,
        studentId: submission.studentId,
        source: "task",
        sourceRefId: submission._id,
        points: task.points,
        reason: "ledger.task.approved",
        createdBy: params.approvedBy,
        session,
      });
    });
    return submission;
  } finally {
    await session.endSession();
  }
}

export interface RejectSubmissionParams {
  submissionId: Types.ObjectId;
  rejectionReason: string;
  rejectedBy: Types.ObjectId;
}

/** Rejects a submission. If it was previously approved, reverses the awarded points first. */
export async function rejectSubmission(params: RejectSubmissionParams) {
  const submission = await TaskSubmission.findById(params.submissionId);
  if (!submission) throw new NotFoundError("task_submission");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (submission.approvalStatus === "approved") {
        await reverseEntriesForSource("task", submission._id, session);
      }
      submission.approvalStatus = "rejected";
      submission.rejectionReason = params.rejectionReason;
      submission.approvedBy = undefined;
      submission.approvedAt = undefined;
      submission.pointsAwarded = 0;
      await submission.save({ session });
    });
    return submission;
  } finally {
    await session.endSession();
  }
}
