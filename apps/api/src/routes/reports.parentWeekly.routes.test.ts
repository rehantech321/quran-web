import type { Express } from "express";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createApp } from "../app.js";
import { WeeklyQuestion } from "../models/WeeklyQuestion.js";
import { signAccessToken } from "../services/auth.service.js";
import { addManualPoints } from "../services/student.service.js";
import { recordManualAttendance } from "../services/attendance.service.js";
import { recordMemorization } from "../services/memorization.service.js";
import { answerQuestion } from "../services/question.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestAdmin,
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";

function authHeader(user: {
  _id: unknown;
  organizationId: unknown;
  role: "admin" | "supervisor" | "super_admin";
}) {
  const token = signAccessToken({
    sub: String(user._id),
    org: String(user.organizationId),
    role: user.role,
  });
  return `Bearer ${token}`;
}

describe("GET /reports/parent-weekly/:id", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  // `recordManualAttendance` auto-upgrades a "present" mark to "late" once
  // the circle's real-time `lateAfter` cutoff has passed — pin the clock to
  // a safe morning instant so a late test run doesn't flip the expected
  // attendance counts (see reports.routes.test.ts for the same pattern).
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("reports actual attendance day counts (not a percentage), correct answers, memorization ranges, and points earned within the chosen period", async () => {
    const org = await createTestOrg({ pointsConfig: { attendancePresent: 10 } });
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id, {
      fullName: "طالب الاختبار",
    });

    // The suite's fake clock (see beforeEach below) is pinned to
    // 2026-01-01T10:00 — the queried range must include "now" since
    // `answerQuestion`/`addManualPoints` both stamp their own timestamp at
    // call time rather than accepting one as a parameter.
    const from = new Date("2026-01-01");
    const to = new Date("2026-01-11");

    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2026-01-06"),
      status: "present",
      recordedBy: supervisor._id,
    });
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2026-01-08"),
      status: "absent",
      recordedBy: supervisor._id,
    });
    // Outside the queried range — must not be counted.
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2026-02-01"),
      status: "present",
      recordedBy: supervisor._id,
    });

    await recordMemorization({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      date: new Date("2026-01-07"),
      newMemorization: {
        surahNumber: 2,
        fromAyah: 1,
        toAyah: 10,
        evaluation: "very_good",
      },
      revision: { surahNumber: 1, fromAyah: 1, toAyah: 7, evaluation: "weak" },
      recordedBy: supervisor._id,
    });

    const question = await WeeklyQuestion.create({
      organizationId: org._id,
      circleId: circle._id,
      weekOf: new Date("2026-01-01"),
      questionText: "test",
      options: [
        { key: "A", text: "a" },
        { key: "B", text: "b" },
      ],
      correctOptionKey: "A",
      points: 15,
      createdBy: supervisor._id,
      isPublished: true,
    });
    await answerQuestion({
      organizationId: org._id,
      questionId: question._id,
      studentId: student._id,
      selectedOptionKey: "A",
    });

    await addManualPoints(
      org._id.toString(),
      student._id,
      { points: 100, reason: "test" },
      supervisor._id,
    );

    const res = await request(app)
      .get(`/api/v1/reports/parent-weekly/${student._id}`)
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set("Authorization", authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.attendance).toEqual({
      present: 1,
      late: 0,
      absent: 1,
      excused: 0,
    });
    expect(res.body.data.correctAnswers).toBe(1);
    expect(res.body.data.newMemorization).toHaveLength(1);
    expect(res.body.data.newMemorization[0]).toMatchObject({
      surahNumber: 2,
      fromAyah: 1,
      toAyah: 10,
      evaluation: "very_good",
    });
    expect(res.body.data.revision).toHaveLength(1);
    expect(res.body.data.revision[0]).toMatchObject({
      surahNumber: 1,
      fromAyah: 1,
      toAyah: 7,
      evaluation: "weak",
    });
    // 100 manual + 15 for the correct answer + 10 for the one "present" day
    // recorded inside the range — all earned within this window.
    expect(res.body.data.periodPoints).toBe(125);
    expect(res.body.data.student).not.toHaveProperty("totalPoints");
    expect(res.body.data).not.toHaveProperty("rank");
  });

  it("defaults to the trailing 7 days when no range is given", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .get(`/api/v1/reports/parent-weekly/${student._id}`)
      .set("Authorization", authHeader(admin));

    expect(res.status).toBe(200);
    const from = new Date(res.body.data.range.from);
    const to = new Date(res.body.data.range.to);
    const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 1);
  });

  it("404s when the caller is a supervisor who doesn't own the student's circle", async () => {
    const orgA = await createTestOrg();
    const supervisorA = await createTestSupervisor(orgA._id);
    const circleA = await createTestCircle(orgA._id, supervisorA._id);
    const student = await createTestStudent(orgA._id, circleA._id);
    const otherSupervisor = await createTestSupervisor(orgA._id);

    const res = await request(app)
      .get(`/api/v1/reports/parent-weekly/${student._id}`)
      .set("Authorization", authHeader(otherSupervisor));
    expect(res.status).toBe(404);
  });
});
