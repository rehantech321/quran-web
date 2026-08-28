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

import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { PointsLedger } from "../models/PointsLedger.js";
import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";
import {
  closeSession,
  recordManualAttendance,
  scanAttendance,
  updateAttendanceRecord,
} from "./attendance.service.js";

describe("attendance.service", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  // Pin the clock to a time safely before the default `lateAfter` (20:15
  // Asia/Riyadh, see DEFAULT_SESSION_DEFAULTS) so "present" tests don't
  // flip to "late" depending on the real time of day the suite happens to
  // run — the one test that specifically exercises the late/present
  // boundary sets its own explicit times on top of this.
  beforeEach(() => {
    // `shouldAdvanceTime` keeps the clock ticking forward in step with real
    // time (just offset to start at a safe instant) instead of freezing it —
    // a fully frozen clock gives sequential writes in the same test
    // (e.g. an attendance scan followed by an edit) an identical
    // `occurredAt`, which breaks ledger tests that sort by it.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("awards the configured points for present/late/absent/excused", async () => {
    const org = await createTestOrg({
      pointsConfig: {
        attendancePresent: 10,
        attendanceLate: -5,
        attendanceAbsent: -10,
        attendanceExcused: 0,
      },
    });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const present = await createTestStudent(org._id, circle._id);
    const excused = await createTestStudent(org._id, circle._id);

    const { record } = await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: present.barcodeValue,
      recordedBy: supervisor._id,
    });
    expect(record.status).toBe("present");
    expect(record.pointsAwarded).toBe(10);

    const excusedRecord = await recordManualAttendance({
      organizationId: org._id,
      circleId: circle._id,
      studentId: excused._id,
      sessionDate: new Date(),
      status: "excused",
      recordedBy: supervisor._id,
    });
    expect(excusedRecord.pointsAwarded).toBe(0);

    const refreshedPresent = await Student.findById(present._id).lean();
    expect(refreshedPresent?.totalPoints).toBe(10);
  });

  it("enforces one attendance record per student per day", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const first = await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: student.barcodeValue,
      recordedBy: supervisor._id,
    });
    expect(first.alreadyRecorded).toBe(false);

    const second = await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: student.barcodeValue,
      recordedBy: supervisor._id,
    });
    expect(second.alreadyRecorded).toBe(true);
    expect(second.record._id.toString()).toBe(first.record._id.toString());

    const records = await AttendanceRecord.find({ studentId: student._id });
    expect(records).toHaveLength(1);

    const refreshed = await Student.findById(student._id).lean();
    expect(refreshed?.totalPoints).toBe(10); // not double-awarded
  });

  it("resolves late vs. present at the exact lateAfter boundary in the org's timezone", async () => {
    // Asia/Riyadh has no DST: 20:15 local = 17:15 UTC year-round.
    const org = await createTestOrg({ timezone: "Asia/Riyadh" });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id, {
      lateAfter: "20:15",
    });
    const onTime = await createTestStudent(org._id, circle._id);
    const late = await createTestStudent(org._id, circle._id);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T17:14:59.000Z"));
    const onTimeResult = await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: onTime.barcodeValue,
      recordedBy: supervisor._id,
    });
    expect(onTimeResult.record.status).toBe("present");

    vi.setSystemTime(new Date("2026-03-05T17:15:01.000Z"));
    const lateResult = await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: late.barcodeValue,
      recordedBy: supervisor._id,
    });
    expect(lateResult.record.status).toBe("late");
  });

  it("reverses the old ledger entry and writes a fresh one when a record is edited", async () => {
    const org = await createTestOrg({
      pointsConfig: { attendancePresent: 10, attendanceAbsent: -10 },
    });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const { record } = await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: student.barcodeValue,
      recordedBy: supervisor._id,
    });
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(10);

    await updateAttendanceRecord({
      attendanceId: record._id,
      status: "absent",
      updatedBy: supervisor._id,
    });

    const refreshed = await Student.findById(student._id).lean();
    expect(refreshed?.totalPoints).toBe(-10);

    // History is append-only: the original entry stays, marked reversed, plus a
    // reversal entry and the new entry — never a mutation of the original row.
    const entries = await PointsLedger.find({ studentId: student._id }).sort({
      occurredAt: 1,
    });
    expect(entries).toHaveLength(3);
    expect(entries[0]!.points).toBe(10);
    expect(entries[0]!.reversedAt).toBeDefined();
    expect(entries[1]!.points).toBe(-10);
    expect(entries[1]!.reversalOfId?.toString()).toBe(entries[0]!._id.toString());
    expect(entries[2]!.points).toBe(-10);
    expect(entries[2]!.reversedAt).toBeUndefined();
  });

  it("closeSession marks unscanned active students absent", async () => {
    const org = await createTestOrg({ pointsConfig: { attendanceAbsent: -10 } });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const scanned = await createTestStudent(org._id, circle._id);
    const unscanned = await createTestStudent(org._id, circle._id);

    await scanAttendance({
      organizationId: org._id,
      circleId: circle._id,
      barcodeValue: scanned.barcodeValue,
      recordedBy: supervisor._id,
    });

    const result = await closeSession({
      organizationId: org._id,
      circleId: circle._id,
      sessionDate: new Date(),
      recordedBy: supervisor._id,
    });
    expect(result.markedAbsent).toBe(1);

    const unscannedRecord = await AttendanceRecord.findOne({ studentId: unscanned._id });
    expect(unscannedRecord?.status).toBe("absent");
    expect((await Student.findById(unscanned._id).lean())?.totalPoints).toBe(-10);
  });
});
