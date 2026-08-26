import jwt from "jsonwebtoken";

import type { Role } from "@halaqat/shared";

import { env } from "../config/env.js";
import { User, type UserDocument } from "../models/User.js";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_credentials");
    this.name = "InvalidCredentialsError";
  }
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  org: string;
}

export interface StudentTokenPayload {
  sub: string;
  org: string;
  type: "student";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function signStudentToken(payload: Omit<StudentTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "student" }, env.STUDENT_JWT_SECRET, {
    expiresIn: env.STUDENT_JWT_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function verifyStudentToken(token: string): StudentTokenPayload {
  return jwt.verify(token, env.STUDENT_JWT_SECRET) as StudentTokenPayload;
}

/**
 * Finds a staff user by email or phone and checks the password. Identifiers are
 * only unique *within* an organization (SPEC.md §4), not globally, so — until
 * subdomain-based tenant resolution exists (Organization.slug is reserved for
 * that) — this checks every matching user across organizations and returns the
 * first whose password matches. In practice a given deployment has one tenant
 * per database during early rollout, so this resolves unambiguously.
 */
export async function loginStaff(
  identifier: string,
  password: string,
): Promise<UserDocument> {
  const normalized = identifier.trim().toLowerCase();
  const candidates = await User.find({
    $or: [{ email: normalized }, { phone: identifier.trim() }],
    isActive: true,
    deletedAt: null,
  }).select("+passwordHash");

  for (const candidate of candidates) {
    if (await candidate.comparePassword(password)) {
      candidate.lastLoginAt = new Date();
      await candidate.save();
      return candidate;
    }
  }
  throw new InvalidCredentialsError();
}
