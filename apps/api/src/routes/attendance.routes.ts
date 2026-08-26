import { Router } from "express";
import { z } from "zod";

import {
  attendanceQuerySchema,
  closeSessionSchema,
  manualAttendanceSchema,
  objectIdSchema,
  scanAttendanceSchema,
  updateAttendanceSchema,
} from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  closeSession,
  getAttendanceRecord,
  getAttendanceRoster,
  recordManualAttendance,
  scanAttendance,
  updateAttendanceRecord,
} from "../services/attendance.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

const attendanceIdParamSchema = z.object({ id: objectIdSchema });

export function createAttendanceRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("admin", "super_admin", "supervisor"));

  router.post("/scan", validateBody(scanAttendanceSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const result = await scanAttendance({
      organizationId: req.user!.organizationId as never,
      circleId: req.body.circleId,
      barcodeValue: req.body.barcodeValue,
      recordedBy: req.user!.id as never,
    });
    res.json({ success: true, data: result });
  });

  router.post("/manual", validateBody(manualAttendanceSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const record = await recordManualAttendance({
      organizationId: req.user!.organizationId as never,
      circleId: req.body.circleId,
      studentId: req.body.studentId,
      sessionDate: req.body.sessionDate,
      status: req.body.status,
      note: req.body.note,
      recordedBy: req.user!.id as never,
    });
    res.status(201).json({ success: true, data: record });
  });

  router.get("/", validateQuery(attendanceQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof attendanceQuerySchema>;
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      query.circleId,
    );
    const roster = await getAttendanceRoster(
      req.user!.organizationId as never,
      query.circleId as never,
      query.date,
    );
    res.json({ success: true, data: roster });
  });

  router.post("/close-session", validateBody(closeSessionSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const result = await closeSession({
      organizationId: req.user!.organizationId as never,
      circleId: req.body.circleId,
      sessionDate: req.body.sessionDate,
      recordedBy: req.user!.id as never,
    });
    res.json({ success: true, data: result });
  });

  router.patch(
    "/:id",
    validateParams(attendanceIdParamSchema),
    validateBody(updateAttendanceSchema),
    async (req, res) => {
      // Look up (and org/ownership-check) before mutating — never let the write
      // happen and only reject after the fact.
      const existing = await getAttendanceRecord(
        req.user!.organizationId as never,
        req.params.id!,
      );
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        existing.circleId.toString(),
      );
      const record = await updateAttendanceRecord({
        attendanceId: req.params.id as never,
        status: req.body.status,
        note: req.body.note,
        updatedBy: req.user!.id as never,
      });
      res.json({ success: true, data: record });
    },
  );

  return router;
}
