import type { Types } from "mongoose";

import type { CreateUserInput, Role, UpdateUserInput } from "@halaqat/shared";

import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { Circle } from "../models/Circle.js";
import { User } from "../models/User.js";
import { hashPassword } from "../models/User.js";

/** Not exposed to the frontend: an org's own admin/supervisor management, referenced by the Settings screen. */
export async function listStaff(organizationId: string) {
  return User.find({ organizationId, deletedAt: null }).sort({ fullName: 1 });
}

export async function getStaffMember(
  organizationId: string,
  userId: Types.ObjectId | string,
) {
  const user = await User.findOne({ _id: userId, organizationId, deletedAt: null });
  if (!user) throw new NotFoundError("user");
  return user;
}

/** An admin may only create supervisor/admin accounts — never super_admin. */
function assertCreatableRole(creatorRole: Role, targetRole: Role) {
  if (creatorRole === "super_admin") return;
  if (creatorRole === "admin" && (targetRole === "supervisor" || targetRole === "admin"))
    return;
  throw new ValidationError("You do not have permission to assign that role");
}

const DUPLICATE_KEY_ERROR_CODE = 11000;

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === DUPLICATE_KEY_ERROR_CODE
  );
}

export async function createStaffMember(
  organizationId: string,
  creatorRole: Role,
  input: CreateUserInput,
) {
  assertCreatableRole(creatorRole, input.role);
  const passwordHash = await hashPassword(input.password);
  try {
    return await User.create({
      organizationId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role,
      avatarUrl: input.avatarUrl,
    });
  } catch (err) {
    // User.email/phone are each unique per organization (User.ts) — without
    // this, a second attempt with an email already in use (e.g. a retry
    // after a flaky connection made the first attempt look like it failed)
    // surfaced as a raw, unhandled Mongo error and a generic 500 instead of
    // a message that actually explains what went wrong.
    if (isDuplicateKeyError(err)) {
      const field = err.keyPattern && "phone" in err.keyPattern ? "phone" : "email";
      throw new ConflictError(
        field === "email"
          ? "A staff account with this email already exists in this organization"
          : "A staff account with this phone number already exists in this organization",
      );
    }
    throw err;
  }
}

export async function updateStaffMember(
  organizationId: string,
  userId: Types.ObjectId | string,
  updates: UpdateUserInput,
) {
  const user = await getStaffMember(organizationId, userId);

  if (updates.fullName !== undefined) user.fullName = updates.fullName;
  if (updates.email !== undefined) user.email = updates.email;
  if (updates.phone !== undefined) user.phone = updates.phone;
  if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl;
  if (updates.isActive !== undefined) user.isActive = updates.isActive;

  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const field = err.keyPattern && "phone" in err.keyPattern ? "phone" : "email";
      throw new ConflictError(
        field === "email"
          ? "A staff account with this email already exists in this organization"
          : "A staff account with this phone number already exists in this organization",
      );
    }
    throw err;
  }
  return user;
}

/** An admin may only delete supervisor/admin accounts — never super_admin. Same ceiling as account creation. */
function assertDeletableRole(callerRole: Role, targetRole: Role) {
  if (callerRole === "super_admin") return;
  if (callerRole === "admin" && (targetRole === "supervisor" || targetRole === "admin"))
    return;
  throw new ValidationError("You do not have permission to remove that account");
}

/**
 * Soft-deletes a staff account. Refuses to delete a supervisor who still has
 * active circles assigned — those circles would otherwise be left with a
 * `supervisorId` pointing at a removed account, and no one able to manage
 * them. Reassign the circles to another supervisor first (same "move the
 * dependents off first" rule `deleteCircle` already applies to students).
 */
export async function deleteStaffMember(
  organizationId: string,
  callerRole: Role,
  callerId: string,
  userId: Types.ObjectId | string,
) {
  if (String(callerId) === String(userId)) {
    throw new ValidationError("You cannot remove your own account");
  }

  const user = await getStaffMember(organizationId, userId);
  assertDeletableRole(callerRole, user.role);

  if (user.role === "supervisor") {
    const activeCircleCount = await Circle.countDocuments({
      organizationId,
      supervisorId: user._id,
      isActive: true,
      deletedAt: null,
    });
    if (activeCircleCount > 0) {
      throw new ConflictError(
        "This supervisor still has circles assigned and cannot be removed — reassign their circles first",
      );
    }
  }

  user.deletedAt = new Date();
  user.isActive = false;
  await user.save();
  return user;
}
