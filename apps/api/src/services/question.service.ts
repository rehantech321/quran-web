import mongoose, { Types } from "mongoose";

import { ConflictError, NotFoundError } from "../errors.js";
import { QuestionAnswer } from "../models/QuestionAnswer.js";
import { Student } from "../models/Student.js";
import { WeeklyQuestion } from "../models/WeeklyQuestion.js";
import { awardPoints } from "./points.service.js";

const DUPLICATE_KEY_ERROR_CODE = 11000;

export interface AnswerQuestionParams {
  organizationId: Types.ObjectId;
  questionId: Types.ObjectId;
  studentId: Types.ObjectId;
  selectedOptionKey: string;
}

/** Grades a student's single attempt at a weekly question and awards points if correct. */
export async function answerQuestion(params: AnswerQuestionParams) {
  const question = await WeeklyQuestion.findOne({
    _id: params.questionId,
    organizationId: params.organizationId,
    isPublished: true,
  }).lean();
  if (!question) throw new NotFoundError("question");

  const student = await Student.findOne({
    _id: params.studentId,
    organizationId: params.organizationId,
    deletedAt: null,
  }).lean();
  if (!student) throw new NotFoundError("student");
  if (String(student.circleId) !== String(question.circleId)) {
    throw new ConflictError("student_not_in_question_circle");
  }

  const alreadyAnswered = await QuestionAnswer.findOne({
    questionId: params.questionId,
    studentId: params.studentId,
  });
  if (alreadyAnswered) throw new ConflictError("question_already_answered");

  const isCorrect = params.selectedOptionKey === question.correctOptionKey;
  const pointsAwarded = isCorrect ? question.points : 0;

  const session = await mongoose.startSession();
  try {
    let answer: InstanceType<typeof QuestionAnswer> | undefined;
    await session.withTransaction(async () => {
      try {
        const [created] = await QuestionAnswer.create(
          [
            {
              organizationId: params.organizationId,
              questionId: params.questionId,
              studentId: params.studentId,
              selectedOptionKey: params.selectedOptionKey,
              isCorrect,
              pointsAwarded,
              answeredAt: new Date(),
            },
          ],
          { session },
        );
        answer = created;
      } catch (err) {
        if (isDuplicateKeyError(err))
          throw new ConflictError("question_already_answered");
        throw err;
      }

      if (pointsAwarded > 0) {
        await awardPoints({
          organizationId: params.organizationId,
          circleId: question.circleId,
          studentId: params.studentId,
          source: "question",
          sourceRefId: answer!._id,
          points: pointsAwarded,
          reason: "ledger.question.correct",
          createdBy: undefined,
          session,
        });
      }
    });
    return { answer: answer!, question };
  } finally {
    await session.endSession();
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === DUPLICATE_KEY_ERROR_CODE
  );
}
