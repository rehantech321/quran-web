import { NotFoundError } from "../../errors.js";
import { getCircle } from "../../services/circle.service.js";

/**
 * A supervisor may only act on circles they run; admins/super_admins pass
 * through untouched. 404s (not 403) on a mismatch — see DECISIONS.md Phase 4/5.
 */
export async function assertSupervisorOwnsCircle(
  organizationId: string,
  role: string,
  userId: string,
  circleId: string,
) {
  if (role !== "supervisor") return;
  const circle = await getCircle(organizationId, circleId);
  if (circle.supervisorId.toString() !== userId) {
    throw new NotFoundError("circle");
  }
}
