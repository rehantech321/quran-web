import { unlink } from "node:fs/promises";
import path from "node:path";

import { Router } from "express";
import { z } from "zod";

import {
  circleIdParamSchema,
  createStudentSchema,
  pointsHistoryQuerySchema,
  studentIdParamSchema,
  updateStudentSchema,
} from "@halaqat/shared";

import { env } from "../config/env.js";
import { ValidationError } from "../errors.js";
import { requireAuth, requireRole, requireStudentAuth } from "../middleware/auth.js";
import { STUDENT_PHOTOS_DIR, uploadStudentPhoto } from "../middleware/upload.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { getStudentReport } from "../services/report.service.js";
import {
  createStudent,
  deleteStudent,
  generateStudentQrPng,
  getMyStudentProfile,
  getStudent,
  getStudentPointsHistory,
  listStudentsByCircle,
  regenerateStudentSlug,
  updateStudent,
} from "../services/student.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

export function createStudentsRouter() {
  const router = Router();

  // Student-scoped: registered before the staff-only gate below (same
  // rationale as questions/tasks routers — see DECISIONS.md Phase 6).
  router.get("/students/me", requireStudentAuth, async (req, res) => {
    const profile = await getMyStudentProfile(
      req.student!.organizationId,
      req.student!.id,
    );
    res.json({ success: true, data: profile });
  });

  router.get(
    "/students/me/points-history",
    requireStudentAuth,
    validateQuery(pointsHistoryQuerySchema),
    async (req, res) => {
      const query = req.query as unknown as z.infer<typeof pointsHistoryQuerySchema>;
      const history = await getStudentPointsHistory(
        req.student!.organizationId,
        req.student!.id,
        query,
      );
      res.json({ success: true, data: history });
    },
  );

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

  const UPLOADS_URL_PREFIX = "/api/v1/uploads/students/";

  router.post(
    "/students/:id/photo",
    requireRole("admin", "super_admin", "supervisor"),
    validateParams(studentIdParamSchema),
    uploadStudentPhoto,
    async (req, res) => {
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
      if (!req.file) throw new ValidationError("No photo file was uploaded");

      const previousPhotoUrl = student.photoUrl;
      const photoUrl = `${env.WEB_BASE_URL}${UPLOADS_URL_PREFIX}${req.file.filename}`;
      const updated = await updateStudent(req.user!.organizationId, req.params.id!, {
        photoUrl,
      });

      // Best-effort cleanup of the file it's replacing — only ones we
      // manage (not an external URL like a seed-time avatar placeholder).
      if (previousPhotoUrl?.includes(UPLOADS_URL_PREFIX)) {
        const previousFilename = previousPhotoUrl.split(UPLOADS_URL_PREFIX)[1];
        if (previousFilename) {
          await unlink(path.join(STUDENT_PHOTOS_DIR, previousFilename)).catch(() => {});
        }
      }

      res.json({ success: true, data: updated });
    },
  );

  router.get(
    "/students/:id/qr.png",
    validateParams(studentIdParamSchema),
    async (req, res) => {
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
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
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
      const query = req.query as unknown as z.infer<typeof pointsHistoryQuerySchema>;
      const history = await getStudentPointsHistory(
        req.user!.organizationId,
        req.params.id!,
        query,
      );
      res.json({ success: true, data: history });
    },
  );

  router.get(
    "/students/:id/report",
    validateParams(studentIdParamSchema),
    async (req, res) => {
      const student = await getStudent(req.user!.organizationId, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
      const report = await getStudentReport(req.user!.organizationId, req.params.id!);
      res.json({ success: true, data: report });
    },
  );

  return router;
}
