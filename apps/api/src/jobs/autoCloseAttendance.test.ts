import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";
import { normalizeSessionDate } from "../utils/timezone.js";
import { runAutoCloseSweep, shouldAutoCloseCircle } from "./autoCloseAttendance.js";

// 2026-01-04 is a Sunday (weekday 0) in UTC, and — since Asia/Riyadh is a
// fixed UTC+3 offset with no DST — also a Sunday locally at every instant
// used below (none of them are close enough to local midnight to cross a
// calendar-day boundary).
const RIYADH = "Asia/Riyadh";
const SUNDAY_ONLY = { schedule: { days: [0], startTime: "19:45", lateAfter: "20:15" } };

describe("shouldAutoCloseCircle", () => {
  it("is false well before the grace deadline (lateAfter + 3h)", () => {
    // 1h after lateAfter (20:15 local == 17:15Z) — nowhere near the 3h grace window.
    const now = new Date("2026-01-04T18:15:00Z");
    expect(shouldAutoCloseCircle(SUNDAY_ONLY, RIYADH, now)).toBe(false);
  });

  it("is false exactly at the grace deadline (boundary is exclusive)", () => {
    const now = new Date("2026-01-04T20:15:00Z"); // lateAfter + exactly 3h
    expect(shouldAutoCloseCircle(SUNDAY_ONLY, RIYADH, now)).toBe(false);
  });

  it("is true just past the grace deadline", () => {
    const now = new Date("2026-01-04T20:16:00Z"); // lateAfter + 3h1m
    expect(shouldAutoCloseCircle(SUNDAY_ONLY, RIYADH, now)).toBe(true);
  });

  it("is false on a day the circle isn't scheduled, no matter the time", () => {
    // Monday, same time-of-day as the "true" case above — would auto-close
    // if this were Sunday.
    const now = new Date("2026-01-05T20:16:00Z");
    expect(shouldAutoCloseCircle(SUNDAY_ONLY, RIYADH, now)).toBe(false);
  });
});

describe("runAutoCloseSweep", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("marks an unscanned active student absent and deducts points once past the grace deadline", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id); // lateAfter 20:15, every day
    const student = await createTestStudent(org._id, circle._id);

    await runAutoCloseSweep(new Date("2026-01-04T20:16:00Z")); // 1min past the grace deadline

    const record = await AttendanceRecord.findOne({ studentId: student._id });
    expect(record?.status).toBe("absent");
    expect(record?.pointsAwarded).toBe(-10);

    const updated = await Student.findById(student._id).lean();
    expect(updated?.totalPoints).toBe(-10);
  });

  it("does nothing before the grace deadline", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    await runAutoCloseSweep(new Date("2026-01-04T18:15:00Z")); // 1h past lateAfter, well short of 3h grace

    const record = await AttendanceRecord.findOne({ studentId: student._id });
    expect(record).toBeNull();

    const untouched = await Student.findById(student._id).lean();
    expect(untouched?.totalPoints).toBe(0);
  });

  it("is idempotent — a second sweep never double-charges an already-closed session", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const pastDeadline = new Date("2026-01-04T20:16:00Z");

    await runAutoCloseSweep(pastDeadline);
    await runAutoCloseSweep(new Date(pastDeadline.getTime() + 60_000));

    const records = await AttendanceRecord.find({ studentId: student._id });
    expect(records).toHaveLength(1);

    const updated = await Student.findById(student._id).lean();
    expect(updated?.totalPoints).toBe(-10);
  });

  it("never touches a student already scanned present that day", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const now = new Date("2026-01-04T20:16:00Z");

    await AttendanceRecord.create({
      organizationId: org._id,
      circleId: circle._id,
      studentId: student._id,
      // Computed the same way `closeSession` computes it internally, rather
      // than hand-derived — Asia/Riyadh's +3 offset means this instant's
      // local calendar day starts well before this same instant in UTC.
      sessionDate: normalizeSessionDate(now, org.timezone),
      status: "present",
      method: "scan",
      pointsAwarded: 10,
      recordedBy: supervisor._id,
    });

    await runAutoCloseSweep(now);

    const record = await AttendanceRecord.findOne({ studentId: student._id });
    expect(record?.status).toBe("present");
    expect(record?.pointsAwarded).toBe(10);
  });
});
