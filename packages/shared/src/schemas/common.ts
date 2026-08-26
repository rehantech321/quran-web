import { z } from "zod";

/** 24-char hex Mongo ObjectId string — validate every id crossing the API boundary. */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "invalid_object_id");

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid_time_format");

/** 0=Sunday .. 6=Saturday */
export const weekdaySchema = z.number().int().min(0).max(6);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
