import { Schema, Types, model } from "mongoose";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface QuestionAnswerFields {
  organizationId: Types.ObjectId;
  questionId: Types.ObjectId;
  studentId: Types.ObjectId;
  selectedOptionKey: string;
  isCorrect: boolean;
  pointsAwarded: number;
  answeredAt: Date;
  deletedAt: Date | null;
}

const questionAnswerSchema = new Schema<QuestionAnswerFields>({
  questionId: { type: Schema.Types.ObjectId, ref: "WeeklyQuestion", required: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  selectedOptionKey: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
  pointsAwarded: { type: Number, required: true },
  answeredAt: { type: Date, required: true, default: () => new Date() },
});

questionAnswerSchema.plugin(orgScopedPlugin);

// One attempt per student per question — see SPEC.md §4.
questionAnswerSchema.index({ questionId: 1, studentId: 1 }, { unique: true });

export const QuestionAnswer = model<QuestionAnswerFields>(
  "QuestionAnswer",
  questionAnswerSchema,
);
