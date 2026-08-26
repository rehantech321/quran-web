import { Schema, Types, model } from "mongoose";

import {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  type AttendanceMethod,
  type AttendanceStatus,
} from "@halaqat/shared";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface AttendanceRecordFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  sessionDate: Date;
  status: AttendanceStatus;
  checkInAt?: Date;
  method: AttendanceMethod;
  pointsAwarded: number;
  recordedBy: Types.ObjectId;
  note?: string;
  deletedAt: Date | null;
}

const attendanceRecordSchema = new Schema<AttendanceRecordFields>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  sessionDate: { type: Date, required: true },
  status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  checkInAt: { type: Date },
  method: { type: String, enum: ATTENDANCE_METHODS, required: true },
  pointsAwarded: { type: Number, required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, trim: true },
});

attendanceRecordSchema.plugin(orgScopedPlugin);

// One attendance record per student per day — see SPEC.md §4.
attendanceRecordSchema.index({ studentId: 1, sessionDate: 1 }, { unique: true });
attendanceRecordSchema.index({ organizationId: 1, circleId: 1, sessionDate: 1 });

export const AttendanceRecord = model<AttendanceRecordFields>(
  "AttendanceRecord",
  attendanceRecordSchema,
);
