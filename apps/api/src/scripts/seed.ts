import "dotenv/config";

import { startOfWeek, subWeeks } from "date-fns";
import mongoose, { type Types } from "mongoose";

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
import { recordManualAttendance } from "../services/attendance.service.js";
import { recordGrade } from "../services/grade.service.js";
import { answerQuestion } from "../services/question.service.js";
import {
  approveSubmission,
  rejectSubmission,
  updateSubmissionStatus,
} from "../services/task.service.js";
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
const HISTORY_WEEKS = 6;

/** Weighted toward "present" so the seeded circles look like a normal healthy class. */
function randomAttendanceStatus(): "present" | "late" | "absent" | "excused" {
  const roll = Math.random();
  if (roll < 0.65) return "present";
  if (roll < 0.8) return "late";
  if (roll < 0.95) return "absent";
  return "excused";
}

function randomGrade(): number {
  return Math.round(60 + Math.random() * 40); // 60–100
}

/** Arbitrary seed-only mapping from a 0–100 grade to a small points award. */
function pointsFromGrade(grade: number): number {
  return Math.round(grade / 5); // 12–20
}

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

  const supervisorByCircle = new Map(
    circles.map((c, i) => [String(c._id), circleSupervisorIds[i]!]),
  );

  // 6 weeks of attendance + grades, one session/grade per student per week.
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, i) =>
    startOfWeek(subWeeks(new Date(), HISTORY_WEEKS - 1 - i), { weekStartsOn: 6 }),
  );

  logger.info(
    "Seeding %d weeks of attendance and grades for %d students…",
    HISTORY_WEEKS,
    students.length,
  );
  for (const student of students) {
    const recordedBy = supervisorByCircle.get(String(student.circleId))!;
    for (const weekOf of weeks) {
      const status = randomAttendanceStatus();
      await recordManualAttendance({
        organizationId: org._id,
        circleId: student.circleId as Types.ObjectId,
        studentId: student._id,
        sessionDate: weekOf,
        status,
        recordedBy,
      });

      const grade = randomGrade();
      await recordGrade({
        organizationId: org._id,
        circleId: student.circleId as Types.ObjectId,
        studentId: student._id,
        weekOf,
        grade,
        points: pointsFromGrade(grade),
        notes: grade >= 90 ? "أداء ممتاز وتلاوة متقنة" : undefined,
        recordedBy,
      });
    }
  }

  // 4 weekly questions — one extra for the first circle — answered by every
  // student in the question's circle, ~75% correctly.
  logger.info("Seeding weekly questions and answers…");
  const questionsSpec = [
    {
      circle: circles[0]!,
      questionText: "كم عدد آيات سورة الكهف؟",
      options: [
        { key: "A", text: "110" },
        { key: "B", text: "111" },
        { key: "C", text: "112" },
      ],
      correctOptionKey: "B",
      explanation:
        "عدد آيات سورة الكهف 110 آيات في قول، لكن المعتمد هنا في هذا المثال 111.",
    },
    {
      circle: circles[0]!,
      questionText: "من هو مؤذن رسول الله صلى الله عليه وسلم؟",
      options: [
        { key: "A", text: "بلال بن رباح" },
        { key: "B", text: "عبد الله بن مسعود" },
      ],
      correctOptionKey: "A",
    },
    {
      circle: circles[1]!,
      questionText: "في أي سورة توجد آية الكرسي؟",
      options: [
        { key: "A", text: "سورة آل عمران" },
        { key: "B", text: "سورة البقرة" },
        { key: "C", text: "سورة النساء" },
      ],
      correctOptionKey: "B",
    },
    {
      circle: circles[2]!,
      questionText: "كم عدد أجزاء القرآن الكريم؟",
      options: [
        { key: "A", text: "28" },
        { key: "B", text: "29" },
        { key: "C", text: "30" },
      ],
      correctOptionKey: "C",
    },
  ];

  for (const spec of questionsSpec) {
    const createdBy = supervisorByCircle.get(String(spec.circle._id))!;
    const question = await WeeklyQuestion.create({
      organizationId: org._id,
      circleId: spec.circle._id,
      weekOf: weeks[weeks.length - 1]!,
      questionText: spec.questionText,
      options: spec.options,
      correctOptionKey: spec.correctOptionKey,
      points: 20,
      explanation: spec.explanation,
      createdBy,
      isPublished: true,
    });

    const circleStudents = students.filter(
      (s) => String(s.circleId) === String(spec.circle._id),
    );
    for (const student of circleStudents) {
      const answerCorrectly = Math.random() < 0.75;
      const wrongOption = spec.options.find((o) => o.key !== spec.correctOptionKey);
      await answerQuestion({
        organizationId: org._id,
        questionId: question._id,
        studentId: student._id,
        selectedOptionKey: answerCorrectly ? spec.correctOptionKey : wrongOption!.key,
      });
    }
  }

  // 3 tasks, one per circle, with submissions spanning every state so every
  // screen (My Tasks, Approvals queue) has something to show on first run.
  logger.info("Seeding weekly tasks with submissions in every state…");
  const taskTitles = [
    "حفظ سورة الملك (الآيات 1-10)",
    "مراجعة جزء عم",
    "حفظ دعاء ختم القرآن",
  ];
  for (const [i, circle] of circles.entries()) {
    const createdBy = supervisorByCircle.get(String(circle._id))!;
    const task = await WeeklyTask.create({
      organizationId: org._id,
      circleId: circle._id,
      title: taskTitles[i],
      points: 15,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      assignedTo: "circle",
      createdBy,
      isPublished: true,
    });

    const circleStudents = students.filter(
      (s) => String(s.circleId) === String(circle._id),
    );
    // Cycle every student in the circle through one of the five lifecycle
    // states so the demo data is never just "everyone approved".
    const states = [
      "not_started",
      "in_progress",
      "completed_pending",
      "approved",
      "rejected",
    ] as const;
    for (const [j, student] of circleStudents.entries()) {
      const state = states[j % states.length]!;
      if (state === "not_started") continue; // no submission record yet — the default state

      const submission = await updateSubmissionStatus({
        organizationId: org._id,
        taskId: task._id,
        studentId: student._id,
        status: state === "in_progress" ? "in_progress" : "completed",
        studentNote:
          state === "in_progress" ? "بدأت الحفظ، سأكمل قريبًا" : "أتممت الحفظ بحمد الله",
      });

      if (state === "approved") {
        await approveSubmission({ submissionId: submission._id, approvedBy: createdBy });
      } else if (state === "rejected") {
        await rejectSubmission({
          submissionId: submission._id,
          rejectionReason: "الرجاء إعادة التسميع مع المشرف",
          rejectedBy: createdBy,
        });
      }
    }
  }

  logger.info(
    {
      organization: org.name,
      admin: admin.email,
      supervisors: supervisors.map((s) => s.email),
      circles: circles.length,
      students: students.length,
      weeksOfHistory: HISTORY_WEEKS,
      questions: questionsSpec.length,
      tasks: circles.length,
    },
    "Seed complete.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
