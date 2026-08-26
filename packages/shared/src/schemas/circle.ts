import { z } from "zod";

import { pointsConfigOverrideSchema } from "./organization.js";
import { objectIdSchema, timeOfDaySchema, weekdaySchema } from "./common.js";

export const circleScheduleSchema = z.object({
  days: z.array(weekdaySchema).min(1).max(7),
  startTime: timeOfDaySchema,
  lateAfter: timeOfDaySchema,
});
export type CircleSchedule = z.infer<typeof circleScheduleSchema>;

export const createCircleSchema = z.object({
  name: z.string().min(1).max(150),
  supervisorId: objectIdSchema,
  description: z.string().max(1000).optional(),
  schedule: circleScheduleSchema,
  pointsConfigOverride: pointsConfigOverrideSchema.optional(),
});
export type CreateCircleInput = z.infer<typeof createCircleSchema>;

export const updateCircleSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  supervisorId: objectIdSchema.optional(),
  description: z.string().max(1000).optional(),
  schedule: circleScheduleSchema.partial().optional(),
  pointsConfigOverride: pointsConfigOverrideSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCircleInput = z.infer<typeof updateCircleSchema>;

export const circleIdParamSchema = z.object({ id: objectIdSchema });
