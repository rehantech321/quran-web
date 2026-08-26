import "dotenv/config";

import mongoose from "mongoose";

import { DEFAULT_THEME } from "@halaqat/shared";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  AttendanceRecord,
  Circle,
  CircleGrade,
  Organization,
  QuestionAnswer,
  Student,
  TaskSubmission,
  User,
  WeeklyQuestion,
  WeeklyTask,
} from "../models/index.js";
import { hashPassword } from "../models/User.js";
import {
  ADMIN_NAME,
  CIRCLE_NAMES,
  MEMORIZATION_LEVELS,
  PARENT_PHONE_PREFIX,
  STUDENT_NAMES,
  SUPERVISOR_NAMES,
  studentAvatarUrl,
} from "./seedData.js";

const SEED_PASSWORD = "Halaqat@2026";

async function wipeDatabase() {
  await Promise.all([
    Organization.deleteMany({}),
    User.deleteMany({}),
    Circle.deleteMany({}),
    Student.deleteMany({}),
    AttendanceRecord.deleteMany({}),
    CircleGrade.deleteMany({}),
    WeeklyQuestion.deleteMany({}),
    QuestionAnswer.deleteMany({}),
    WeeklyTask.deleteMany({}),
    TaskSubmission.deleteMany({}),
  ]);
}

async function main() {
  if (env.NODE_ENV === "production" && process.env.SEED_FORCE !== "true") {
    throw new Error(
      "Refusing to run the seed script against NODE_ENV=production without SEED_FORCE=true. " +
        "This script wipes all data.",
    );
  }

  await mongoose.connect(env.MONGODB_URI);
  logger.info("Connected to MongoDB — wiping existing data");
  await wipeDatabase();

  const org = await Organization.create({
    name: "جامع الصِّدِّيق",
    nameEn: "Jami' Al-Siddiq",
    slug: "jami-al-siddiq",
    tagline: "حلقة متميزة .. طالب محفز .. أجر باقٍ بإذن الله",
    timezone: "Asia/Riyadh",
    theme: DEFAULT_THEME,
    requireStudentPin: false,
  });

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const admin = await User.create({
    organizationId: org._id,
    fullName: ADMIN_NAME,
    email: "admin@jami-al-siddiq.test",
    passwordHash,
    role: "admin",
    isActive: true,
  });

  const supervisors = await User.insertMany(
    SUPERVISOR_NAMES.map((fullName, i) => ({
      organizationId: org._id,
      fullName,
      email: `supervisor${i + 1}@jami-al-siddiq.test`,
      passwordHash,
      role: "supervisor" as const,
      isActive: true,
    })),
  );

  // 3 circles across 2 supervisors (first supervisor runs two circles).
  const circleSupervisorIds = [
    supervisors[0]!._id,
    supervisors[1]!._id,
    supervisors[0]!._id,
  ];
  const circles = await Circle.insertMany(
    CIRCLE_NAMES.map((name, i) => ({
      organizationId: org._id,
      name,
      supervisorId: circleSupervisorIds[i],
      schedule: {
        days: [0, 2, 4], // Sun/Tue/Thu
        startTime: "19:45",
        lateAfter: "20:15",
      },
      isActive: true,
    })),
  );

  const studentsPerCircle = 10;
  const studentDocs = STUDENT_NAMES.map((fullName, i) => {
    const circle = circles[Math.floor(i / studentsPerCircle)]!;
    return {
      organizationId: org._id,
      circleId: circle._id,
      fullName,
      photoUrl: studentAvatarUrl(fullName),
      parentPhone: `${PARENT_PHONE_PREFIX}${String(10000000 + i).slice(0, 8)}`,
      level: MEMORIZATION_LEVELS[i % MEMORIZATION_LEVELS.length],
      isActive: true,
    };
  });
  // insertMany with a plain object array skips Mongoose defaults for `accessSlug`/
  // `barcodeValue` unless documents are created via `Model.create`, so build each
  // student individually to run the schema's default + pre-validate hook.
  const students = [];
  for (const doc of studentDocs) {
    students.push(await Student.create(doc));
  }

  logger.info(
    {
      organization: org.name,
      admin: admin.email,
      supervisors: supervisors.map((s) => s.email),
      circles: circles.length,
      students: students.length,
    },
    "Base seed data created. Run again after Phase 3 lands for attendance/grades/questions/tasks history.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
