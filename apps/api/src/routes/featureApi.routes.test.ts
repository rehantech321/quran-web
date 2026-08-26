import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { WeeklyQuestion } from "../models/WeeklyQuestion.js";
import { WeeklyTask } from "../models/WeeklyTask.js";
import { createApp } from "../app.js";
import { signAccessToken, signStudentToken } from "../services/auth.service.js";
import { updateSubmissionStatus } from "../services/task.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestAdmin,
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";

function staffAuthHeader(user: {
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

function studentAuthHeader(student: { _id: unknown; organizationId: unknown }) {
  const token = signStudentToken({
    sub: String(student._id),
    org: String(student.organizationId),
  });
  return `Bearer ${token}`;
}

describe("feature API routes", () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("student-scoped routes accept a student token and reject a staff token", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const asStudent = await request(app)
      .get("/api/v1/questions/active")
      .set("Authorization", studentAuthHeader(student));
    expect(asStudent.status).toBe(200);

    const asStaff = await request(app)
      .get("/api/v1/questions/active")
      .set("Authorization", staffAuthHeader(supervisor));
    expect(asStaff.status).toBe(401);
  });

  it("refuses to let a supervisor edit an attendance record from another supervisor's circle, without mutating it", async () => {
    const org = await createTestOrg();
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    const studentB = await createTestStudent(org._id, circleB._id);

    const record = await AttendanceRecord.create({
      organizationId: org._id,
      circleId: circleB._id,
      studentId: studentB._id,
      sessionDate: new Date(),
      status: "present",
      method: "manual",
      pointsAwarded: 10,
      recordedBy: supervisorB._id,
    });

    const res = await request(app)
      .patch(`/api/v1/attendance/${record._id}`)
      .set("Authorization", staffAuthHeader(supervisorA))
      .send({ status: "absent" });
    expect(res.status).toBe(404);

    const untouched = await AttendanceRecord.findById(record._id).lean();
    expect(untouched?.status).toBe("present");
    expect(untouched?.pointsAwarded).toBe(10);
  });

  it("scopes the pending-approvals queue to a supervisor's own circles by default", async () => {
    const org = await createTestOrg();
    const admin = await createTestAdmin(org._id);
    const supervisorA = await createTestSupervisor(org._id);
    const supervisorB = await createTestSupervisor(org._id);
    const circleA = await createTestCircle(org._id, supervisorA._id);
    const circleB = await createTestCircle(org._id, supervisorB._id);
    const studentA = await createTestStudent(org._id, circleA._id);
    const studentB = await createTestStudent(org._id, circleB._id);

    const taskA = await WeeklyTask.create({
      organizationId: org._id,
      circleId: circleA._id,
      title: "مهمة أ",
      points: 10,
      dueDate: new Date(),
      assignedTo: "circle",
      createdBy: supervisorA._id,
      isPublished: true,
    });
    const taskB = await WeeklyTask.create({
      organizationId: org._id,
      circleId: circleB._id,
      title: "مهمة ب",
      points: 10,
      dueDate: new Date(),
      assignedTo: "circle",
      createdBy: supervisorB._id,
      isPublished: true,
    });
    await updateSubmissionStatus({
      organizationId: org._id,
      taskId: taskA._id,
      studentId: studentA._id,
      status: "completed",
    });
    await updateSubmissionStatus({
      organizationId: org._id,
      taskId: taskB._id,
      studentId: studentB._id,
      status: "completed",
    });

    const asSupervisorA = await request(app)
      .get("/api/v1/tasks/pending-approvals")
      .set("Authorization", staffAuthHeader(supervisorA));
    expect(asSupervisorA.body.data).toHaveLength(1);
    expect(asSupervisorA.body.data[0].task._id).toBe(taskA._id.toString());

    const asAdmin = await request(app)
      .get("/api/v1/tasks/pending-approvals")
      .set("Authorization", staffAuthHeader(admin));
    expect(asAdmin.body.data).toHaveLength(2);
  });

  it("404s an approve/reject call for a submission id that doesn't belong to the caller's org", async () => {
    const orgA = await createTestOrg();
    const orgB = await createTestOrg();
    const supervisorA = await createTestSupervisor(orgA._id);
    const supervisorB = await createTestSupervisor(orgB._id);
    const circleB = await createTestCircle(orgB._id, supervisorB._id);
    const studentB = await createTestStudent(orgB._id, circleB._id);
    const taskB = await WeeklyTask.create({
      organizationId: orgB._id,
      circleId: circleB._id,
      title: "مهمة",
      points: 10,
      dueDate: new Date(),
      assignedTo: "circle",
      createdBy: supervisorB._id,
      isPublished: true,
    });
    const submission = await updateSubmissionStatus({
      organizationId: orgB._id,
      taskId: taskB._id,
      studentId: studentB._id,
      status: "completed",
    });

    const res = await request(app)
      .post(`/api/v1/tasks/${taskB._id}/submissions/${submission._id}/approve`)
      .set("Authorization", staffAuthHeader(supervisorA));
    expect(res.status).toBe(404);
  });

  it("staff can create a question and a student answers it exactly once", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);

    const created = await request(app)
      .post("/api/v1/questions")
      .set("Authorization", staffAuthHeader(supervisor))
      .send({
        circleId: circle._id.toString(),
        weekOf: new Date().toISOString(),
        questionText: "سؤال تجريبي",
        options: [
          { key: "A", text: "خيار أ" },
          { key: "B", text: "خيار ب" },
        ],
        correctOptionKey: "A",
        isPublished: true,
      });
    expect(created.status).toBe(201);

    const question = await WeeklyQuestion.findById(created.body.data._id).lean();
    const active = await request(app)
      .get("/api/v1/questions/active")
      .set("Authorization", studentAuthHeader(student));
    expect(active.body.data._id).toBe(String(question!._id));
    expect(active.body.data.correctOptionKey).toBeUndefined();

    const answer = await request(app)
      .post(`/api/v1/questions/${question!._id}/answer`)
      .set("Authorization", studentAuthHeader(student))
      .send({ selectedOptionKey: "A" });
    expect(answer.status).toBe(200);

    const secondAttempt = await request(app)
      .post(`/api/v1/questions/${question!._id}/answer`)
      .set("Authorization", studentAuthHeader(student))
      .send({ selectedOptionKey: "B" });
    expect(secondAttempt.status).toBe(409);
  });
});
