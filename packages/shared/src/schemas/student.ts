import { z } from "zod";

import { objectIdSchema } from "./common.js";

export const createStudentSchema = z.object({
  circleId: objectIdSchema,
  fullName: z.string().min(1).max(150),
  photoUrl: z.string().url().optional(),
  parentPhone: z.string().min(6).max(30),
  studentPhone: z.string().min(6).max(30).optional(),
  dateOfBirth: z.coerce.date().optional(),
  level: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  circleId: objectIdSchema.optional(),
  fullName: z.string().min(1).max(150).optional(),
  photoUrl: z.string().url().optional(),
  parentPhone: z.string().min(6).max(30).optional(),
  studentPhone: z.string().min(6).max(30).optional(),
  dateOfBirth: z.coerce.date().optional(),
  level: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const studentIdParamSchema = z.object({ id: objectIdSchema });
export const studentSlugParamSchema = z.object({ slug: z.string().min(6).max(32) });

export const pointsBreakdownSchema = z.object({
  attendance: z.number(),
  grades: z.number(),
  questions: z.number(),
  tasks: z.number(),
  manual: z.number(),
});
export type PointsBreakdown = z.infer<typeof pointsBreakdownSchema>;
