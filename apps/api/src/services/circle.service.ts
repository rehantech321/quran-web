import type { Types } from "mongoose";

import type { CreateCircleInput, UpdateCircleInput } from "@halaqat/shared";

import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { Circle } from "../models/Circle.js";
import { Student } from "../models/Student.js";
import { User } from "../models/User.js";

export async function listCircles(
  organizationId: string,
  filter: { supervisorId?: string } = {},
) {
  return Circle.find({
    organizationId,
    deletedAt: null,
    ...(filter.supervisorId ? { supervisorId: filter.supervisorId } : {}),
  }).sort({ name: 1 });
}

export async function getCircle(
  organizationId: string,
  circleId: Types.ObjectId | string,
) {
  const circle = await Circle.findOne({ _id: circleId, organizationId, deletedAt: null });
  if (!circle) throw new NotFoundError("circle");
  return circle;
}

async function assertSupervisorInOrg(organizationId: string, supervisorId: string) {
  const supervisor = await User.findOne({
    _id: supervisorId,
    organizationId,
    role: "supervisor",
    isActive: true,
    deletedAt: null,
  });
  if (!supervisor)
    throw new ValidationError(
      "supervisorId must reference an active supervisor in this organization",
    );
}

export async function createCircle(organizationId: string, input: CreateCircleInput) {
  await assertSupervisorInOrg(organizationId, input.supervisorId);
  return Circle.create({
    organizationId,
    name: input.name,
    supervisorId: input.supervisorId,
    description: input.description,
    schedule: input.schedule,
    pointsConfigOverride: input.pointsConfigOverride,
  });
}

export async function updateCircle(
  organizationId: string,
  circleId: Types.ObjectId | string,
  updates: UpdateCircleInput,
) {
  const circle = await getCircle(organizationId, circleId);

  if (updates.supervisorId) {
    await assertSupervisorInOrg(organizationId, updates.supervisorId);
    circle.supervisorId = updates.supervisorId as unknown as Types.ObjectId;
  }
  if (updates.name !== undefined) circle.name = updates.name;
  if (updates.description !== undefined) circle.description = updates.description;
  if (updates.isActive !== undefined) circle.isActive = updates.isActive;
  if (updates.schedule) Object.assign(circle.schedule, updates.schedule);
  if (updates.pointsConfigOverride) {
    circle.pointsConfigOverride = {
      ...circle.pointsConfigOverride,
      ...updates.pointsConfigOverride,
    };
  }

  await circle.save();
  return circle;
}

/** Soft-deletes a circle. Refuses if it still has active students — move or deactivate them first. */
export async function deleteCircle(
  organizationId: string,
  circleId: Types.ObjectId | string,
) {
  const circle = await getCircle(organizationId, circleId);

  const activeStudentCount = await Student.countDocuments({
    circleId: circle._id,
    isActive: true,
    deletedAt: null,
  });
  if (activeStudentCount > 0) {
    throw new ConflictError("circle_has_active_students");
  }

  circle.deletedAt = new Date();
  circle.isActive = false;
  await circle.save();
  return circle;
}
