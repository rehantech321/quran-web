import { z } from "zod";

import { LEADERBOARD_PERIODS } from "../constants.js";
import { objectIdSchema } from "./common.js";

export const leaderboardQuerySchema = z.object({
  circleId: objectIdSchema.optional(),
  period: z.enum(LEADERBOARD_PERIODS).default("all"),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

/** "Champions of the Circles" home-screen widget: top student per circle. */
export const circleChampionsQuerySchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS).default("week"),
});
export type CircleChampionsQuery = z.infer<typeof circleChampionsQuerySchema>;

export const reportDateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ReportDateRangeQuery = z.infer<typeof reportDateRangeQuerySchema>;

export const reportExportQuerySchema = z.object({
  type: z.enum(["circle", "student"]),
  format: z.enum(["csv", "pdf"]),
  id: objectIdSchema,
});
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
