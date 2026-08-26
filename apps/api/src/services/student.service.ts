import type { Types } from "mongoose";
import QRCode from "qrcode";

import type {
  CreateStudentInput,
  PaginationQuery,
  UpdateStudentInput,
} from "@halaqat/shared";

import { NotFoundError, ValidationError } from "../errors.js";
import { Circle } from "../models/Circle.js";
import { PointsLedger } from "../models/PointsLedger.js";
import { Student } from "../models/Student.js";
import { generateStudentAccessSlug } from "../utils/slug.js";

async function assertCircleInOrg(organizationId: string, circleId: string) {
  const circle = await Circle.findOne({ _id: circleId, organizationId, deletedAt: null });
  if (!circle)
    throw new ValidationError("circleId must reference a circle in this organization");
}

export async function listStudentsByCircle(organizationId: string, circleId: string) {
  await assertCircleInOrg(organizationId, circleId);
  return Student.find({ organizationId, circleId, deletedAt: null }).sort({
    fullName: 1,
  });
}

export async function getStudent(
  organizationId: string,
  studentId: Types.ObjectId | string,
) {
  const student = await Student.findOne({
    _id: studentId,
    organizationId,
    deletedAt: null,
  });
  if (!student) throw new NotFoundError("student");
  return student;
}

export async function createStudent(organizationId: string, input: CreateStudentInput) {
  await assertCircleInOrg(organizationId, input.circleId);
  return Student.create({
    organizationId,
    circleId: input.circleId,
    fullName: input.fullName,
    photoUrl: input.photoUrl,
    parentPhone: input.parentPhone,
    studentPhone: input.studentPhone,
    dateOfBirth: input.dateOfBirth,
    level: input.level,
    notes: input.notes,
  });
}

export async function updateStudent(
  organizationId: string,
  studentId: Types.ObjectId | string,
  updates: UpdateStudentInput,
) {
  const student = await getStudent(organizationId, studentId);

  if (updates.circleId) {
    await assertCircleInOrg(organizationId, updates.circleId);
    student.circleId = updates.circleId as unknown as Types.ObjectId;
  }
  if (updates.fullName !== undefined) student.fullName = updates.fullName;
  if (updates.photoUrl !== undefined) student.photoUrl = updates.photoUrl;
  if (updates.parentPhone !== undefined) student.parentPhone = updates.parentPhone;
  if (updates.studentPhone !== undefined) student.studentPhone = updates.studentPhone;
  if (updates.dateOfBirth !== undefined) student.dateOfBirth = updates.dateOfBirth;
  if (updates.level !== undefined) student.level = updates.level;
  if (updates.notes !== undefined) student.notes = updates.notes;
  if (updates.isActive !== undefined) student.isActive = updates.isActive;

  await student.save();
  return student;
}

export async function deleteStudent(
  organizationId: string,
  studentId: Types.ObjectId | string,
) {
  const student = await getStudent(organizationId, studentId);
  student.deletedAt = new Date();
  student.isActive = false;
  await student.save();
  return student;
}

/** Invalidates the old private link — the previous accessSlug/barcodeValue stop resolving. */
export async function regenerateStudentSlug(
  organizationId: string,
  studentId: Types.ObjectId | string,
) {
  const student = await getStudent(organizationId, studentId);
  const newSlug = generateStudentAccessSlug();
  student.accessSlug = newSlug;
  student.barcodeValue = newSlug;
  await student.save();
  return student;
}

/** Renders the student's QR code (their accessSlug) as a PNG buffer for printable cards. */
export async function generateStudentQrPng(
  organizationId: string,
  studentId: Types.ObjectId | string,
) {
  const student = await getStudent(organizationId, studentId);
  return QRCode.toBuffer(student.barcodeValue, { type: "png", width: 512, margin: 2 });
}

export async function getStudentPointsHistory(
  organizationId: string,
  studentId: Types.ObjectId | string,
  pagination: PaginationQuery,
) {
  await getStudent(organizationId, studentId); // 404s + org-scopes before touching the ledger

  const skip = (pagination.page - 1) * pagination.limit;
  const [entries, total] = await Promise.all([
    PointsLedger.find({ studentId })
      .sort({ occurredAt: -1 })
      .skip(skip)
      .limit(pagination.limit),
    PointsLedger.countDocuments({ studentId }),
  ]);

  return { entries, total, page: pagination.page, limit: pagination.limit };
}
