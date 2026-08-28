import mongoose, { Types } from "mongoose";

import type { AttendanceStatus, PointsConfig } from "@halaqat/shared";

import { ConflictError, NotFoundError } from "../errors.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Organization } from "../models/Organization.js";
import { Student } from "../models/Student.js";
import { isAfterTimeOnSessionDate, normalizeSessionDate } from "../utils/timezone.js";
import {
  awardPoints,
  reverseEntriesForSource,
  resolveEffectivePointsConfig,
} from "./points.service.js";
import { loadOrgAndCircle } from "./shared/loadOrgAndCircle.js";

/**
 * The QR code printed on a student's card encodes their full private-link
 * URL (so an ordinary phone camera can open it directly — see
 * `student.service.ts#generateStudentQrPng`), not the bare `barcodeValue`.
 * The in-app scanner and manual-entry field both feed whatever they capture
 * straight through here, so recover the bare slug from a URL-shaped scan
 * before matching `Student.barcodeValue`; a bare slug (manual typing, an
 * older printed card) passes through unchanged.
 */
function extractBarcodeValue(scanned: string): string {
  const trimmed = scanned.trim();
  const match = trimmed.match(/\/student\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1]!) : trimmed;
}

/**
 * "Present" from a supervisor manually marking the roster means "this
 * student is here" — it doesn't say whether they were on time. Apply the
 * same lateAfter cutoff `scanAttendance` uses so a student marked present
 * after the cutoff is recorded (and paid points) as late automatically,
 * exactly as if they'd scanned in late — instead of relying on every
 * supervisor to remember to tap "late" themselves. An explicit "late" /
 * "absent" / "excused" tap is never second-guessed; only "present" is
 * time-checked, since those three are already unambiguous judgment calls.
 */
function resolveManualStatus(
  requestedStatus: AttendanceStatus,
  now: Date,
  sessionDate: Date,
  lateAfter: string,
  timeZone: string,
): AttendanceStatus {
  if (requestedStatus !== "present") return requestedStatus;
  return isAfterTimeOnSessionDate(now, sessionDate, lateAfter, timeZone)
    ? "late"
    : "present";
}

function pointsForStatus(config: PointsConfig, status: AttendanceStatus): number {
  switch (status) {
    case "present":
      return config.attendancePresent;
    case "late":
      return config.attendanceLate;
    case "absent":
      return config.attendanceAbsent;
    case "excused":
      return config.attendanceExcused;
  }
}

export interface ScanAttendanceParams {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  barcodeValue: string;
  recordedBy: Types.ObjectId;
}

/** Resolves a scanned barcode to a student and records attendance. Idempotent per student per day. */
export async function scanAttendance(params: ScanAttendanceParams) {
  const student = await Student.findOne({
    organizationId: params.organizationId,
    barcodeValue: extractBarcodeValue(params.barcodeValue),
    deletedAt: null,
  });
  if (!student) throw new NotFoundError("student");
  if (String(student.circleId) !== String(params.circleId)) {
    throw new ConflictError("student_not_in_circle");
  }

  const { org, circle } = await loadOrgAndCircle(params.organizationId, params.circleId);
  const now = new Date();
  const sessionDate = normalizeSessionDate(now, org.timezone);

  const existing = await AttendanceRecord.findOne({
    studentId: student._id,
    sessionDate,
  });
  if (existing) {
    return { record: existing, student, alreadyRecorded: true as const };
  }

  const config = resolveEffectivePointsConfig(
    org.pointsConfig,
    circle.pointsConfigOverride,
  );
  const late = isAfterTimeOnSessionDate(
    now,
    sessionDate,
    circle.schedule.lateAfter,
    org.timezone,
  );
  const status: AttendanceStatus = late ? "late" : "present";
  const pointsAwarded = pointsForStatus(config, status);

  const mongoSession = await mongoose.startSession();
  try {
    let record: InstanceType<typeof AttendanceRecord> | undefined;
    await mongoSession.withTransaction(async () => {
      const [created] = await AttendanceRecord.create(
        [
          {
            organizationId: params.organizationId,
            circleId: params.circleId,
            studentId: student._id,
            sessionDate,
            status,
            checkInAt: now,
            method: "scan",
            pointsAwarded,
            recordedBy: params.recordedBy,
          },
        ],
        { session: mongoSession },
      );
      record = created;
      await awardPoints({
        organizationId: params.organizationId,
        circleId: params.circleId,
        studentId: student._id,
        source: "attendance",
        sourceRefId: created!._id,
        points: pointsAwarded,
        reason: `ledger.attendance.${status}`,
        occurredAt: now,
        createdBy: params.recordedBy,
        session: mongoSession,
      });
    });
    return { record: record!, student, alreadyRecorded: false as const };
  } finally {
    await mongoSession.endSession();
  }
}

export interface RecordManualAttendanceParams {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  studentId: Types.ObjectId;
  sessionDate: Date;
  status: AttendanceStatus;
  note?: string;
  recordedBy: Types.ObjectId;
}

/** Creates a manual attendance record. Throws ConflictError if one already exists for that day — use updateAttendanceRecord to edit. */
export async function recordManualAttendance(params: RecordManualAttendanceParams) {
  const { org, circle } = await loadOrgAndCircle(params.organizationId, params.circleId);
  const sessionDate = normalizeSessionDate(params.sessionDate, org.timezone);

  const existing = await AttendanceRecord.findOne({
    studentId: params.studentId,
    sessionDate,
  });
  if (existing) throw new ConflictError("attendance_already_recorded");

  const status = resolveManualStatus(
    params.status,
    new Date(),
    sessionDate,
    circle.schedule.lateAfter,
    org.timezone,
  );
  const config = resolveEffectivePointsConfig(
    org.pointsConfig,
    circle.pointsConfigOverride,
  );
  const pointsAwarded = pointsForStatus(config, status);

  const mongoSession = await mongoose.startSession();
  try {
    let record: InstanceType<typeof AttendanceRecord> | undefined;
    await mongoSession.withTransaction(async () => {
      const [created] = await AttendanceRecord.create(
        [
          {
            organizationId: params.organizationId,
            circleId: params.circleId,
            studentId: params.studentId,
            sessionDate,
            status,
            method: "manual",
            pointsAwarded,
            recordedBy: params.recordedBy,
            note: params.note,
          },
        ],
        { session: mongoSession },
      );
      record = created;
      await awardPoints({
        organizationId: params.organizationId,
        circleId: params.circleId,
        studentId: params.studentId,
        source: "attendance",
        sourceRefId: created!._id,
        points: pointsAwarded,
        reason: `ledger.attendance.${status}`,
        createdBy: params.recordedBy,
        session: mongoSession,
      });
    });
    return record!;
  } finally {
    await mongoSession.endSession();
  }
}

export async function getAttendanceRecord(
  organizationId: Types.ObjectId,
  attendanceId: Types.ObjectId | string,
) {
  const record = await AttendanceRecord.findOne({ _id: attendanceId, organizationId });
  if (!record) throw new NotFoundError("attendance_record");
  return record;
}

export interface UpdateAttendanceRecordParams {
  attendanceId: Types.ObjectId;
  status: AttendanceStatus;
  note?: string;
  updatedBy: Types.ObjectId;
}

/** Edits an existing attendance record: reverses the old ledger entry and writes a fresh one. */
export async function updateAttendanceRecord(params: UpdateAttendanceRecordParams) {
  const record = await AttendanceRecord.findById(params.attendanceId);
  if (!record) throw new NotFoundError("attendance_record");

  const { org, circle } = await loadOrgAndCircle(record.organizationId, record.circleId);
  const config = resolveEffectivePointsConfig(
    org.pointsConfig,
    circle.pointsConfigOverride,
  );
  const newPoints = pointsForStatus(config, params.status);

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      await reverseEntriesForSource("attendance", record._id, mongoSession);

      record.status = params.status;
      record.pointsAwarded = newPoints;
      if (params.note !== undefined) record.note = params.note;
      await record.save({ session: mongoSession });

      await awardPoints({
        organizationId: record.organizationId,
        circleId: record.circleId,
        studentId: record.studentId,
        source: "attendance",
        sourceRefId: record._id,
        points: newPoints,
        reason: `ledger.attendance.${params.status}`,
        createdBy: params.updatedBy,
        session: mongoSession,
      });
    });
    return record;
  } finally {
    await mongoSession.endSession();
  }
}

export interface CloseSessionParams {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  sessionDate: Date;
  recordedBy: Types.ObjectId;
}

/** Marks every active student in the circle with no attendance record for the day as absent. */
export async function closeSession(params: CloseSessionParams) {
  const { org, circle } = await loadOrgAndCircle(params.organizationId, params.circleId);
  const sessionDate = normalizeSessionDate(params.sessionDate, org.timezone);
  const config = resolveEffectivePointsConfig(
    org.pointsConfig,
    circle.pointsConfigOverride,
  );

  const students = await Student.find({
    organizationId: params.organizationId,
    circleId: params.circleId,
    isActive: true,
    deletedAt: null,
  }).lean();

  const existingRecords = await AttendanceRecord.find({
    studentId: { $in: students.map((s) => s._id) },
    sessionDate,
  }).lean();
  const recordedStudentIds = new Set(existingRecords.map((r) => String(r.studentId)));
  const missingStudents = students.filter((s) => !recordedStudentIds.has(String(s._id)));

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      for (const student of missingStudents) {
        const [created] = await AttendanceRecord.create(
          [
            {
              organizationId: params.organizationId,
              circleId: params.circleId,
              studentId: student._id,
              sessionDate,
              status: "absent",
              method: "manual",
              pointsAwarded: config.attendanceAbsent,
              recordedBy: params.recordedBy,
            },
          ],
          { session: mongoSession },
        );
        await awardPoints({
          organizationId: params.organizationId,
          circleId: params.circleId,
          studentId: student._id,
          source: "attendance",
          sourceRefId: created!._id,
          points: config.attendanceAbsent,
          reason: "ledger.attendance.absent",
          createdBy: params.recordedBy,
          session: mongoSession,
        });
      }
    });
    return { markedAbsent: missingStudents.length };
  } finally {
    await mongoSession.endSession();
  }
}

export interface AttendanceRosterEntry {
  studentId: Types.ObjectId;
  fullName: string;
  photoUrl?: string;
  status: AttendanceStatus | "not_recorded";
  checkInAt?: Date;
  pointsAwarded?: number;
  attendanceRecordId?: Types.ObjectId;
}

/** Every active student in the circle, each paired with their status for `date` (or "not_recorded"). */
export async function getAttendanceRoster(
  organizationId: Types.ObjectId,
  circleId: Types.ObjectId,
  date: Date,
): Promise<AttendanceRosterEntry[]> {
  const org = await Organization.findById(organizationId).lean();
  if (!org) throw new NotFoundError("organization");
  const sessionDate = normalizeSessionDate(date, org.timezone);

  const students = await Student.find({
    organizationId,
    circleId,
    isActive: true,
    deletedAt: null,
  })
    .sort({ fullName: 1 })
    .lean();

  const records = await AttendanceRecord.find({
    studentId: { $in: students.map((s) => s._id) },
    sessionDate,
  }).lean();
  const recordByStudentId = new Map(records.map((r) => [String(r.studentId), r]));

  return students.map((student) => {
    const record = recordByStudentId.get(String(student._id));
    return {
      studentId: student._id,
      fullName: student.fullName,
      photoUrl: student.photoUrl,
      status: record?.status ?? "not_recorded",
      checkInAt: record?.checkInAt,
      pointsAwarded: record?.pointsAwarded,
      attendanceRecordId: record?._id,
    };
  });
}
