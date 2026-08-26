import { z } from "zod";

import { objectIdSchema } from "./common.js";

export const optionKeySchema = z.enum(["A", "B", "C", "D", "E", "F"]);

export const questionOptionSchema = z.object({
  key: optionKeySchema,
  text: z.string().min(1).max(500),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

const optionsRefinement = <
  T extends { options: QuestionOption[]; correctOptionKey: string },
>(
  data: T,
  ctx: z.RefinementCtx,
) => {
  const keys: string[] = data.options.map((o) => o.key);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "duplicate_option_keys",
      path: ["options"],
    });
  }
  if (!keys.includes(data.correctOptionKey)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "correct_option_key_not_in_options",
      path: ["correctOptionKey"],
    });
  }
};

export const createQuestionSchema = z
  .object({
    circleId: objectIdSchema,
    weekOf: z.coerce.date(),
    questionText: z.string().min(1).max(1000),
    options: z.array(questionOptionSchema).min(2).max(6),
    correctOptionKey: optionKeySchema,
    points: z.number().int().min(0).optional(),
    explanation: z.string().max(2000).optional(),
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    isPublished: z.boolean().default(false),
  })
  .superRefine(optionsRefinement);
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    weekOf: z.coerce.date().optional(),
    questionText: z.string().min(1).max(1000).optional(),
    options: z.array(questionOptionSchema).min(2).max(6).optional(),
    correctOptionKey: optionKeySchema.optional(),
    points: z.number().int().min(0).optional(),
    explanation: z.string().max(2000).optional(),
    opensAt: z.coerce.date().optional(),
    closesAt: z.coerce.date().optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.options && data.correctOptionKey) {
      optionsRefinement(
        { options: data.options, correctOptionKey: data.correctOptionKey },
        ctx,
      );
    }
  });
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const answerQuestionSchema = z.object({
  selectedOptionKey: optionKeySchema,
});
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;

export const questionQuerySchema = z.object({
  circleId: objectIdSchema.optional(),
});
export type QuestionQuery = z.infer<typeof questionQuerySchema>;
