import mongoose, { Types } from "mongoose";

import { NotFoundError } from "../errors.js";
import { CircleGrade } from "../models/CircleGrade.js";
import {
  awardPoints,
  resolveEffectivePointsConfig,
  reverseEntriesForSource,
} from "./points.service.js";
import { loadOrgAndCircle } from "./shared/loadOrgAndCircle.js";

export async function listGrades(
  organizationId: Types.ObjectId,
  filter: { circleId?: Types.ObjectId | string; weekOf?: Date } = {},
) {
  return CircleGrade.find({
    organizationId,
    ...(filter.circleId ? { circleId: filter.circleId } : {}),
    ...(filter.weekOf ? { weekOf: filter.weekOf } : {}),
  }).sort({ weekOf: -1, createdAt: -1 });
}

/**
 * Grade -> points conversion (SPEC.md §4 Organization.pointsConfig.gradeToPointsMode
 * doesn't specify the formula, so this is a logged decision — see DECISIONS.md):
 * - "manual": the caller supplies `points` explicitly (defaults to 0 if omitted) —
 *   the 0-100 grade and the points awarded are decoupled, both supervisor-entered.
 * - "percentage": points = the grade itself, rounded — a 100% grade earns 100 points.
 */
function resolveGradePoints(
  mode: "manual" | "percentage",
  grade: number,
  explicitPoints?: number,
): number {
  if (mode === "percentage") return Math.round(grade);
  return explicitPoints ?? 0;
}

export interface RecordGradeParams {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  weekOf: Date;
  grade: number;
  points?: number;
  notes?: string;
  recordedBy: Types.ObjectId;
}

export async function recordGrade(params: RecordGradeParams) {
  const { org, circle } = await loadOrgAndCircle(params.organizationId, params.circleId);
  const config = resolveEffectivePointsConfig(
    org.pointsConfig,
    circle.pointsConfigOverride,
  );

  // Deliberately no "one grade per student per week" restriction — grades are
  // a free-form log a supervisor adds to whenever they assess a student, not
  // pinned to a rigid weekly slot (changed after real usage: supervisors want
  // to add multiple entries for a student without fighting a date picker).
  const pointsAwarded = resolveGradePoints(
    config.gradeToPointsMode,
    params.grade,
    params.points,
  );

  const session = await mongoose.startSession();
  try {
    let record: InstanceType<typeof CircleGrade> | undefined;
    await session.withTransaction(async () => {
      const [created] = await CircleGrade.create(
        [
          {
            organizationId: params.organizationId,
            circleId: params.circleId,
            studentId: params.studentId,
            weekOf: params.weekOf,
            grade: params.grade,
            pointsAwarded,
            notes: params.notes,
            recordedBy: params.recordedBy,
          },
        ],
        { session },
      );
      record = created;
      await awardPoints({
        organizationId: params.organizationId,
        circleId: params.circleId,
        studentId: params.studentId,
        source: "grade",
        sourceRefId: created!._id,
        points: pointsAwarded,
        reason: "ledger.grade.recorded",
        reasonParams: { grade: params.grade },
        createdBy: params.recordedBy,
        session,
      });
    });
    return record!;
  } finally {
    await session.endSession();
  }
}

export async function getGrade(
  organizationId: Types.ObjectId,
  gradeId: Types.ObjectId | string,
) {
  const grade = await CircleGrade.findOne({ _id: gradeId, organizationId });
  if (!grade) throw new NotFoundError("grade");
  return grade;
}

export interface UpdateGradeParams {
  gradeId: Types.ObjectId;
  grade?: number;
  points?: number;
  notes?: string;
  updatedBy: Types.ObjectId;
}

export async function updateGrade(params: UpdateGradeParams) {
  const record = await CircleGrade.findById(params.gradeId);
  if (!record) throw new NotFoundError("grade");

  const { org, circle } = await loadOrgAndCircle(record.organizationId, record.circleId);
  const config = resolveEffectivePointsConfig(
    org.pointsConfig,
    circle.pointsConfigOverride,
  );

  const nextGrade = params.grade ?? record.grade;
  const pointsAwarded = resolveGradePoints(
    config.gradeToPointsMode,
    nextGrade,
    params.points,
  );

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await reverseEntriesForSource("grade", record._id, session);

      record.grade = nextGrade;
      record.pointsAwarded = pointsAwarded;
      if (params.notes !== undefined) record.notes = params.notes;
      await record.save({ session });

      await awardPoints({
        organizationId: record.organizationId,
        circleId: record.circleId,
        studentId: record.studentId,
        source: "grade",
        sourceRefId: record._id,
        points: pointsAwarded,
        reason: "ledger.grade.recorded",
        reasonParams: { grade: nextGrade },
        createdBy: params.updatedBy,
        session,
      });
    });
    return record;
  } finally {
    await session.endSession();
  }
}
