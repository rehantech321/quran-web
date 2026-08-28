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
import { PointsLedger } from "../models/PointsLedger.js";
import { signAccessToken } from "../services/auth.service.js";
import { recordManualAttendance } from "../services/attendance.service.js";
import { recordGrade } from "../services/grade.service.js";
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

describe("reports routes", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  // These tests record manual attendance as "present" and expect it to stay
  // "present" — `recordManualAttendance` now auto-upgrades a "present" mark
  // to "late" once the circle's real-time `lateAfter` cutoff has passed (see
  // attendance.service.ts#resolveManualStatus), so pin the clock to a safe
  // morning instant rather than whatever wall-clock time the suite runs at.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("aggregates a circle report: attendance rate, avg grade, and total points per student", async () => {
    const org = await createTestOrg({
      pointsConfig: {
        attendancePresent: 10,
        attendanceAbsent: -10,
        gradeToPointsMode: "manual",
      },
    });
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    // 1 present + 1 absent -> 50% attendance rate.
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2026-01-03"),
      status: "present",
      recordedBy: supervisor._id,
    });
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2026-01-10"),
      status: "absent",
      recordedBy: supervisor._id,
    });
    await recordGrade({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      weekOf: new Date("2026-01-03"),
      grade: 80,
      points: 16,
      recordedBy: supervisor._id,
    });

    const res = await request(app)
      .get(`/api/v1/reports/circle/${circle._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
    const row = res.body.data.students[0];
    expect(row.attendanceRate).toBe(50);
    expect(row.avgGrade).toBe(80);
    expect(row.totalPoints).toBe(10 - 10 + 16); // present +10, absent -10, grade +16
    expect(res.body.data.summary.studentCount).toBe(1);
  });

  it("404s a cross-tenant circle report request", async () => {
    const orgA = await createTestOrg();
    const orgB = await createTestOrg();
    const adminA = await createTestAdmin(orgA._id);
    const supervisorB = await createTestSupervisor(orgB._id);
    const circleB = await createTestCircle(orgB._id, supervisorB._id);

    const res = await request(app)
      .get(`/api/v1/reports/circle/${circleB._id}`)
      .set("Authorization", authHeader(adminA));
    expect(res.status).toBe(404);
  });

  it("leaderboard (all-time) ranks students by totalPoints descending", async () => {
    const org = await createTestOrg({ pointsConfig: { attendancePresent: 10 } });
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const low = await createTestStudent(org._id, circle._id);
    const high = await createTestStudent(org._id, circle._id);

    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: low._id,
      sessionDate: new Date(),
      status: "present",
      recordedBy: supervisor._id,
    });
    // Give `high` two separate present days so its total exceeds `low`'s.
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: high._id,
      sessionDate: new Date("2026-01-01"),
      status: "present",
      recordedBy: supervisor._id,
    });
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: high._id,
      sessionDate: new Date("2026-01-08"),
      status: "present",
      recordedBy: supervisor._id,
    });

    const res = await request(app)
      .get("/api/v1/reports/leaderboard?period=all")
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.data[0].studentId).toBe(high._id.toString());
    expect(res.body.data[0].points).toBe(20);
    expect(res.body.data[1].studentId).toBe(low._id.toString());
    expect(res.body.data[1].points).toBe(10);
  });

  it("exports a circle report as CSV with the expected header row", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .get(`/api/v1/reports/export?type=circle&format=csv&id=${circle._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text.split("\r\n")[0]).toContain("الاسم");
  });

  it("exports a student report as PDF", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .get(`/api/v1/reports/export?type=student&format=pdf&id=${student._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("the /students/:id/report alias returns the same shape as /reports/student/:id", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const viaReports = await request(app)
      .get(`/api/v1/reports/student/${student._id}`)
      .set("Authorization", authHeader(admin));
    const viaStudents = await request(app)
      .get(`/api/v1/students/${student._id}/report`)
      .set("Authorization", authHeader(admin));

    expect(viaReports.status).toBe(200);
    expect(viaStudents.status).toBe(200);
    expect(viaStudents.body.data.student.id).toBe(viaReports.body.data.student.id);
  });

  it("scopes a student report's stats to a date range when from/to are given (WhatsApp report periods rely on this)", async () => {
    const org = await createTestOrg({
      pointsConfig: { attendancePresent: 10, attendanceAbsent: -10 },
    });
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    // One session inside the queried range, one well outside it.
    const inRange = await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2026-01-10"),
      status: "present",
      recordedBy: supervisor._id,
    });
    const outOfRange = await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      sessionDate: new Date("2025-01-10"),
      status: "absent",
      recordedBy: supervisor._id,
    });
    // The ledger stamps `occurredAt` as the real write time (Phase 3), not the
    // backdated `sessionDate` — backdate it here too so this test can exercise
    // the ledger-side date filter independently of `sessionDate` filtering.
    await PointsLedger.updateOne(
      { source: "attendance", sourceRefId: inRange._id },
      { occurredAt: new Date("2026-01-10") },
    );
    await PointsLedger.updateOne(
      { source: "attendance", sourceRefId: outOfRange._id },
      { occurredAt: new Date("2025-01-10") },
    );

    const scoped = await request(app)
      .get(`/api/v1/reports/student/${student._id}`)
      .query({ from: "2026-01-01", to: "2026-01-31" })
      .set("Authorization", authHeader(admin));
    expect(scoped.status).toBe(200);
    expect(scoped.body.data.stats.sessionsRecorded).toBe(1);
    expect(scoped.body.data.stats.attendanceRate).toBe(100);
    expect(scoped.body.data.stats.periodPoints).toBe(10);

    const unscoped = await request(app)
      .get(`/api/v1/reports/student/${student._id}`)
      .set("Authorization", authHeader(admin));
    expect(unscoped.body.data.stats.sessionsRecorded).toBe(2);
    expect(unscoped.body.data.stats.attendanceRate).toBe(50);
    expect(unscoped.body.data.stats.periodPoints).toBe(
      unscoped.body.data.student.totalPoints,
    );
  });
});
