import { z } from "zod";

import { ATTENDANCE_STATUSES } from "../constants.js";
import { objectIdSchema } from "./common.js";

export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);

export const scanAttendanceSchema = z.object({
  barcodeValue: z.string().min(1),
  circleId: objectIdSchema,
});
export type ScanAttendanceInput = z.infer<typeof scanAttendanceSchema>;

export const manualAttendanceSchema = z.object({
  studentId: objectIdSchema,
  sessionDate: z.coerce.date(),
  status: attendanceStatusSchema,
  note: z.string().max(500).optional(),
});
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;

export const updateAttendanceSchema = z.object({
  status: attendanceStatusSchema,
  note: z.string().max(500).optional(),
});
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

export const closeSessionSchema = z.object({
  circleId: objectIdSchema,
  sessionDate: z.coerce.date(),
});
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

export const attendanceQuerySchema = z.object({
  circleId: objectIdSchema,
  date: z.coerce.date(),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;
