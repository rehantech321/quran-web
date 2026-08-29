import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";
import { recordGrade, updateGrade } from "./grade.service.js";

describe("grade.service", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("manual mode: points are exactly what the supervisor entered, independent of the grade value", async () => {
    const org = await createTestOrg({ pointsConfig: { gradeToPointsMode: "manual" } });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const grade = await recordGrade({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      weekOf: new Date(),
      grade: 60,
      points: 25,
      recordedBy: supervisor._id,
    });
    expect(grade.pointsAwarded).toBe(25);
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(25);
  });

  it("percentage mode: points equal the rounded grade", async () => {
    const org = await createTestOrg({
      pointsConfig: { gradeToPointsMode: "percentage" },
    });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const grade = await recordGrade({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      weekOf: new Date(),
      grade: 87.6,
      recordedBy: supervisor._id,
    });
    expect(grade.pointsAwarded).toBe(88);
  });

  it("allows multiple grade entries for the same student on the same date — grades are a free-form log, not one-per-week", async () => {
    const org = await createTestOrg({ pointsConfig: { gradeToPointsMode: "manual" } });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const sameDate = new Date();

    await recordGrade({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      weekOf: sameDate,
      grade: 70,
      points: 10,
      recordedBy: supervisor._id,
    });
    await recordGrade({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      weekOf: sameDate,
      grade: 80,
      points: 12,
      recordedBy: supervisor._id,
    });

    // Both entries count independently — 10 + 12, not a replacement.
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(22);
  });

  it("editing a grade reverses its old points and awards the new ones", async () => {
    const org = await createTestOrg({ pointsConfig: { gradeToPointsMode: "manual" } });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const grade = await recordGrade({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      weekOf: new Date(),
      grade: 70,
      points: 10,
      recordedBy: supervisor._id,
    });

    await updateGrade({ gradeId: grade._id, points: 18, updatedBy: supervisor._id });
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(18);
  });
});
