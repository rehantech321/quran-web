import { Router } from "express";
import { z } from "zod";

import { memorizationQuerySchema, recordMemorizationSchema } from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { listCircles } from "../services/circle.service.js";
import {
  listMemorization,
  recordMemorization,
} from "../services/memorization.service.js";
import { getStudent } from "../services/student.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

export function createMemorizationRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("admin", "super_admin", "supervisor"));

  router.get("/", validateQuery(memorizationQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof memorizationQuerySchema>;

    let circleIds: string[] | undefined;
    if (query.circleId) {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.circleId,
      );
    } else if (query.studentId) {
      const student = await getStudent(req.user!.organizationId, query.studentId);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        student.circleId.toString(),
      );
    } else if (req.user!.role === "supervisor") {
      // Neither filter given: a supervisor still only ever sees their own
      // circles' records, never the whole organization's — same rule
      // reports.routes.ts's leaderboard/champions and
      // students.routes.ts's search already apply.
      const ownCircles = await listCircles(req.user!.organizationId, {
        supervisorId: req.user!.id,
      });
      circleIds = ownCircles.map((c) => c._id.toString());
    }

    const history = await listMemorization(
      req.user!.organizationId as never,
      { studentId: query.studentId, circleId: query.circleId, circleIds },
      { page: query.page, limit: query.limit },
    );
    res.json({ success: true, data: history });
  });

  router.post("/", validateBody(recordMemorizationSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const entry = await recordMemorization({
      organizationId: req.user!.organizationId as never,
      circleId: req.body.circleId,
      studentId: req.body.studentId,
      date: req.body.date,
      newMemorization: req.body.newMemorization,
      revision: req.body.revision,
      recordedBy: req.user!.id as never,
    });
    res.status(201).json({ success: true, data: entry });
  });

  return router;
}
