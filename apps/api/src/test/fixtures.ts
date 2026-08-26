import { Types } from "mongoose";

import { DEFAULT_THEME } from "@halaqat/shared";

import { Circle } from "../models/Circle.js";
import { Organization } from "../models/Organization.js";
import { Student } from "../models/Student.js";
import { User, hashPassword } from "../models/User.js";

export async function createTestOrg(
  overrides: Partial<{ timezone: string; pointsConfig: Record<string, unknown> }> = {},
) {
  return Organization.create({
    name: "جامع الاختبار",
    slug: `test-org-${new Types.ObjectId().toHexString()}`,
    theme: DEFAULT_THEME,
    timezone: overrides.timezone ?? "Asia/Riyadh",
    pointsConfig: overrides.pointsConfig,
  });
}

export const TEST_PASSWORD = "Test@12345";

export async function createTestSupervisor(organizationId: Types.ObjectId) {
  return User.create({
    organizationId,
    fullName: "مشرف الاختبار",
    email: `supervisor-${new Types.ObjectId().toHexString()}@test.local`,
    phone: `+9665${Math.floor(10000000 + Math.random() * 89999999)}`,
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: "supervisor",
  });
}

export async function createTestCircle(
  organizationId: Types.ObjectId,
  supervisorId: Types.ObjectId,
  overrides: Partial<{
    startTime: string;
    lateAfter: string;
    pointsConfigOverride: Record<string, unknown>;
  }> = {},
) {
  return Circle.create({
    organizationId,
    name: "حلقة الاختبار",
    supervisorId,
    schedule: {
      days: [0, 1, 2, 3, 4, 5, 6],
      startTime: overrides.startTime ?? "19:45",
      lateAfter: overrides.lateAfter ?? "20:15",
    },
    pointsConfigOverride: overrides.pointsConfigOverride,
  });
}

export async function createTestStudent(
  organizationId: Types.ObjectId,
  circleId: Types.ObjectId,
) {
  return Student.create({
    organizationId,
    circleId,
    fullName: "طالب الاختبار",
    parentPhone: "+966500000000",
  });
}
