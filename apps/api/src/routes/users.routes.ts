import { Router } from "express";

import { createUserSchema, updateUserSchema, userIdParamSchema } from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  createStaffMember,
  getStaffMember,
  listStaff,
  updateStaffMember,
} from "../services/user.service.js";

function toPublicUser(user: {
  _id: unknown;
  organizationId: unknown;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  isActive: boolean;
}) {
  return {
    id: String(user._id),
    organizationId: String(user.organizationId),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
  };
}

/** Staff (admin/supervisor) management — needed by the Settings screen; not enumerated in SPEC.md §6's route list. */
export function createUsersRouter() {
  const router = Router();
  router.use(requireAuth, requireRole("admin", "super_admin"));

  router.get("/", async (req, res) => {
    const staff = await listStaff(req.user!.organizationId);
    res.json({ success: true, data: staff.map(toPublicUser) });
  });

  router.post("/", validateBody(createUserSchema), async (req, res) => {
    const user = await createStaffMember(
      req.user!.organizationId,
      req.user!.role,
      req.body,
    );
    res.status(201).json({ success: true, data: toPublicUser(user) });
  });

  router.get("/:id", validateParams(userIdParamSchema), async (req, res) => {
    const user = await getStaffMember(req.user!.organizationId, req.params.id!);
    res.json({ success: true, data: toPublicUser(user) });
  });

  router.patch(
    "/:id",
    validateParams(userIdParamSchema),
    validateBody(updateUserSchema),
    async (req, res) => {
      const user = await updateStaffMember(
        req.user!.organizationId,
        req.params.id!,
        req.body,
      );
      res.json({ success: true, data: toPublicUser(user) });
    },
  );

  return router;
}
