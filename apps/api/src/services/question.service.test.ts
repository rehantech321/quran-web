import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ConflictError } from "../errors.js";
import { WeeklyQuestion } from "../models/WeeklyQuestion.js";
import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";
import { answerQuestion } from "./question.service.js";

async function createTestQuestion(
  organizationId: object,
  circleId: object,
  createdBy: object,
) {
  return WeeklyQuestion.create({
    organizationId,
    circleId,
    weekOf: new Date(),
    questionText: "كم عدد آيات سورة الكهف؟",
    options: [
      { key: "A", text: "110" },
      { key: "B", text: "111" },
    ],
    correctOptionKey: "A",
    points: 20,
    createdBy,
    isPublished: true,
  });
}

describe("question.service", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("awards points for a correct answer and none for an incorrect one", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const question = await createTestQuestion(org._id, circle._id, supervisor._id);

    const { answer } = await answerQuestion({
      organizationId: org._id,
      questionId: question._id,
      studentId: student._id,
      selectedOptionKey: "A",
    });
    expect(answer.isCorrect).toBe(true);
    expect(answer.pointsAwarded).toBe(20);
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(20);
  });

  it("enforces a single attempt per student per question", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const question = await createTestQuestion(org._id, circle._id, supervisor._id);

    await answerQuestion({
      organizationId: org._id,
      questionId: question._id,
      studentId: student._id,
      selectedOptionKey: "B",
    });

    await expect(
      answerQuestion({
        organizationId: org._id,
        questionId: question._id,
        studentId: student._id,
        selectedOptionKey: "A",
      }),
    ).rejects.toThrow(ConflictError);

    // The wrong first answer earned 0 and the rejected retry must not change that.
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(0);
  });
});
