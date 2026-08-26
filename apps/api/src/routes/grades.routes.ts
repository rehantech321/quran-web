import { Router } from "express";
import { z } from "zod";

import {
  createGradeSchema,
  gradeQuerySchema,
  objectIdSchema,
  updateGradeSchema,
} from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  getGrade,
  listGrades,
  recordGrade,
  updateGrade,
} from "../services/grade.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

const gradeIdParamSchema = z.object({ id: objectIdSchema });

export function createGradesRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("admin", "super_admin", "supervisor"));

  router.get("/", validateQuery(gradeQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof gradeQuerySchema>;
    if (query.circleId) {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.circleId,
      );
    }
    const grades = await listGrades(req.user!.organizationId as never, query);
    res.json({ success: true, data: grades });
  });

  router.post("/", validateBody(createGradeSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const grade = await recordGrade({
      organizationId: req.user!.organizationId as never,
      circleId: req.body.circleId,
      studentId: req.body.studentId,
      weekOf: req.body.weekOf,
      grade: req.body.grade,
      points: req.body.points,
      notes: req.body.notes,
      recordedBy: req.user!.id as never,
    });
    res.status(201).json({ success: true, data: grade });
  });

  router.patch(
    "/:id",
    validateParams(gradeIdParamSchema),
    validateBody(updateGradeSchema),
    async (req, res) => {
      const existing = await getGrade(req.user!.organizationId as never, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        existing.circleId.toString(),
      );
      const grade = await updateGrade({
        gradeId: req.params.id as never,
        grade: req.body.grade,
        points: req.body.points,
        notes: req.body.notes,
        updatedBy: req.user!.id as never,
      });
      res.json({ success: true, data: grade });
    },
  );

  return router;
}
