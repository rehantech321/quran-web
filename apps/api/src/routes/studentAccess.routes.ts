import { Router } from "express";
import rateLimit from "express-rate-limit";

import { studentPinVerifySchema, studentSlugParamSchema } from "@halaqat/shared";

import { validateBody, validateParams } from "../middleware/validate.js";
import type { StudentDocument } from "../models/Student.js";
import {
  resolveStudentAccess,
  verifyStudentPin,
} from "../services/studentAccess.service.js";

function toPublicStudent(student: StudentDocument) {
  return {
    id: student._id.toString(),
    organizationId: student.organizationId.toString(),
    circleId: student.circleId.toString(),
    fullName: student.fullName,
    photoUrl: student.photoUrl,
    totalPoints: student.totalPoints,
  };
}

/**
 * Built fresh per `createApp()` call (not a module-level singleton) so each
 * Express app instance gets its own rate-limiter state — important for tests,
 * which build a new app per suite/case and must not share request budgets.
 */
export function createStudentAccessRouter() {
  const router = Router();

  // Shared across the lookup and the PIN-verify step, since both are "prove you
  // hold this slug" attempts against the same budget — see SPEC.md §3.
  const slugRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get(
    "/:slug",
    slugRateLimiter,
    validateParams(studentSlugParamSchema),
    async (req, res) => {
      const result = await resolveStudentAccess(req.params.slug!);
      if (result.pinRequired) {
        res.json({ success: true, data: { pinRequired: true } });
        return;
      }
      res.json({
        success: true,
        data: {
          pinRequired: false,
          token: result.token,
          student: toPublicStudent(result.student),
        },
      });
    },
  );

  router.post(
    "/:slug/verify-pin",
    slugRateLimiter,
    validateParams(studentSlugParamSchema),
    validateBody(studentPinVerifySchema),
    async (req, res) => {
      const result = await verifyStudentPin(req.params.slug!, req.body.pin);
      res.json({
        success: true,
        data: { token: result.token, student: toPublicStudent(result.student) },
      });
    },
  );

  return router;
}
