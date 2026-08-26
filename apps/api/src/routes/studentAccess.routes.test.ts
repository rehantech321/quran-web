import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { hashStudentPin } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";

describe("student-access routes", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("mints a session token for a valid slug when no PIN is required", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const res = await request(app).get(`/api/v1/student-access/${student.accessSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.pinRequired).toBe(false);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.student.id).toBe(student._id.toString());
  });

  it("never reveals whether an unknown slug exists", async () => {
    const res = await request(app).get("/api/v1/student-access/UNKNOWNSLUG1");
    expect(res.status).toBe(404);
    expect(res.body.error.message).not.toMatch(/exist|found in database/i);
  });

  it("requires a PIN when the org has it enabled and the student has one set", async () => {
    const org = await createTestOrg();
    await org.updateOne({ requireStudentPin: true });
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    student.pin = await hashStudentPin("1234");
    await student.save();

    const lookup = await request(app).get(`/api/v1/student-access/${student.accessSlug}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.data.pinRequired).toBe(true);
    expect(lookup.body.data.token).toBeUndefined();

    const wrongPin = await request(app)
      .post(`/api/v1/student-access/${student.accessSlug}/verify-pin`)
      .send({ pin: "0000" });
    expect(wrongPin.status).toBe(401);

    const correctPin = await request(app)
      .post(`/api/v1/student-access/${student.accessSlug}/verify-pin`)
      .send({ pin: "1234" });
    expect(correctPin.status).toBe(200);
    expect(correctPin.body.data.token).toEqual(expect.any(String));
  });

  it("rate-limits slug lookups at 10/min per IP", async () => {
    // A fresh app so this test's rate-limiter state isn't polluted by requests
    // the other tests in this file already made against the shared `app`.
    const freshApp = createApp();
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const responses = [];
    for (let i = 0; i < 11; i++) {
      responses.push(
        await request(freshApp).get(`/api/v1/student-access/${student.accessSlug}`),
      );
    }
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(10);
    expect(statuses.at(-1)).toBe(429);
  });
});
