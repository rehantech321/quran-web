import mongoose, { Types } from "mongoose";

import type { CreateQuestionInput, UpdateQuestionInput } from "@halaqat/shared";

import { ConflictError, NotFoundError } from "../errors.js";
import { Circle } from "../models/Circle.js";
import { Organization } from "../models/Organization.js";
import { QuestionAnswer } from "../models/QuestionAnswer.js";
import { Student } from "../models/Student.js";
import { WeeklyQuestion } from "../models/WeeklyQuestion.js";
import { awardPoints, resolveEffectivePointsConfig } from "./points.service.js";

const DUPLICATE_KEY_ERROR_CODE = 11000;

export async function listQuestions(
  organizationId: Types.ObjectId,
  filter: { circleId?: string } = {},
) {
  return WeeklyQuestion.find({
    organizationId,
    ...(filter.circleId ? { circleId: filter.circleId } : {}),
  }).sort({ weekOf: -1, createdAt: -1 });
}

export async function getQuestion(
  organizationId: Types.ObjectId,
  questionId: Types.ObjectId | string,
) {
  const question = await WeeklyQuestion.findOne({ _id: questionId, organizationId });
  if (!question) throw new NotFoundError("question");
  return question;
}

/** `points` defaults to the circle's/org's configured defaultQuestionPoints — see SPEC.md §4. */
export async function createQuestion(
  organizationId: Types.ObjectId,
  createdBy: Types.ObjectId,
  input: CreateQuestionInput,
) {
  let points = input.points;
  if (points === undefined) {
    const [org, circle] = await Promise.all([
      Organization.findById(organizationId).lean(),
      Circle.findOne({ _id: input.circleId, organizationId }).lean(),
    ]);
    if (!org) throw new NotFoundError("organization");
    points = resolveEffectivePointsConfig(
      org.pointsConfig,
      circle?.pointsConfigOverride,
    ).defaultQuestionPoints;
  }
  return WeeklyQuestion.create({ organizationId, createdBy, ...input, points });
}

export async function updateQuestion(
  organizationId: Types.ObjectId,
  questionId: Types.ObjectId | string,
  updates: UpdateQuestionInput,
) {
  const question = await getQuestion(organizationId, questionId);
  Object.assign(question, updates);
  await question.save();
  return question;
}

export async function publishQuestion(
  organizationId: Types.ObjectId,
  questionId: Types.ObjectId | string,
) {
  const question = await getQuestion(organizationId, questionId);
  question.isPublished = true;
  await question.save();
  return question;
}

/**
 * The active, unanswered, published question for a student's circle right now
 * (or null). Strips the correct answer/explanation — those only reveal once
 * `answerQuestion` has graded an attempt, so a student can't inspect the
 * response payload to cheat.
 */
export async function getActiveQuestionForStudent(
  organizationId: Types.ObjectId,
  studentId: Types.ObjectId,
) {
  const student = await Student.findOne({
    _id: studentId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!student) throw new NotFoundError("student");

  const now = new Date();
  const candidates = await WeeklyQuestion.find({
    organizationId,
    circleId: student.circleId,
    isPublished: true,
    $and: [
      { $or: [{ opensAt: { $exists: false } }, { opensAt: { $lte: now } }] },
      { $or: [{ closesAt: { $exists: false } }, { closesAt: { $gte: now } }] },
    ],
  }).sort({ weekOf: -1 });

  for (const question of candidates) {
    const answered = await QuestionAnswer.findOne({
      questionId: question._id,
      studentId,
    });
    if (!answered) {
      const {
        correctOptionKey: _correctOptionKey,
        explanation: _explanation,
        ...safe
      } = question.toObject();
      return safe;
    }
  }
  return null;
}

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
    throw new ConflictError("This question is not for your circle");
  }

  const alreadyAnswered = await QuestionAnswer.findOne({
    questionId: params.questionId,
    studentId: params.studentId,
  });
  if (alreadyAnswered) throw new ConflictError("You have already answered this question");

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
          throw new ConflictError("You have already answered this question");
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
