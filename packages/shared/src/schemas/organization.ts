import { z } from "zod";

import { GRADE_TO_POINTS_MODES } from "../constants.js";
import { timeOfDaySchema } from "./common.js";

export const pointsConfigSchema = z.object({
  attendancePresent: z.number().int(),
  attendanceLate: z.number().int(),
  attendanceAbsent: z.number().int(),
  attendanceExcused: z.number().int(),
  defaultQuestionPoints: z.number().int().min(0),
  gradeToPointsMode: z.enum(GRADE_TO_POINTS_MODES),
});
export type PointsConfig = z.infer<typeof pointsConfigSchema>;

export const pointsConfigOverrideSchema = pointsConfigSchema.partial();
export type PointsConfigOverride = z.infer<typeof pointsConfigOverrideSchema>;

export const sessionDefaultsSchema = z.object({
  startTime: timeOfDaySchema,
  lateAfter: timeOfDaySchema,
});
export type SessionDefaults = z.infer<typeof sessionDefaultsSchema>;

export const orgThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sage: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type OrgTheme = z.infer<typeof orgThemeSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug_must_be_kebab_case"),
  logoUrl: z.string().url().optional(),
  theme: orgThemeSchema.partial().optional(),
  tagline: z.string().max(300).optional(),
  timezone: z.string().min(1).default("Asia/Riyadh"),
  pointsConfig: pointsConfigSchema.partial().optional(),
  sessionDefaults: sessionDefaultsSchema.partial().optional(),
  requireStudentPin: z.boolean().default(false),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).optional(),
  logoUrl: z.string().url().optional(),
  theme: orgThemeSchema.partial().optional(),
  tagline: z.string().max(300).optional(),
  timezone: z.string().min(1).optional(),
  pointsConfig: pointsConfigSchema.partial().optional(),
  sessionDefaults: sessionDefaultsSchema.partial().optional(),
  requireStudentPin: z.boolean().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
