import { Router } from "express";
import { z } from "zod";

import {
  circleIdParamSchema,
  createStudentSchema,
  pointsHistoryQuerySchema,
  studentIdParamSchema,
  updateStudentSchema,
} from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  createStudent,
  deleteStudent,
  generateStudentQrPng,
  getStudent,
  getStudentPointsHistory,
  listStudentsByCircle,
  regenerateStudentSlug,
  updateStudent,
} from "../services/student.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

export function createStudentsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/circles/:id/students",
    validateParams(circleIdParamSchema),
    async (req, res) => {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        req.params.id!,
      );
      const students = await listStudentsByCircle(
        req.user!.organizationId,
        req.params.id!,
      );
      res.json({ success: true, data: students });
    },
  );

  router.post(
    "/students",
    requireRole("admin", "super_admin", "supervisor"),
    validateBody(createStudentSchema),
    async (req, res) => {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        req.body.circleId,
      );
      const student = await createStudent(req.user!.organizationId, req.body);
      res.status(201).json({ success: true, data: student });
    },
  );

  router.get("/students/:id", validateParams(studentIdParamSchema), async (req, res) => {
    const student = await getStudent(req.user!.organizationId, req.params.id!);
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      student.circleId.toString(),
    );
    res.json({ success: true, data: student });
  });

  router.patch(
    "/students/:id",
    requireRole("admin", "super_admin", "supervisor"),
    validateParams(studentIdParamSchema),
    validateBody(updateStudentSchema),
    async (req, res) => {
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
      const updated = await updateStudent(
        req.user!.organizationId,
        req.params.id!,
        req.body,
      );
      res.json({ success: true, data: updated });
    },
  );

  router.delete(
    "/students/:id",
    requireRole("admin", "super_admin", "supervisor"),
    validateParams(studentIdParamSchema),
    async (req, res) => {
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
      const deleted = await deleteStudent(req.user!.organizationId, req.params.id!);
      res.json({ success: true, data: deleted });
    },
  );

  router.post(
    "/students/:id/regenerate-slug",
    requireRole("admin", "super_admin", "supervisor"),
    validateParams(studentIdParamSchema),
    async (req, res) => {
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
      const updated = await regenerateStudentSlug(
        req.user!.organizationId,
        req.params.id!,
      );
      res.json({ success: true, data: updated });
    },
  );

  router.get(
    "/students/:id/qr.png",
    validateParams(studentIdParamSchema),
    async (req, res) => {
      const png = await generateStudentQrPng(req.user!.organizationId, req.params.id!);
      res.setHeader("Content-Type", "image/png");
      res.send(png);
    },
  );

  router.get(
    "/students/:id/points-history",
    validateParams(studentIdParamSchema),
    validateQuery(pointsHistoryQuerySchema),
    async (req, res) => {
      const query = req.query as unknown as z.infer<typeof pointsHistoryQuerySchema>;
      const history = await getStudentPointsHistory(
        req.user!.organizationId,
        req.params.id!,
        query,
      );
      res.json({ success: true, data: history });
    },
  );

  return router;
}
