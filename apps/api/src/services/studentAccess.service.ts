import { Organization } from "../models/Organization.js";
import { Student, type StudentDocument } from "../models/Student.js";
import { signStudentToken } from "./auth.service.js";

export class InvalidStudentLinkError extends Error {
  constructor() {
    super("invalid_student_link");
    this.name = "InvalidStudentLinkError";
  }
}

export class InvalidPinError extends Error {
  constructor() {
    super("invalid_pin");
    this.name = "InvalidPinError";
  }
}

export type ResolveStudentAccessResult =
  { pinRequired: true } | { pinRequired: false; token: string; student: StudentDocument };

/**
 * Resolves a student's private-link slug into either a minted session token, or
 * a "PIN required" signal if the org has that setting on and the student has a
 * PIN set. Never reveals whether an unknown slug exists — both "not found" and
 * any other failure surface the same InvalidStudentLinkError to the caller,
 * which the route maps to a generic 404 (SPEC.md §3).
 */
export async function resolveStudentAccess(
  slug: string,
): Promise<ResolveStudentAccessResult> {
  const student = await Student.findOne({
    accessSlug: slug,
    isActive: true,
    deletedAt: null,
  });
  if (!student) throw new InvalidStudentLinkError();

  const org = await Organization.findById(student.organizationId).lean();
  if (!org || org.deletedAt) throw new InvalidStudentLinkError();

  const studentWithPin = await Student.findById(student._id).select("+pin").lean();
  if (org.requireStudentPin && studentWithPin?.pin) {
    return { pinRequired: true };
  }

  const token = mintStudentToken(student);
  return { pinRequired: false, token, student };
}

export async function verifyStudentPin(
  slug: string,
  pin: string,
): Promise<{ token: string; student: StudentDocument }> {
  const student = await Student.findOne({
    accessSlug: slug,
    isActive: true,
    deletedAt: null,
  }).select("+pin");
  if (!student) throw new InvalidStudentLinkError();

  const matches = await student.comparePin(pin);
  if (!matches) throw new InvalidPinError();

  const token = mintStudentToken(student);
  return { token, student };
}

function mintStudentToken(student: StudentDocument): string {
  return signStudentToken({
    sub: student._id.toString(),
    org: student.organizationId.toString(),
  });
}
