import { z } from "zod";

import { objectIdSchema } from "./common.js";

export const createGradeSchema = z.object({
  studentId: objectIdSchema,
  circleId: objectIdSchema,
  weekOf: z.coerce.date(),
  grade: z.number().min(0).max(100),
  points: z.number().int().optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateGradeInput = z.infer<typeof createGradeSchema>;

export const updateGradeSchema = z.object({
  grade: z.number().min(0).max(100).optional(),
  points: z.number().int().optional(),
  notes: z.string().max(1000).optional(),
});
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;

export const gradeQuerySchema = z.object({
  circleId: objectIdSchema.optional(),
  weekOf: z.coerce.date().optional(),
});
export type GradeQuery = z.infer<typeof gradeQuerySchema>;
