import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { Circle } from "../models/Circle.js";
import { signAccessToken } from "../services/auth.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestAdmin,
  createTestCircle,
  createTestOrg,
  createTestSupervisor,
} from "../test/fixtures.js";

function authHeader(user: {
  _id: unknown;
  organizationId: unknown;
  role: "admin" | "supervisor" | "super_admin";
}) {
  const token = signAccessToken({
    sub: String(user._id),
    org: String(user.organizationId),
    role: user.role,
  });
  return `Bearer ${token}`;
}

describe("DELETE /users/:id", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("an admin can remove a supervisor with no circles assigned", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);

    const res = await request(app)
      .delete(`/api/v1/users/${supervisor._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);

    const list = await request(app)
      .get("/api/v1/users")
      .set("Authorization", authHeader(admin));
    expect(
      list.body.data.find((u: { id: string }) => u.id === supervisor._id.toString()),
    ).toBeUndefined();
  });

  it("refuses to remove a supervisor who still has an active circle assigned", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    await createTestCircle(org._id, supervisor._id);

    const res = await request(app)
      .delete(`/api/v1/users/${supervisor._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(409);

    // Never partially applied — the supervisor must still exist afterward.
    const list = await request(app)
      .get("/api/v1/users")
      .set("Authorization", authHeader(admin));
    expect(
      list.body.data.find((u: { id: string }) => u.id === supervisor._id.toString()),
    ).toBeDefined();
  });

  it("removing the supervisor succeeds once their circle is reassigned", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const otherSupervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);

    await Circle.updateOne({ _id: circle._id }, { supervisorId: otherSupervisor._id });

    const res = await request(app)
      .delete(`/api/v1/users/${supervisor._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
  });

  it("an admin cannot remove their own account", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);

    const res = await request(app)
      .delete(`/api/v1/users/${admin._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(400);
  });

  it("a supervisor cannot remove another staff account", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const otherSupervisor = await createTestSupervisor(org._id);

    const res = await request(app)
      .delete(`/api/v1/users/${otherSupervisor._id}`)
      .set("Authorization", authHeader(supervisor));
    expect(res.status).toBe(403);
  });

  it("404s a cross-tenant delete instead of leaking that the account exists", async () => {
    const orgA = await createTestOrg();
    const orgB = await createTestOrg();
    const adminA = await createTestAdmin(orgA._id);
    const supervisorB = await createTestSupervisor(orgB._id);

    const res = await request(app)
      .delete(`/api/v1/users/${supervisorB._id}`)
      .set("Authorization", authHeader(adminA));
    expect(res.status).toBe(404);
  });
});
