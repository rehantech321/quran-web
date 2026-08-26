import { Router } from "express";
import { z } from "zod";

import { objectIdSchema, updateOrganizationSchema } from "@halaqat/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { getOrganization, updateOrganization } from "../services/organization.service.js";
import { assertOrgScope } from "../utils/assertOrgScope.js";

const idParamSchema = z.object({ id: objectIdSchema });

export function createOrganizationsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get("/:id", validateParams(idParamSchema), async (req, res) => {
    assertOrgScope(req.params.id, req.user!.organizationId, "organization");
    const org = await getOrganization(req.params.id!);
    res.json({ success: true, data: org });
  });

  router.patch(
    "/:id",
    requireRole("admin", "super_admin"),
    validateParams(idParamSchema),
    validateBody(updateOrganizationSchema),
    async (req, res) => {
      assertOrgScope(req.params.id, req.user!.organizationId, "organization");
      const org = await updateOrganization(req.params.id!, req.body);
      res.json({ success: true, data: org });
    },
  );

  return router;
}
