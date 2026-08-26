import type { Types } from "mongoose";

import { NotFoundError } from "../../errors.js";
import { Circle } from "../../models/Circle.js";
import { Organization } from "../../models/Organization.js";

export async function loadOrgAndCircle(
  organizationId: Types.ObjectId,
  circleId: Types.ObjectId,
) {
  const [org, circle] = await Promise.all([
    Organization.findById(organizationId).lean(),
    Circle.findById(circleId).lean(),
  ]);
  if (!org) throw new NotFoundError("organization");
  if (!circle) throw new NotFoundError("circle");
  return { org, circle };
}
