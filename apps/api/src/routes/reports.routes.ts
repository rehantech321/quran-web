import { Router } from "express";
import { z } from "zod";

import {
  circleIdParamSchema,
  leaderboardQuerySchema,
  reportDateRangeQuerySchema,
  reportExportQuerySchema,
  studentIdParamSchema,
} from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { getStudent } from "../services/student.service.js";
import {
  exportCircleReport,
  exportStudentReport,
  getCircleReport,
  getLeaderboard,
  getStudentReport,
} from "../services/report.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

export function createReportsRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("admin", "super_admin", "supervisor"));

  router.get(
    "/circle/:id",
    validateParams(circleIdParamSchema),
    validateQuery(reportDateRangeQuerySchema),
    async (req, res) => {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        req.params.id!,
      );
      const query = req.query as unknown as z.infer<typeof reportDateRangeQuerySchema>;
      const report = await getCircleReport(
        req.user!.organizationId,
        req.params.id!,
        query,
      );
      res.json({ success: true, data: report });
    },
  );

  router.get("/student/:id", validateParams(studentIdParamSchema), async (req, res) => {
    const student = await getStudent(req.user!.organizationId, req.params.id!);
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      student.circleId.toString(),
    );
    const report = await getStudentReport(req.user!.organizationId, req.params.id!);
    res.json({ success: true, data: report });
  });

  router.get("/leaderboard", validateQuery(leaderboardQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof leaderboardQuerySchema>;
    if (query.circleId) {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.circleId,
      );
    }
    const leaderboard = await getLeaderboard(req.user!.organizationId, query);
    res.json({ success: true, data: leaderboard });
  });

  router.get("/export", validateQuery(reportExportQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof reportExportQuerySchema>;

    if (query.type === "circle") {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.id,
      );
      const result = await exportCircleReport(
        req.user!.organizationId,
        query.id,
        query.format,
      );
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
      return;
    }

    const student = await getStudent(req.user!.organizationId, query.id);
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      student.circleId.toString(),
    );
    const result = await exportStudentReport(
      req.user!.organizationId,
      query.id,
      query.format,
    );
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  });

  return router;
}
