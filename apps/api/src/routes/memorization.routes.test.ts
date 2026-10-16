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

describe("memorization routes", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("records a daily entry with both new memorization and revision, snapshotting the surah name", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(admin))
      .send({
        studentId: student._id.toString(),
        circleId: circle._id.toString(),
        // Al-Mulk (67) has 30 ayahs.
        newMemorization: { surahNumber: 67, fromAyah: 1, toAyah: 10 },
        // Al-Baqarah (2) has 286 ayahs.
        revision: { surahNumber: 2, fromAyah: 255, toAyah: 257 },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.newMemorization).toMatchObject({
      surahNumber: 67,
      surahName: "الملك",
      fromAyah: 1,
      toAyah: 10,
    });
    expect(res.body.data.revision).toMatchObject({
      surahNumber: 2,
      surahName: "البقرة",
      fromAyah: 255,
      toAyah: 257,
    });
  });

  it("rejects an ayah range that exceeds the chosen surah's real ayah count", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    // Al-Fatihah (1) only has 7 ayahs.
    const res = await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(admin))
      .send({
        studentId: student._id.toString(),
        circleId: circle._id.toString(),
        newMemorization: { surahNumber: 1, fromAyah: 1, toAyah: 10 },
      });

    expect(res.status).toBe(400);
  });

  it("rejects a record with neither newMemorization nor revision", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const res = await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(admin))
      .send({ studentId: student._id.toString(), circleId: circle._id.toString() });

    expect(res.status).toBe(400);
  });

  it("lists a student's history newest first", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(admin))
      .send({
        studentId: student._id.toString(),
        circleId: circle._id.toString(),
        date: "2026-01-01",
        newMemorization: { surahNumber: 78, fromAyah: 1, toAyah: 10 },
      });
    await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(admin))
      .send({
        studentId: student._id.toString(),
        circleId: circle._id.toString(),
        date: "2026-01-05",
        newMemorization: { surahNumber: 78, fromAyah: 11, toAyah: 20 },
      });

    const res = await request(app)
      .get("/api/v1/memorization")
      .query({ studentId: student._id.toString() })
      .set("Authorization", authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(2);
    expect(res.body.data.entries[0].newMemorization.fromAyah).toBe(11);
    expect(res.body.data.entries[1].newMemorization.fromAyah).toBe(1);
  });

  it("a supervisor cannot record or list memorization for another supervisor's student", async () => {
    const org = await createTestOrg();
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleA = await createTestCircle(org._id, supervisorA._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    const studentB = await createTestStudent(org._id, circleB._id);

    const createAttempt = await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(supervisorA))
      .send({
        studentId: studentB._id.toString(),
        circleId: circleB._id.toString(),
        newMemorization: { surahNumber: 78, fromAyah: 1, toAyah: 10 },
      });
    expect(createAttempt.status).toBe(404);

    // Supervisor B records one for their own student...
    await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(supervisorB))
      .send({
        studentId: studentB._id.toString(),
        circleId: circleB._id.toString(),
        newMemorization: { surahNumber: 78, fromAyah: 1, toAyah: 10 },
      });

    // ...and supervisor A's unfiltered listing (no circleId/studentId) must
    // never include it, even though it exists in the same organization.
    const studentA = await createTestStudent(org._id, circleA._id);
    await request(app)
      .post("/api/v1/memorization")
      .set("Authorization", authHeader(supervisorA))
      .send({
        studentId: studentA._id.toString(),
        circleId: circleA._id.toString(),
        newMemorization: { surahNumber: 78, fromAyah: 1, toAyah: 10 },
      });

    const listRes = await request(app)
      .get("/api/v1/memorization")
      .set("Authorization", authHeader(supervisorA));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.entries).toHaveLength(1);
    expect(listRes.body.data.entries[0].studentId).toBe(studentA._id.toString());
  });
});
