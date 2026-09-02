import { Router } from "express";
import { z } from "zod";

import {
  createTaskSchema,
  objectIdSchema,
  rejectSubmissionSchema,
  taskQuerySchema,
  updateSubmissionSchema,
  updateTaskSchema,
} from "@halaqat/shared";

import { requireAuth, requireRole, requireStudentAuth } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  approveSubmission,
  createTask,
  deleteTask,
  getMyTasks,
  getPendingApprovals,
  getSubmissionWithTask,
  getTask,
  listTasks,
  rejectSubmission,
  updateSubmissionStatus,
  updateTask,
} from "../services/task.service.js";
import { listCircles } from "../services/circle.service.js";
import { assertSupervisorOwnsCircle } from "./shared/assertSupervisorOwnsCircle.js";

const taskIdParamSchema = z.object({ id: objectIdSchema });
const submissionActionParamSchema = z.object({
  taskId: objectIdSchema,
  id: objectIdSchema,
});

export function createTasksRouter() {
  const router = Router();

  router.get("/mine", requireStudentAuth, async (req, res) => {
    const result = await getMyTasks(
      req.student!.organizationId as never,
      req.student!.id as never,
    );
    res.json({ success: true, data: result });
  });

  router.patch(
    "/:id/submission",
    requireStudentAuth,
    validateParams(taskIdParamSchema),
    validateBody(updateSubmissionSchema),
    async (req, res) => {
      const submission = await updateSubmissionStatus({
        organizationId: req.student!.organizationId as never,
        taskId: req.params.id as never,
        studentId: req.student!.id as never,
        status: req.body.status,
        studentNote: req.body.studentNote,
        attachmentUrl: req.body.attachmentUrl,
      });
      res.json({ success: true, data: submission });
    },
  );

  router.use(requireAuth, requireRole("admin", "super_admin", "supervisor"));

  router.get("/", validateQuery(taskQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof taskQuerySchema>;
    if (query.circleId) {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.circleId,
      );
    }
    const tasks = await listTasks(req.user!.organizationId as never, query);
    res.json({ success: true, data: tasks });
  });

  router.post("/", validateBody(createTaskSchema), async (req, res) => {
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      req.body.circleId,
    );
    const task = await createTask(
      req.user!.organizationId as never,
      req.user!.id as never,
      req.body,
    );
    res.status(201).json({ success: true, data: task });
  });

  router.patch(
    "/:id",
    validateParams(taskIdParamSchema),
    validateBody(updateTaskSchema),
    async (req, res) => {
      const existing = await getTask(req.user!.organizationId as never, req.params.id!);
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        existing.circleId.toString(),
      );
      const task = await updateTask(
        req.user!.organizationId as never,
        req.params.id!,
        req.body,
      );
      res.json({ success: true, data: task });
    },
  );

  router.delete("/:id", validateParams(taskIdParamSchema), async (req, res) => {
    const existing = await getTask(req.user!.organizationId as never, req.params.id!);
    await assertSupervisorOwnsCircle(
      req.user!.organizationId,
      req.user!.role,
      req.user!.id,
      existing.circleId.toString(),
    );
    await deleteTask(req.user!.organizationId as never, req.params.id!);
    res.status(204).end();
  });

  router.get("/pending-approvals", validateQuery(taskQuerySchema), async (req, res) => {
    const query = req.query as unknown as z.infer<typeof taskQuerySchema>;
    if (query.circleId) {
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        query.circleId,
      );
      const approvals = await getPendingApprovals(req.user!.organizationId as never, {
        circleId: query.circleId,
      });
      res.json({ success: true, data: approvals });
      return;
    }

    // No circleId given: a supervisor sees only their own circles' queues, an
    // admin/super_admin sees the whole org's.
    let circleIds: string[] | undefined;
    if (req.user!.role === "supervisor") {
      const ownCircles = await listCircles(req.user!.organizationId, {
        supervisorId: req.user!.id,
      });
      circleIds = ownCircles.map((c) => c._id.toString());
    }
    const approvals = await getPendingApprovals(req.user!.organizationId as never, {
      circleIds,
    });
    res.json({ success: true, data: approvals });
  });

  router.post(
    "/:taskId/submissions/:id/approve",
    validateParams(submissionActionParamSchema),
    async (req, res) => {
      const { task } = await getSubmissionWithTask(
        req.user!.organizationId as never,
        req.params.id!,
      );
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        task.circleId.toString(),
      );
      const submission = await approveSubmission({
        organizationId: req.user!.organizationId as never,
        submissionId: req.params.id as never,
        approvedBy: req.user!.id as never,
      });
      res.json({ success: true, data: submission });
    },
  );

  router.post(
    "/:taskId/submissions/:id/reject",
    validateParams(submissionActionParamSchema),
    validateBody(rejectSubmissionSchema),
    async (req, res) => {
      const { task } = await getSubmissionWithTask(
        req.user!.organizationId as never,
        req.params.id!,
      );
      await assertSupervisorOwnsCircle(
        req.user!.organizationId,
        req.user!.role,
        req.user!.id,
        task.circleId.toString(),
      );
      const submission = await rejectSubmission({
        organizationId: req.user!.organizationId as never,
        submissionId: req.params.id as never,
        rejectionReason: req.body.rejectionReason,
        rejectedBy: req.user!.id as never,
      });
      res.json({ success: true, data: submission });
    },
  );

  return router;
}
