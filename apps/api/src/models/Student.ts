import bcrypt from "bcrypt";
import { Schema, Types, model, type HydratedDocument, type Model } from "mongoose";

import { orgScopedPlugin } from "./plugins/orgScoped.js";
import { generateStudentAccessSlug } from "../utils/slug.js";

const PIN_BCRYPT_COST = 12;

export interface PointsBreakdown {
  attendance: number;
  grades: number;
  questions: number;
  tasks: number;
  manual: number;
}

export interface StudentFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  fullName: string;
  photoUrl?: string;
  parentPhone: string;
  studentPhone?: string;
  dateOfBirth?: Date;
  level?: string;
  accessSlug: string;
  pin?: string;
  barcodeValue: string;
  totalPoints: number;
  pointsBreakdown: PointsBreakdown;
  isActive: boolean;
  notes?: string;
  deletedAt: Date | null;
}

export interface StudentMethods {
  comparePin(candidate: string): Promise<boolean>;
}

type StudentModel = Model<StudentFields, object, StudentMethods>;

const pointsBreakdownSchema = new Schema<PointsBreakdown>(
  {
    attendance: { type: Number, default: 0 },
    grades: { type: Number, default: 0 },
    questions: { type: Number, default: 0 },
    tasks: { type: Number, default: 0 },
    manual: { type: Number, default: 0 },
  },
  { _id: false },
);

const studentSchema = new Schema<StudentFields, StudentModel, StudentMethods>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  fullName: { type: String, required: true, trim: true },
  photoUrl: { type: String },
  parentPhone: { type: String, required: true, trim: true },
  studentPhone: { type: String, trim: true },
  dateOfBirth: { type: Date },
  level: { type: String, trim: true },
  accessSlug: {
    type: String,
    required: true,
    unique: true,
    default: generateStudentAccessSlug,
  },
  pin: { type: String, select: false },
  barcodeValue: { type: String, required: true, unique: true },
  totalPoints: { type: Number, default: 0 },
  pointsBreakdown: { type: pointsBreakdownSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
  notes: { type: String, trim: true },
});

studentSchema.plugin(orgScopedPlugin);
studentSchema.index({ organizationId: 1, circleId: 1 });

studentSchema.pre("validate", function (next) {
  if (!this.barcodeValue) {
    this.barcodeValue = this.accessSlug;
  }
  next();
});

studentSchema.methods.comparePin = function (candidate: string) {
  if (!this.pin) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.pin);
};

export async function hashStudentPin(plain: string): Promise<string> {
  return bcrypt.hash(plain, PIN_BCRYPT_COST);
}

export type StudentDocument = HydratedDocument<StudentFields, StudentMethods>;

export const Student = model<StudentFields, StudentModel>("Student", studentSchema);
