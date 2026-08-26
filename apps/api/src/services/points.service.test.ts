import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PointsLedger } from "../models/PointsLedger.js";
import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";
import { awardPoints, recomputeStudentPoints } from "./points.service.js";

describe("points.service", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("sums ledger entries into totalPoints and pointsBreakdown by source", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await awardPoints({
          organizationId: org._id,
          circleId: circle._id,
          studentId: student._id,
          source: "attendance",
          sourceRefId: new Types.ObjectId(),
          points: 10,
          reason: "ledger.attendance.present",
          session,
        });
        await awardPoints({
          organizationId: org._id,
          circleId: circle._id,
          studentId: student._id,
          source: "question",
          sourceRefId: new Types.ObjectId(),
          points: 20,
          reason: "ledger.question.correct",
          session,
        });
      });
    } finally {
      await session.endSession();
    }

    const refreshed = await Student.findById(student._id).lean();
    expect(refreshed?.totalPoints).toBe(30);
    expect(refreshed?.pointsBreakdown).toMatchObject({ attendance: 10, questions: 20 });
  });

  it("recomputeStudentPoints rebuilds the cache from the ledger from scratch (the safety net)", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    await PointsLedger.create([
      {
        organizationId: org._id,
        circleId: circle._id,
        studentId: student._id,
        source: "attendance",
        sourceRefId: new Types.ObjectId(),
        points: 10,
        reason: "ledger.attendance.present",
        occurredAt: new Date(),
      },
      {
        organizationId: org._id,
        circleId: circle._id,
        studentId: student._id,
        source: "manual",
        sourceRefId: new Types.ObjectId(),
        points: -5,
        reason: "ledger.manual.adjustment",
        occurredAt: new Date(),
      },
    ]);

    // Simulate a drifted cache (e.g. from a bug or manual DB edit).
    await Student.updateOne(
      { _id: student._id },
      {
        $set: {
          totalPoints: 999,
          pointsBreakdown: {
            attendance: 999,
            grades: 0,
            questions: 0,
            tasks: 0,
            manual: 0,
          },
        },
      },
    );

    await recomputeStudentPoints(student._id);

    const refreshed = await Student.findById(student._id).lean();
    expect(refreshed?.totalPoints).toBe(5);
    expect(refreshed?.pointsBreakdown).toMatchObject({ attendance: 10, manual: -5 });
  });
});
