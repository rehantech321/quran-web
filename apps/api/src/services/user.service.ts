import type { Types } from "mongoose";

import type { CreateUserInput, Role, UpdateUserInput } from "@halaqat/shared";

import { NotFoundError, ValidationError } from "../errors.js";
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

export async function createStaffMember(
  organizationId: string,
  creatorRole: Role,
  input: CreateUserInput,
) {
  assertCreatableRole(creatorRole, input.role);
  const passwordHash = await hashPassword(input.password);
  return User.create({
    organizationId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: input.role,
    avatarUrl: input.avatarUrl,
  });
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

  await user.save();
  return user;
}
