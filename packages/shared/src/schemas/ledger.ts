import { z } from "zod";

import { LEDGER_SOURCES } from "../constants.js";
import { objectIdSchema, paginationQuerySchema } from "./common.js";

export const ledgerSourceSchema = z.enum(LEDGER_SOURCES);

export const createManualLedgerEntrySchema = z.object({
  studentId: objectIdSchema,
  points: z.number().int(),
  reason: z.string().min(1).max(300),
});
export type CreateManualLedgerEntryInput = z.infer<typeof createManualLedgerEntrySchema>;

export const pointsHistoryQuerySchema = paginationQuerySchema;
export type PointsHistoryQuery = z.infer<typeof pointsHistoryQuerySchema>;
