import { NotFoundError } from "../errors.js";

/**
 * Every controller must verify a fetched resource belongs to the requester's
 * organization (SPEC.md §3) — call this immediately after loading any
 * org-scoped document, before returning or mutating it.
 *
 * Returns 404, not 403: confirming a resource exists in *another* tenant's
 * data would itself leak cross-tenant information.
 */
export function assertOrgScope(
  resourceOrganizationId: unknown,
  requesterOrganizationId: string,
  entity = "resource",
): void {
  if (String(resourceOrganizationId) !== requesterOrganizationId) {
    throw new NotFoundError(entity);
  }
}
