import { z } from "zod";

import { ROLES } from "../constants.js";
import { objectIdSchema } from "./common.js";

export const staffRoleSchema = z.enum(ROLES);

export const createUserSchema = z
  .object({
    fullName: z.string().min(1).max(150),
    email: z.string().email().optional(),
    phone: z.string().min(6).max(30).optional(),
    password: z.string().min(8).max(200),
    role: staffRoleSchema,
    avatarUrl: z.string().url().optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "email_or_phone_required",
    path: ["email"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(30).optional(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1), // email or phone
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const studentPinVerifySchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "pin_must_be_4_digits"),
});
export type StudentPinVerifyInput = z.infer<typeof studentPinVerifySchema>;

export const userIdParamSchema = z.object({ id: objectIdSchema });
