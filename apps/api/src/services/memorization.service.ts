import type { Types } from "mongoose";

import { QURAN_SURAH_BY_NUMBER, type AyahRangeInput } from "@halaqat/shared";

import { NotFoundError, ValidationError } from "../errors.js";
import { MemorizationLog, type AyahRangeFields } from "../models/MemorizationLog.js";
import { Student } from "../models/Student.js";

function resolveAyahRange(input: AyahRangeInput): AyahRangeFields {
  const surah = QURAN_SURAH_BY_NUMBER.get(input.surahNumber);
  // Already checked by recordMemorizationSchema's refine, but services never
  // trust that validation ran upstream of every caller (SPEC.md's "every
  // domain service re-checks its own invariants" rule) — this is the one
  // place that actually writes `surahName` into the document.
  if (!surah) throw new ValidationError("This surah number is not valid");
  return {
    surahNumber: input.surahNumber,
    surahName: surah.nameAr,
    fromAyah: input.fromAyah,
    toAyah: input.toAyah,
    evaluation: input.evaluation,
  };
}

export interface RecordMemorizationParams {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  date?: Date;
  newMemorization?: AyahRangeInput;
  revision?: AyahRangeInput;
  recordedBy: Types.ObjectId;
}

/**
 * Records a student's daily new-memorization portion, their revision, or
 * both — purely a log, with no points-engine involvement (SPEC extension
 * request only asked for a record to be kept here; the separate "weekly
 * memorization points" shortcut is what actually awards points, via the
 * existing general manual-points endpoint).
 */
export async function recordMemorization(params: RecordMemorizationParams) {
  const student = await Student.findOne({
    _id: params.studentId,
    organizationId: params.organizationId,
    circleId: params.circleId,
    deletedAt: null,
  });
  if (!student) throw new NotFoundError("student");

  return MemorizationLog.create({
    organizationId: params.organizationId,
    circleId: params.circleId,
    studentId: params.studentId,
    date: params.date ?? new Date(),
    newMemorization: params.newMemorization
      ? resolveAyahRange(params.newMemorization)
      : undefined,
    revision: params.revision ? resolveAyahRange(params.revision) : undefined,
    recordedBy: params.recordedBy,
  });
}

export interface ListMemorizationFilter {
  studentId?: Types.ObjectId | string;
  circleId?: Types.ObjectId | string;
  /** Scopes to several circles at once — how a supervisor's "every circle I own" view reaches here when no single circleId/studentId was requested. */
  circleIds?: string[];
}

export async function listMemorization(
  organizationId: Types.ObjectId,
  filter: ListMemorizationFilter,
  pagination: { page: number; limit: number },
) {
  const query = {
    organizationId,
    deletedAt: null,
    ...(filter.studentId ? { studentId: filter.studentId } : {}),
    ...(filter.circleId
      ? { circleId: filter.circleId }
      : filter.circleIds
        ? { circleId: { $in: filter.circleIds } }
        : {}),
  };
  const skip = (pagination.page - 1) * pagination.limit;
  const [entries, total] = await Promise.all([
    MemorizationLog.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit),
    MemorizationLog.countDocuments(query),
  ]);
  return { entries, total, page: pagination.page, limit: pagination.limit };
}
