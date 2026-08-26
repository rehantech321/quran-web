import { Schema, Types, model } from "mongoose";

import { LEDGER_SOURCES, type LedgerSource } from "@halaqat/shared";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

/**
 * The single source of truth for all points — see SPEC.md §5. No controller may
 * ever write Student.totalPoints directly; everything flows through
 * points.service.ts, which writes here inside the same transaction as the
 * source record. The ledger is append-only: edits write a reversal entry
 * rather than mutating history.
 */
export interface PointsLedgerFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  source: LedgerSource;
  sourceRefId: Types.ObjectId;
  points: number;
  /** i18n key, e.g. "ledger.attendance.late" — rendered client-side with reasonParams. */
  reason: string;
  reasonParams?: Record<string, unknown>;
  occurredAt: Date;
  createdBy?: Types.ObjectId;
  reversedAt?: Date;
  reversalOfId?: Types.ObjectId;
}

const pointsLedgerSchema = new Schema<PointsLedgerFields>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  source: { type: String, enum: LEDGER_SOURCES, required: true },
  sourceRefId: { type: Schema.Types.ObjectId, required: true },
  points: { type: Number, required: true },
  reason: { type: String, required: true },
  reasonParams: { type: Schema.Types.Mixed },
  occurredAt: { type: Date, required: true, default: () => new Date() },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  reversedAt: { type: Date },
  reversalOfId: { type: Schema.Types.ObjectId, ref: "PointsLedger" },
});

pointsLedgerSchema.plugin(orgScopedPlugin);
pointsLedgerSchema.index({ studentId: 1, occurredAt: -1 });
pointsLedgerSchema.index({ source: 1, sourceRefId: 1 });

export const PointsLedger = model<PointsLedgerFields>("PointsLedger", pointsLedgerSchema);
