import { z } from "zod";

import { SUBMISSION_STATUSES, TASK_ASSIGNMENT_TYPES } from "../constants.js";
import { objectIdSchema } from "./common.js";

export const taskAssignmentTypeSchema = z.enum(TASK_ASSIGNMENT_TYPES);
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);

export const createTaskSchema = z
  .object({
    circleId: objectIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    points: z.number().int().min(0),
    dueDate: z.coerce.date(),
    assignedTo: taskAssignmentTypeSchema,
    studentIds: z.array(objectIdSchema).optional(),
    isPublished: z.boolean().default(false),
  })
  .refine(
    (data) => data.assignedTo !== "students" || (data.studentIds?.length ?? 0) > 0,
    {
      message: "student_ids_required_when_assigned_to_students",
      path: ["studentIds"],
    },
  );
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  points: z.number().int().min(0).optional(),
  dueDate: z.coerce.date().optional(),
  assignedTo: taskAssignmentTypeSchema.optional(),
  studentIds: z.array(objectIdSchema).optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskQuerySchema = z.object({
  circleId: objectIdSchema.optional(),
  status: submissionStatusSchema.optional(),
});
export type TaskQuery = z.infer<typeof taskQuerySchema>;

export const updateSubmissionSchema = z.object({
  status: submissionStatusSchema,
  studentNote: z.string().max(1000).optional(),
  attachmentUrl: z.string().url().optional(),
});
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;

export const rejectSubmissionSchema = z.object({
  rejectionReason: z.string().min(1).max(1000),
});
export type RejectSubmissionInput = z.infer<typeof rejectSubmissionSchema>;
