import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import { TEST_PASSWORD, createTestOrg, createTestSupervisor } from "../test/fixtures.js";

describe("auth routes", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("logs in with email + password and sets an httpOnly refresh cookie", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: supervisor.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(supervisor.email);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(
      cookies.some(
        (c) => c.startsWith("halaqat_refresh_token=") && c.includes("HttpOnly"),
      ),
    ).toBe(true);
  });

  it("also logs in with a phone identifier", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: supervisor.phone, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe(supervisor.phone);
  });

  it("rejects an incorrect password without revealing which field was wrong", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: supervisor.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects malformed login bodies before touching the database", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ identifier: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /me requires a valid access token", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: supervisor.email, password: TEST_PASSWORD });

    const authed = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(authed.status).toBe(200);
    expect(authed.body.data.id).toBe(supervisor._id.toString());

    const unauthed = await request(app).get("/api/v1/auth/me");
    expect(unauthed.status).toBe(401);
  });

  it("exchanges a valid refresh cookie for a new access token", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: supervisor.email, password: TEST_PASSWORD });
    const cookies = login.headers["set-cookie"] as unknown as string[];

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookies);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));

    const noCookie = await request(app).post("/api/v1/auth/refresh");
    expect(noCookie.status).toBe(401);
  });
});
