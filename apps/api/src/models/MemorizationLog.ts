import { Schema, Types, model } from "mongoose";

import { MEMORIZATION_EVALUATIONS, type MemorizationEvaluation } from "@halaqat/shared";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface AyahRangeFields {
  surahNumber: number;
  surahName: string;
  fromAyah: number;
  toAyah: number;
  evaluation?: MemorizationEvaluation;
}

export interface MemorizationLogFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  date: Date;
  newMemorization?: AyahRangeFields;
  revision?: AyahRangeFields;
  recordedBy: Types.ObjectId;
  deletedAt: Date | null;
}

const ayahRangeSchema = new Schema<AyahRangeFields>(
  {
    surahNumber: { type: Number, required: true, min: 1, max: 114 },
    // Denormalized alongside surahNumber so a saved record's Surah name
    // still reads correctly even if QURAN_SURAHS content ever changes —
    // same reasoning as ledgerLabels.ts snapshotting a label at write time
    // rather than re-resolving it from a lookup table on every read.
    surahName: { type: String, required: true, trim: true },
    fromAyah: { type: Number, required: true, min: 1 },
    toAyah: { type: Number, required: true, min: 1 },
    evaluation: { type: String, enum: MEMORIZATION_EVALUATIONS },
  },
  { _id: false },
);

const memorizationLogSchema = new Schema<MemorizationLogFields>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  date: { type: Date, required: true },
  newMemorization: { type: ayahRangeSchema },
  revision: { type: ayahRangeSchema },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

memorizationLogSchema.plugin(orgScopedPlugin);
memorizationLogSchema.index({ organizationId: 1, studentId: 1, date: -1 });
memorizationLogSchema.index({ organizationId: 1, circleId: 1, date: -1 });

export const MemorizationLog = model<MemorizationLogFields>(
  "MemorizationLog",
  memorizationLogSchema,
);
