import { Router } from "express";
import { z } from "zod";

import {
  answerQuestionSchema,
  createQuestionSchema,
  objectIdSchema,
  questionQuerySchema,
  updateQuestionSchema,
} from "@halaqat/shared";

import { requireAuth, requireRole, requireStudentAuth } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  answerQuestion,
  createQuestion,
  getActiveQuestionForStudent,
  getQuestion,
  listQuestions,
  publishQuestion,
  updateQuestion,
} from "../services/question.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

const questionIdParamSchema = z.object({ id: objectIdSchema });

export function createQuestionsRouter() {
  const router = Router();

  router.get("/active", requireStudentAuth, async (req, res) => {
    const question = await getActiveQuestionForStudent(
      req.student!.organizationId as never,
      req.student!.id as never,
    );
    res.json({ success: true, data: question });
  });

  router.post(
    "/:id/answer",
    requireStudentAuth,
    validateParams(questionIdParamSchema),
    validateBody(answerQuestionSchema),
    async (req, res) => {
      const result = await answerQuestion({
        organizationId: req.student!.organizationId as never,
        questionId: req.params.id as never,
        studentId: req.student!.id as never,
        selectedOptionKey: req.body.selectedOptionKey,
      });
      res.json({ success: true, data: result });
    },
  );

  router.use(requireAuth, requireRole("admin", "super_admin", "supervisor"));

  router.get("/", validateQuery(questionQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof questionQuerySchema>;
    if (query.circleId) {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.circleId,
      );
    }
    const questions = await listQuestions(req.user!.organizationId as never, query);
    res.json({ success: true, data: questions });
  });

  router.post("/", validateBody(createQuestionSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const question = await createQuestion(
      req.user!.organizationId as never,
      req.user!.id as never,
      req.body,
    );
    res.status(201).json({ success: true, data: question });
  });

  router.patch(
    "/:id",
    validateParams(questionIdParamSchema),
    validateBody(updateQuestionSchema),
    async (req, res) => {
      const existing = await getQuestion(
        req.user!.organizationId as never,
        req.params.id!,
      );
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        existing.circleId.toString(),
      );
      const question = await updateQuestion(
        req.user!.organizationId as never,
        req.params.id!,
        req.body,
      );
      res.json({ success: true, data: question });
    },
  );

  router.post("/:id/publish", validateParams(questionIdParamSchema), async (req, res) => {
    const existing = await getQuestion(req.user!.organizationId as never, req.params.id!);
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      existing.circleId.toString(),
    );
    const question = await publishQuestion(
      req.user!.organizationId as never,
      req.params.id!,
    );
    res.json({ success: true, data: question });
  });

  return router;
}
