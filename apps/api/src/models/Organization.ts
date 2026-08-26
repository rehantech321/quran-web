import { Schema, model, type InferSchemaType } from "mongoose";

import {
  DEFAULT_POINTS_CONFIG,
  DEFAULT_SESSION_DEFAULTS,
  DEFAULT_THEME,
  DEFAULT_TIMEZONE,
} from "@halaqat/shared";

const pointsConfigSchema = new Schema(
  {
    attendancePresent: { type: Number, default: DEFAULT_POINTS_CONFIG.attendancePresent },
    attendanceLate: { type: Number, default: DEFAULT_POINTS_CONFIG.attendanceLate },
    attendanceAbsent: { type: Number, default: DEFAULT_POINTS_CONFIG.attendanceAbsent },
    attendanceExcused: { type: Number, default: DEFAULT_POINTS_CONFIG.attendanceExcused },
    defaultQuestionPoints: {
      type: Number,
      default: DEFAULT_POINTS_CONFIG.defaultQuestionPoints,
    },
    gradeToPointsMode: {
      type: String,
      enum: ["manual", "percentage"],
      default: DEFAULT_POINTS_CONFIG.gradeToPointsMode,
    },
  },
  { _id: false },
);

const sessionDefaultsSchema = new Schema(
  {
    startTime: { type: String, default: DEFAULT_SESSION_DEFAULTS.startTime },
    lateAfter: { type: String, default: DEFAULT_SESSION_DEFAULTS.lateAfter },
  },
  { _id: false },
);

const themeSchema = new Schema(
  {
    primary: { type: String, default: DEFAULT_THEME.primary },
    accent: { type: String, default: DEFAULT_THEME.accent },
    sage: { type: String, default: DEFAULT_THEME.sage },
  },
  { _id: false },
);

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String },
    theme: { type: themeSchema, default: () => ({}) },
    tagline: { type: String, trim: true },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    pointsConfig: { type: pointsConfigSchema, default: () => ({}) },
    sessionDefaults: { type: sessionDefaultsSchema, default: () => ({}) },
    requireStudentPin: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema>;

export const Organization = model("Organization", organizationSchema);
