import { Schema, Types, model } from "mongoose";

import { orgScopedPlugin } from "./plugins/orgScoped.js";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface WeeklyQuestionFields {
  organizationId: Types.ObjectId;
  circleId: Types.ObjectId;
  weekOf: Date;
  questionText: string;
  options: QuestionOption[];
  correctOptionKey: string;
  points: number;
  explanation?: string;
  opensAt?: Date;
  closesAt?: Date;
  createdBy: Types.ObjectId;
  isPublished: boolean;
  deletedAt: Date | null;
}

const questionOptionSchema = new Schema<QuestionOption>(
  {
    key: { type: String, required: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const weeklyQuestionSchema = new Schema<WeeklyQuestionFields>({
  circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  weekOf: { type: Date, required: true },
  questionText: { type: String, required: true, trim: true },
  options: {
    type: [questionOptionSchema],
    required: true,
    validate: {
      validator: (options: QuestionOption[]) =>
        options.length >= 2 && options.length <= 6,
      message: "options_must_have_between_2_and_6_entries",
    },
  },
  correctOptionKey: { type: String, required: true },
  points: { type: Number, required: true },
  explanation: { type: String, trim: true },
  opensAt: { type: Date },
  closesAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isPublished: { type: Boolean, default: false },
});

weeklyQuestionSchema.plugin(orgScopedPlugin);
weeklyQuestionSchema.index({ organizationId: 1, circleId: 1, weekOf: 1 });

export const WeeklyQuestion = model<WeeklyQuestionFields>(
  "WeeklyQuestion",
  weeklyQuestionSchema,
);
