import "dotenv/config";

import mongoose from "mongoose";

import { DEFAULT_THEME } from "@halaqat/shared";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Organization } from "../models/Organization.js";
import { User, hashPassword } from "../models/User.js";

/**
 * Bootstraps a brand-new tenant: one Organization + its first admin User.
 *
 * There is no API route for this on purpose — creating an org/admin is a
 * privileged, rare, out-of-band operation, and every existing user-creation
 * route (`POST /users`) already requires an authenticated admin, which a
 * fresh tenant doesn't have yet. Unlike seed.ts, this script never wipes
 * anything — it only inserts the two new documents, so it's safe to run
 * against a database that already has other tenants in it.
 *
 * Usage (all via env vars so it works the same on Windows/macOS/Linux):
 *
 *   ORG_NAME="جامع النور" ORG_NAME_EN="Jami' Al-Noor" ORG_SLUG="jami-al-noor" \
 *   ADMIN_NAME="Admin Name" ADMIN_EMAIL="admin@jami-al-noor.example" \
 *   ADMIN_PASSWORD="ChangeMe123!" \
 *   pnpm --filter @halaqat/api create-org
 *
 * Optional: ORG_TIMEZONE (IANA tz, default "Asia/Riyadh"), ORG_TAGLINE.
 */
async function main() {
  const orgName = requireEnv("ORG_NAME");
  const orgNameEn = process.env.ORG_NAME_EN;
  const orgSlug = requireEnv("ORG_SLUG").toLowerCase().trim();
  const adminName = requireEnv("ADMIN_NAME");
  const adminEmail = requireEnv("ADMIN_EMAIL").toLowerCase().trim();
  const adminPassword = requireEnv("ADMIN_PASSWORD");
  const timezone = process.env.ORG_TIMEZONE ?? "Asia/Riyadh";
  const tagline = process.env.ORG_TAGLINE;

  if (adminPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  await mongoose.connect(env.MONGODB_URI);
  logger.info({ orgSlug }, "Connected to MongoDB");

  const existing = await Organization.findOne({ slug: orgSlug });
  if (existing) {
    throw new Error(
      `An organization with slug "${orgSlug}" already exists (id ${existing._id}).`,
    );
  }

  const org = await Organization.create({
    name: orgName,
    nameEn: orgNameEn,
    slug: orgSlug,
    tagline,
    timezone,
    theme: DEFAULT_THEME,
    requireStudentPin: false,
  });

  const passwordHash = await hashPassword(adminPassword);
  const admin = await User.create({
    organizationId: org._id,
    fullName: adminName,
    email: adminEmail,
    passwordHash,
    role: "admin",
    isActive: true,
  });

  logger.info(
    { organizationId: org._id.toString(), adminUserId: admin._id.toString(), adminEmail },
    "Tenant created. Log in with the admin email/password above, then use " +
      "Settings > Supervisors (or POST /api/v1/users) to add supervisors, and " +
      "Circles > New Circle to start building out the org's data — no more " +
      "script access needed from here.",
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required env var ${name}. See the usage comment in createOrg.ts.`,
    );
  }
  return value;
}

main()
  .catch((err) => {
    logger.error(err, "createOrg failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
