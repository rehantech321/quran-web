import mongoose, { Types } from "mongoose";

import type {
  ApprovalStatus,
  CreateTaskInput,
  SubmissionStatus,
  UpdateTaskInput,
} from "@halaqat/shared";

import { ConflictError, NotFoundError } from "../errors.js";
import { Student } from "../models/Student.js";
import { TaskSubmission } from "../models/TaskSubmission.js";
import { WeeklyTask, type WeeklyTaskFields } from "../models/WeeklyTask.js";
import { awardPoints, reverseEntriesForSource } from "./points.service.js";

export interface TaskStudentStatus {
  studentId: Types.ObjectId;
  fullName: string;
  photoUrl?: string;
  status: SubmissionStatus;
  approvalStatus: ApprovalStatus;
}

/**
 * Every task, each paired with which students have actually picked it up —
 * a `TaskSubmission` only exists once a student taps "start" or "complete"
 * on their own task list (`updateSubmissionStatus` creates it lazily), so
 * its mere presence here already means "this student selected this task,"
 * independent of whether it's been submitted for approval yet. Without
 * this, a supervisor could see a task existed but never who (if anyone) was
 * actually working on it until it showed up in the separate, narrower
 * pending-approvals queue.
 */
export async function listTasks(
  organizationId: Types.ObjectId,
  filter: { circleId?: string } = {},
): Promise<
  (WeeklyTaskFields & { _id: Types.ObjectId; submissions: TaskStudentStatus[] })[]
> {
  const tasks = await WeeklyTask.find({
    organizationId,
    deletedAt: null,
    ...(filter.circleId ? { circleId: filter.circleId } : {}),
  })
    .sort({ dueDate: -1, createdAt: -1 })
    .lean();

  const submissions = await TaskSubmission.find({
    organizationId,
    taskId: { $in: tasks.map((t) => t._id) },
  }).lean();
  const students = await Student.find({
    _id: { $in: submissions.map((s) => s.studentId) },
  })
    .select("fullName photoUrl")
    .lean();
  const studentById = new Map(students.map((s) => [String(s._id), s]));

  const submissionsByTaskId = new Map<string, TaskStudentStatus[]>();
  for (const submission of submissions) {
    const student = studentById.get(String(submission.studentId));
    if (!student) continue; // deleted/missing student — nothing useful to show
    const key = String(submission.taskId);
    const list = submissionsByTaskId.get(key) ?? [];
    list.push({
      studentId: submission.studentId,
      fullName: student.fullName,
      photoUrl: student.photoUrl,
      status: submission.status,
      approvalStatus: submission.approvalStatus,
    });
    submissionsByTaskId.set(key, list);
  }

  return tasks.map((task) => ({
    ...task,
    submissions: submissionsByTaskId.get(String(task._id)) ?? [],
  }));
}

export async function getTask(
  organizationId: Types.ObjectId,
  taskId: Types.ObjectId | string,
) {
  const task = await WeeklyTask.findOne({ _id: taskId, organizationId, deletedAt: null });
  if (!task) throw new NotFoundError("task");
  return task;
}

export async function createTask(
  organizationId: Types.ObjectId,
  createdBy: Types.ObjectId,
  input: CreateTaskInput,
) {
  return WeeklyTask.create({ organizationId, createdBy, ...input });
}

export async function updateTask(
  organizationId: Types.ObjectId,
  taskId: Types.ObjectId | string,
  updates: UpdateTaskInput,
) {
  const task = await getTask(organizationId, taskId);
  Object.assign(task, updates);
  await task.save();
  return task;
}

/**
 * Soft-deletes the task itself — never its submissions or the points they
 * already awarded. `PointsLedger`/`TaskSubmission` are append-only history
 * (SPEC.md §5.2); hiding a task from future listings and approval queues
 * must never touch what already happened under it.
 */
export async function deleteTask(
  organizationId: Types.ObjectId,
  taskId: Types.ObjectId | string,
) {
  const task = await getTask(organizationId, taskId);
  task.deletedAt = new Date();
  await task.save();
  return task;
}

/**
 * Student-scoped: every published task assigned to the student's circle (or
 * directly to them), each paired with their own submission if one exists, split
 * into active (anything not yet a final approval) vs. completed (approved).
 */
export async function getMyTasks(
  organizationId: Types.ObjectId,
  studentId: Types.ObjectId,
) {
  const student = await Student.findOne({
    _id: studentId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!student) throw new NotFoundError("student");

  const tasks = await WeeklyTask.find({
    organizationId,
    isPublished: true,
    deletedAt: null,
    $or: [
      { assignedTo: "circle", circleId: student.circleId },
      { assignedTo: "students", studentIds: studentId },
    ],
  })
    .sort({ dueDate: 1 })
    .lean();

  const submissions = await TaskSubmission.find({
    taskId: { $in: tasks.map((t) => t._id) },
    studentId,
  }).lean();
  const submissionByTaskId = new Map(submissions.map((s) => [String(s.taskId), s]));

  const items = tasks.map((task) => ({
    task,
    submission: submissionByTaskId.get(String(task._id)) ?? null,
  }));

  const isApproved = (item: (typeof items)[number]) =>
    item.submission?.approvalStatus === "approved";
  return {
    active: items.filter((item) => !isApproved(item)),
    completed: items.filter(isApproved),
  };
}

/** Supervisor queue: every submission awaiting approval, optionally scoped to one circle. */
export async function getPendingApprovals(
  organizationId: Types.ObjectId,
  filter: { circleId?: string; circleIds?: string[] } = {},
) {
  const tasks = await WeeklyTask.find({
    organizationId,
    deletedAt: null,
    ...(filter.circleId ? { circleId: filter.circleId } : {}),
    ...(filter.circleIds ? { circleId: { $in: filter.circleIds } } : {}),
  }).lean();
  const taskById = new Map(tasks.map((t) => [String(t._id), t]));

  const submissions = await TaskSubmission.find({
    organizationId,
    taskId: { $in: tasks.map((t) => t._id) },
    status: "completed",
    approvalStatus: "pending",
  })
    .sort({ completedAt: 1 })
    .lean();

  // The queue exists so a supervisor can go ask a specific student about
  // their submission before approving — without the student's own name
  // attached, the list is just a pile of task titles with no way to tell
  // who to ask.
  const students = await Student.find({
    _id: { $in: submissions.map((s) => s.studentId) },
  })
    .select("fullName photoUrl")
    .lean();
  const studentById = new Map(students.map((s) => [String(s._id), s]));

  return submissions.map((submission) => ({
    submission,
    task: taskById.get(String(submission.taskId)),
    student: studentById.get(String(submission.studentId)),
  }));
}

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

/**
 * Read-only lookup for callers (routes) that need to check supervisor ownership
 * of the task's circle *before* calling approveSubmission/rejectSubmission —
 * both of those mutate as soon as they're called, so the ownership check must
 * happen first, using this.
 */
export async function getSubmissionWithTask(
  organizationId: Types.ObjectId,
  submissionId: Types.ObjectId | string,
) {
  const submission = await TaskSubmission.findOne({ _id: submissionId, organizationId });
  if (!submission) throw new NotFoundError("task_submission");
  const task = await WeeklyTask.findOne({
    _id: submission.taskId,
    organizationId,
  }).lean();
  if (!task) throw new NotFoundError("task");
  return { submission, task };
}

export interface ApproveSubmissionParams {
  organizationId: Types.ObjectId;
  submissionId: Types.ObjectId;
  approvedBy: Types.ObjectId;
}

/** Approves a submission and awards the task's points. Errors if already approved — reject first to re-approve. */
export async function approveSubmission(params: ApproveSubmissionParams) {
  const submission = await TaskSubmission.findOne({
    _id: params.submissionId,
    organizationId: params.organizationId,
  });
  if (!submission) throw new NotFoundError("task_submission");
  if (submission.approvalStatus === "approved") {
    throw new ConflictError("This submission has already been approved");
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
  organizationId: Types.ObjectId;
  submissionId: Types.ObjectId;
  rejectionReason: string;
  rejectedBy: Types.ObjectId;
}

/** Rejects a submission. If it was previously approved, reverses the awarded points first. */
export async function rejectSubmission(params: RejectSubmissionParams) {
  const submission = await TaskSubmission.findOne({
    _id: params.submissionId,
    organizationId: params.organizationId,
  });
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
