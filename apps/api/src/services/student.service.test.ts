import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PointsLedger } from "../models/PointsLedger.js";
import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestSupervisor,
  createTestStudent,
} from "../test/fixtures.js";
import { addManualPoints } from "./student.service.js";

describe("student.service", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("adds a manual points ledger entry and updates the cached total", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const updated = await addManualPoints(
      org._id.toString(),
      student._id,
      { points: 15, reason: "Bonus for helping set up the circle" },
      supervisor._id,
    );

    expect(updated.totalPoints).toBe(15);
    expect(updated.pointsBreakdown.manual).toBe(15);

    const entries = await PointsLedger.find({ studentId: student._id });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe("manual");
    expect(entries[0]!.points).toBe(15);
    expect(entries[0]!.reason).toBe("Bonus for helping set up the circle");
  });

  it("supports negative points to deduct, stacking with other point sources", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    await addManualPoints(
      org._id.toString(),
      student._id,
      { points: 20, reason: "Bonus" },
      supervisor._id,
    );
    const updated = await addManualPoints(
      org._id.toString(),
      student._id,
      { points: -5, reason: "Correction" },
      supervisor._id,
    );

    expect(updated.totalPoints).toBe(15);
    expect(updated.pointsBreakdown.manual).toBe(15);

    const fromDb = await Student.findById(student._id).lean();
    expect(fromDb?.totalPoints).toBe(15);
  });
});
