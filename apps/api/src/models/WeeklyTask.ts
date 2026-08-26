import { Schema, Types, model } from "mongoose";

import { TASK_ASSIGNMENT_TYPES, type TaskAssignmentType } from "@halaqat/shared";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface WeeklyTaskFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  title: string;
  description?: string;
  points: number;
  dueDate: Date;
  assignedTo: TaskAssignmentType;
  studentIds?: Types.ObjectId[];
  createdBy: Types.ObjectId;
  isPublished: boolean;
  deletedAt: Date | null;
}

const weeklyTaskSchema = new Schema<WeeklyTaskFields>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  points: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  assignedTo: { type: String, enum: TASK_ASSIGNMENT_TYPES, required: true },
  studentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isPublished: { type: Boolean, default: false },
});

weeklyTaskSchema.plugin(orgScopedPlugin);
weeklyTaskSchema.index({ organizationId: 1, circleId: 1, dueDate: 1 });

export const WeeklyTask = model<WeeklyTaskFields>("WeeklyTask", weeklyTaskSchema);
