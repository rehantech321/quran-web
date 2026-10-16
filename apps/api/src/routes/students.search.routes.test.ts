import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { signAccessToken } from "../services/auth.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestAdmin,
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";

// Own file / own replica set (see reports.scoping.routes.test.ts for why) —
// cheap insurance against the same resource-ceiling flake, and this feature
// is unrelated enough to the other students.routes tests to stand alone.

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

describe("GET /students/search", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("finds a student by partial, case-insensitive name across different circles", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleA = await createTestCircle(org._id, supervisorA._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    const target = await createTestStudent(org._id, circleB._id, {
      fullName: "محمد عبدالله القحطاني",
    });
    await createTestStudent(org._id, circleA._id, { fullName: "أحمد سالم" });

    const res = await request(app)
      .get("/api/v1/students/search")
      .query({ q: "عبدالله" })
      .set("Authorization", authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._id).toBe(target._id.toString());
    expect(res.body.data[0].circleId).toBe(circleB._id.toString());
    expect(res.body.data[0].circleName).toBe(circleB.name);
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    await createTestStudent(org._id, circle._id, { fullName: "أحمد سالم" });

    const res = await request(app)
      .get("/api/v1/students/search")
      .query({ q: "لا يوجد طالب بهذا الاسم" })
      .set("Authorization", authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("treats regex metacharacters in the query as literal text instead of erroring", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    await createTestStudent(org._id, circle._id, { fullName: "test (student)" });

    const res = await request(app)
      .get("/api/v1/students/search")
      .query({ q: "(student)" })
      .set("Authorization", authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("a supervisor's search only reaches their own circle, never another supervisor's", async () => {
    const org = await createTestOrg();
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleA = await createTestCircle(org._id, supervisorA._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    await createTestStudent(org._id, circleA._id, { fullName: "خالد محمد" });
    const otherCircleStudent = await createTestStudent(org._id, circleB._id, {
      fullName: "خالد سعيد",
    });

    const res = await request(app)
      .get("/api/v1/students/search")
      .query({ q: "خالد" })
      .set("Authorization", authHeader(supervisorA));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(
      res.body.data.some(
        (s: { _id: string }) => s._id === otherCircleStudent._id.toString(),
      ),
    ).toBe(false);
  });
});
