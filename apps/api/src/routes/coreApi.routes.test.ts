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

describe("core API routes", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("scopes circle listing to the supervisor's own circles, but shows all to admin", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    await createTestCircle(org._id, supervisorA._id);
    await createTestCircle(org._id, supervisorB._id);

    const asSupervisorA = await request(app)
      .get("/api/v1/circles")
      .set("Authorization", authHeader(supervisorA));
    expect(asSupervisorA.body.data).toHaveLength(1);

    const asAdmin = await request(app)
      .get("/api/v1/circles")
      .set("Authorization", authHeader(admin));
    expect(asAdmin.body.data).toHaveLength(2);
  });

  it("404s a cross-tenant circle fetch instead of leaking that it exists", async () => {
    const orgA = await createTestOrg();
    const orgB = await createTestOrg();
    const adminA = await createTestAdmin(orgA._id);
    const supervisorB = await createTestSupervisor(orgB._id);
    const circleInB = await createTestCircle(orgB._id, supervisorB._id);

    const res = await request(app)
      .get(`/api/v1/circles/${circleInB._id}`)
      .set("Authorization", authHeader(adminA));
    expect(res.status).toBe(404);
  });

  it("only an admin can create a circle; a supervisor is forbidden", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);

    const forbidden = await request(app)
      .post("/api/v1/circles")
      .set("Authorization", authHeader(supervisor))
      .send({
        name: "حلقة جديدة",
        supervisorId: supervisor._id.toString(),
        schedule: { days: [0, 2, 4], startTime: "19:45", lateAfter: "20:15" },
      });
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post("/api/v1/circles")
      .set("Authorization", authHeader(admin))
      .send({
        name: "حلقة جديدة",
        supervisorId: supervisor._id.toString(),
        schedule: { days: [0, 2, 4], startTime: "19:45", lateAfter: "20:15" },
      });
    expect(created.status).toBe(201);
  });

  it("refuses to delete a circle that still has active students", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .delete(`/api/v1/circles/${circle._id}`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(409);
  });

  it("regenerating a student's slug invalidates the old one", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const oldSlug = student.accessSlug;

    const res = await request(app)
      .post(`/api/v1/students/${student._id}/regenerate-slug`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
    const newSlug = res.body.data.accessSlug;
    expect(newSlug).not.toBe(oldSlug);

    const oldLookup = await request(app).get(`/api/v1/student-access/${oldSlug}`);
    expect(oldLookup.status).toBe(404);

    const newLookup = await request(app).get(`/api/v1/student-access/${newSlug}`);
    expect(newLookup.status).toBe(200);
  });

  it("generates a scannable PNG QR code for a student's barcode", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .get(`/api/v1/students/${student._id}/qr.png`)
      .set("Authorization", authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    // PNG magic bytes.
    expect(res.body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("a supervisor cannot manage a student outside their own circle", async () => {
    const org = await createTestOrg();
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    const studentInB = await createTestStudent(org._id, circleB._id);

    const res = await request(app)
      .get(`/api/v1/students/${studentInB._id}`)
      .set("Authorization", authHeader(supervisorA));
    expect(res.status).toBe(404);
  });
});
