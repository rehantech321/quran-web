import type { Types } from "mongoose";

import type { UpdateOrganizationInput } from "@halaqat/shared";

import { NotFoundError } from "../errors.js";
import { Organization } from "../models/Organization.js";

export async function getOrganization(organizationId: Types.ObjectId | string) {
  const org = await Organization.findOne({ _id: organizationId, deletedAt: null });
  if (!org) throw new NotFoundError("organization");
  return org;
}

export async function updateOrganization(
  organizationId: Types.ObjectId | string,
  updates: UpdateOrganizationInput,
) {
  const org = await getOrganization(organizationId);

  if (updates.name !== undefined) org.name = updates.name;
  if (updates.nameEn !== undefined) org.nameEn = updates.nameEn;
  if (updates.logoUrl !== undefined) org.logoUrl = updates.logoUrl;
  if (updates.tagline !== undefined) org.tagline = updates.tagline;
  if (updates.timezone !== undefined) org.timezone = updates.timezone;
  if (updates.requireStudentPin !== undefined)
    org.requireStudentPin = updates.requireStudentPin;
  if (updates.theme) Object.assign(org.theme, updates.theme);
  if (updates.pointsConfig) Object.assign(org.pointsConfig, updates.pointsConfig);
  if (updates.sessionDefaults)
    Object.assign(org.sessionDefaults, updates.sessionDefaults);

  await org.save();
  return org;
}
