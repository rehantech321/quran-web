import { Schema, Types, model } from "mongoose";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface CircleGradeFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  weekOf: Date;
  grade: number;
  pointsAwarded: number;
  notes?: string;
  recordedBy: Types.ObjectId;
  deletedAt: Date | null;
}

const circleGradeSchema = new Schema<CircleGradeFields>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  weekOf: { type: Date, required: true },
  grade: { type: Number, required: true, min: 0, max: 100 },
  pointsAwarded: { type: Number, required: true },
  notes: { type: String, trim: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

circleGradeSchema.plugin(orgScopedPlugin);

// One grade per student per week — see SPEC.md §4.
circleGradeSchema.index({ studentId: 1, weekOf: 1 }, { unique: true });
circleGradeSchema.index({ organizationId: 1, circleId: 1, weekOf: 1 });

export const CircleGrade = model<CircleGradeFields>("CircleGrade", circleGradeSchema);
