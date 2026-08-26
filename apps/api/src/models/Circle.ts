import { Schema, Types, model } from "mongoose";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface CircleFields {
  organizationId: Types.ObjectId;
  name: string;
  supervisorId: Types.ObjectId;
  description?: string;
  schedule: {
    days: number[];
    startTime: string;
    lateAfter: string;
  };
  pointsConfigOverride?: {
    attendancePresent?: number;
    attendanceLate?: number;
    attendanceAbsent?: number;
    attendanceExcused?: number;
    defaultQuestionPoints?: number;
    gradeToPointsMode?: "manual" | "percentage";
  };
  isActive: boolean;
  deletedAt: Date | null;
}

const scheduleSchema = new Schema(
  {
    days: { type: [Number], required: true },
    startTime: { type: String, required: true },
    lateAfter: { type: String, required: true },
  },
  { _id: false },
);

const pointsConfigOverrideSchema = new Schema(
  {
    attendancePresent: { type: Number },
    attendanceLate: { type: Number },
    attendanceAbsent: { type: Number },
    attendanceExcused: { type: Number },
    defaultQuestionPoints: { type: Number },
    gradeToPointsMode: { type: String, enum: ["manual", "percentage"] },
  },
  { _id: false },
);

const circleSchema = new Schema<CircleFields>({
  name: { type: String, required: true, trim: true },
  supervisorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, trim: true },
  schedule: { type: scheduleSchema, required: true },
  pointsConfigOverride: { type: pointsConfigOverrideSchema },
  isActive: { type: Boolean, default: true },
});

circleSchema.plugin(orgScopedPlugin);
circleSchema.index({ organizationId: 1, supervisorId: 1 });

export const Circle = model<CircleFields>("Circle", circleSchema);
