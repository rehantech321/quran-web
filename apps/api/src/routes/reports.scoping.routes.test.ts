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
import { recordManualAttendance } from "../services/attendance.service.js";
import { signAccessToken } from "../services/auth.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestAdmin,
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";

// Split out of reports.routes.test.ts: that file already runs 12-14
// transactional tests against one in-memory replica set, and appending more
// there was tipping it into intermittent `MongooseError: Connection
// operation buffering timed out` failures near the end of the run
// (reproduced 3+ times in a row, unrelated to any of the actual test logic —
// confirmed by every failing test passing cleanly in isolation). Each test
// file gets its own replica set (see dbTestUtils.ts), so splitting is a real
// fix for the resource ceiling, not a workaround.

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

describe("reports cross-supervisor scoping", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  // `recordManualAttendance` auto-upgrades a "present" mark to "late" once
  // the circle's lateAfter cutoff has passed — pin the clock so these tests
  // don't depend on the real wall-clock time the suite happens to run at.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("champions: a supervisor only ever sees their own circle, never another supervisor's", async () => {
    const org = await createTestOrg();
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleA = await createTestCircle(org._id, supervisorA._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    await createTestStudent(org._id, circleA._id);
    await createTestStudent(org._id, circleB._id);

    const res = await request(app)
      .get("/api/v1/reports/champions")
      .set("Authorization", authHeader(supervisorA));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].circleId).toBe(circleA._id.toString());

    // An admin, by contrast, sees every circle.
    const admin = await createTestAdmin(org._id);
    const asAdmin = await request(app)
      .get("/api/v1/reports/champions")
      .set("Authorization", authHeader(admin));
    expect(asAdmin.body.data).toHaveLength(2);
  });

  it("leaderboard with no circleId: a supervisor only ranks their own students, never another supervisor's", async () => {
    const org = await createTestOrg();
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleA = await createTestCircle(org._id, supervisorA._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    const ownStudent = await createTestStudent(org._id, circleA._id);
    const otherStudent = await createTestStudent(org._id, circleB._id);

    await recordManualAttendance({
      organizationId: org._id,
      circleId: circleA._id,
      studentId: ownStudent._id,
      sessionDate: new Date(),
      status: "present",
      recordedBy: supervisorA._id,
    });
    await recordManualAttendance({
      organizationId: org._id,
      circleId: circleB._id,
      studentId: otherStudent._id,
      sessionDate: new Date(),
      status: "present",
      recordedBy: supervisorB._id,
    });

    const res = await request(app)
      .get("/api/v1/reports/leaderboard?period=all")
      .set("Authorization", authHeader(supervisorA));
    expect(res.status).toBe(200);
    const studentIds = res.body.data.map((e: { studentId: string }) => e.studentId);
    expect(studentIds).toContain(ownStudent._id.toString());
    expect(studentIds).not.toContain(otherStudent._id.toString());
  });
});
