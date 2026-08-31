import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import type { LedgerSource, PointsConfig, PointsConfigOverride } from "@halaqat/shared";
import { DEFAULT_POINTS_CONFIG } from "@halaqat/shared";

import { PointsLedger } from "../models/PointsLedger.js";
import { Student, type PointsBreakdown } from "../models/Student.js";

/**
 * The points engine. SPEC.md §5: "No controller may ever write
 * Student.totalPoints directly" — every points-producing domain service
 * (attendance/grade/question/task) goes through `awardPoints` here, and every
 * edit that changes an already-awarded amount goes through
 * `reverseEntriesForSource` first. The ledger (PointsLedger) is append-only;
 * `Student.totalPoints`/`pointsBreakdown` are caches recomputed from it.
 */

const SOURCE_TO_BREAKDOWN_KEY: Record<LedgerSource, keyof PointsBreakdown> = {
  attendance: "attendance",
  grade: "grades",
  question: "questions",
  task: "tasks",
  manual: "manual",
};

export interface AwardPointsInput {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  source: LedgerSource;
  sourceRefId: Types.ObjectId;
  points: number;
  reason: string;
  reasonParams?: Record<string, unknown>;
  occurredAt?: Date;
  createdBy?: Types.ObjectId;
  session: ClientSession;
}

/** Appends a ledger entry and refreshes the student's cached totals. Must run inside a transaction. */
export async function awardPoints(input: AwardPointsInput) {
  const [entry] = await PointsLedger.create(
    [
      {
        organizationId: input.organizationId,
        circleId: input.circleId,
        studentId: input.studentId,
        source: input.source,
        sourceRefId: input.sourceRefId,
        points: input.points,
        reason: input.reason,
        reasonParams: input.reasonParams,
        occurredAt: input.occurredAt ?? new Date(),
        createdBy: input.createdBy,
      },
    ],
    { session: input.session },
  );

  await recomputeStudentPoints(input.studentId, input.session);
  return entry;
}

/**
 * Reverses every not-yet-reversed ledger entry tied to `source`/`sourceRefId`
 * by writing an equal-and-opposite entry for each and marking the originals
 * `reversedAt`. History is never mutated or deleted — see SPEC.md §5.2.
 */
export async function reverseEntriesForSource(
  source: LedgerSource,
  sourceRefId: Types.ObjectId,
  session: ClientSession,
  reason = "ledger.reversal",
) {
  const originals = await PointsLedger.find({
    source,
    sourceRefId,
    reversedAt: { $exists: false },
  }).session(session);

  for (const original of originals) {
    await PointsLedger.create(
      [
        {
          organizationId: original.organizationId,
          circleId: original.circleId,
          studentId: original.studentId,
          source: original.source,
          sourceRefId: original.sourceRefId,
          points: -original.points,
          reason,
          reasonParams: { originalReason: original.reason },
          occurredAt: new Date(),
          reversalOfId: original._id,
        },
      ],
      { session },
    );
    original.reversedAt = new Date();
    await original.save({ session });
  }

  if (originals.length > 0) {
    await recomputeStudentPoints(originals[0]!.studentId, session);
  }
}

/**
 * Rebuilds `Student.totalPoints`/`pointsBreakdown` from the ledger — the
 * source of truth. Safe to call standalone (no session) as the CLI recompute
 * script does, or inside a transaction as every ledger write does.
 */
export async function recomputeStudentPoints(
  studentId: Types.ObjectId,
  session?: ClientSession,
) {
  // Unlike `.find()`/`.create()`, `.aggregate()` does no schema-based
  // casting — a raw BSON comparison of a string against a stored ObjectId
  // never matches. Every route handler passes ids straight from a JWT
  // payload or `req.params` (plain strings, force-cast with `as never` to
  // satisfy this function's `Types.ObjectId` parameter type), so `studentId`
  // here is a string at runtime far more often than not. Without this
  // explicit re-cast, `$match` silently matched nothing and this function
  // wrote a totalPoints of 0 back over the real, already-correct total on
  // every single award — see DECISIONS.md.
  const objectId = new Types.ObjectId(studentId);
  const query = PointsLedger.aggregate<{ _id: LedgerSource; total: number }>([
    { $match: { studentId: objectId } },
    { $group: { _id: "$source", total: { $sum: "$points" } } },
  ]);
  if (session) query.session(session);
  const results = await query;

  const breakdown: PointsBreakdown = {
    attendance: 0,
    grades: 0,
    questions: 0,
    tasks: 0,
    manual: 0,
  };
  let totalPoints = 0;
  for (const row of results) {
    const key = SOURCE_TO_BREAKDOWN_KEY[row._id];
    breakdown[key] = row.total;
    totalPoints += row.total;
  }

  await Student.findByIdAndUpdate(
    studentId,
    { totalPoints, pointsBreakdown: breakdown },
    { session },
  );
}

/** Resolves the effective points config: circle overrides win field-by-field over org defaults. */
export function resolveEffectivePointsConfig(
  orgPointsConfig: Partial<PointsConfig> | undefined,
  circleOverride: PointsConfigOverride | undefined,
): PointsConfig {
  return {
    ...DEFAULT_POINTS_CONFIG,
    ...orgPointsConfig,
    ...circleOverride,
  };
}
