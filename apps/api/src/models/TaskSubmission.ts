import { Schema, Types, model } from "mongoose";

import {
  APPROVAL_STATUSES,
  SUBMISSION_STATUSES,
  type ApprovalStatus,
  type SubmissionStatus,
} from "@halaqat/shared";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface TaskSubmissionFields {
  organizationId: Types.ObjectId;
  taskId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: SubmissionStatus;
  studentNote?: string;
  attachmentUrl?: string;
  completedAt?: Date;
  approvalStatus: ApprovalStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  pointsAwarded: number;
  deletedAt: Date | null;
}

const taskSubmissionSchema = new Schema<TaskSubmissionFields>({
  taskId: { type: Schema.Types.ObjectId, ref: "WeeklyTask", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  status: { type: String, enum: SUBMISSION_STATUSES, default: "not_started" },
  studentNote: { type: String, trim: true },
  attachmentUrl: { type: String },
  completedAt: { type: Date },
  approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: "pending" },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  rejectionReason: { type: String, trim: true },
  pointsAwarded: { type: Number, default: 0 },
});

taskSubmissionSchema.plugin(orgScopedPlugin);

// One submission per student per task — see SPEC.md §4.
taskSubmissionSchema.index({ taskId: 1, studentId: 1 }, { unique: true });

export const TaskSubmission = model<TaskSubmissionFields>(
  "TaskSubmission",
  taskSubmissionSchema,
);
