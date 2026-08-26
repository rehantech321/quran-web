import { Router } from "express";

import {
  circleIdParamSchema,
  createCircleSchema,
  updateCircleSchema,
} from "@halaqat/shared";

import { NotFoundError } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  createCircle,
  deleteCircle,
  getCircle,
  listCirclesWithStats,
  updateCircle,
} from "../services/circle.service.js";

export function createCirclesRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const scopedToOwnCircles = req.user!.role === "supervisor";
    const circles = await listCirclesWithStats(req.user!.organizationId, {
      supervisorId: scopedToOwnCircles ? req.user!.id : undefined,
    });
    res.json({ success: true, data: circles });
  });

  router.post(
    "/",
    requireRole("admin", "super_admin"),
    validateBody(createCircleSchema),
    async (req, res) => {
      const circle = await createCircle(req.user!.organizationId, req.body);
      res.status(201).json({ success: true, data: circle });
    },
  );

  router.get("/:id", validateParams(circleIdParamSchema), async (req, res) => {
    const circle = await getCircle(req.user!.organizationId, req.params.id!);
    // 404, not 403 — a supervisor peeking at another supervisor's circle by
    // guessing its id shouldn't even learn that the id is valid.
    if (
      req.user!.role === "supervisor" &&
      circle.supervisorId.toString() !== req.user!.id
    ) {
      throw new NotFoundError("circle");
    }
    res.json({ success: true, data: circle });
  });

  router.patch(
    "/:id",
    requireRole("admin", "super_admin"),
    validateParams(circleIdParamSchema),
    validateBody(updateCircleSchema),
    async (req, res) => {
      const circle = await updateCircle(
        req.user!.organizationId,
        req.params.id!,
        req.body,
      );
      res.json({ success: true, data: circle });
    },
  );

  router.delete(
    "/:id",
    requireRole("admin", "super_admin"),
    validateParams(circleIdParamSchema),
    async (req, res) => {
      const circle = await deleteCircle(req.user!.organizationId, req.params.id!);
      res.json({ success: true, data: circle });
    },
  );

  return router;
}
