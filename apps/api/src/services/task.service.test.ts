import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { WeeklyTask } from "../models/WeeklyTask.js";
import { Student } from "../models/Student.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../test/dbTestUtils.js";
import {
  createTestCircle,
  createTestOrg,
  createTestStudent,
  createTestSupervisor,
} from "../test/fixtures.js";
import {
  approveSubmission,
  rejectSubmission,
  updateSubmissionStatus,
} from "./task.service.js";

async function createTestTask(
  organizationId: object,
  circleId: object,
  createdBy: object,
) {
  return WeeklyTask.create({
    organizationId,
    circleId,
    title: "حفظ سورة الملك",
    points: 15,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assignedTo: "circle",
    createdBy,
    isPublished: true,
  });
}

describe("task.service", () => {
  beforeAll(connectTestDb, 60_000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it("only awards points once approvalStatus becomes approved", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const task = await createTestTask(org._id, circle._id, supervisor._id);

    const submission = await updateSubmissionStatus({
      organizationId: org._id,
      taskId: task._id,
      studentId: student._id,
      status: "completed",
    });
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(0);

    await approveSubmission({
      organizationId: org._id,
      submissionId: submission._id,
      approvedBy: supervisor._id,
    });
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(15);
  });

  it("handles approve -> reject -> re-approve, reversing and re-awarding correctly", async () => {
    const org = await createTestOrg();
    const supervisor = await createTestSupervisor(org._id);
    const circle = await createTestCircle(org._id, supervisor._id);
    const student = await createTestStudent(org._id, circle._id);
    const task = await createTestTask(org._id, circle._id, supervisor._id);

    const submission = await updateSubmissionStatus({
      organizationId: org._id,
      taskId: task._id,
      studentId: student._id,
      status: "completed",
    });

    await approveSubmission({
      organizationId: org._id,
      submissionId: submission._id,
      approvedBy: supervisor._id,
    });
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(15);

    const rejected = await rejectSubmission({
      organizationId: org._id,
      submissionId: submission._id,
      rejectionReason: "لم يكتمل الحفظ بشكل صحيح",
      rejectedBy: supervisor._id,
    });
    expect(rejected.approvalStatus).toBe("rejected");
    expect(rejected.pointsAwarded).toBe(0);
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(0);

    const reapproved = await approveSubmission({
      organizationId: org._id,
      submissionId: submission._id,
      approvedBy: supervisor._id,
    });
    expect(reapproved.approvalStatus).toBe("approved");
    expect((await Student.findById(student._id).lean())?.totalPoints).toBe(15);
  });
});
