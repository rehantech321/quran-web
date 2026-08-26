import type { NextFunction, Request, Response } from "express";

import type { Role } from "@halaqat/shared";

import { verifyAccessToken, verifyStudentToken } from "../services/auth.service.js";

export interface AuthenticatedStaff {
  id: string;
  organizationId: string;
  role: Role;
}

export interface AuthenticatedStudent {
  id: string;
  organizationId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedStaff;
      student?: AuthenticatedStudent;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function unauthorized(res: Response, message = "Missing or invalid token") {
  res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message } });
}

/** Staff-only routes (admin/supervisor/super_admin). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return unauthorized(res);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, organizationId: payload.org, role: payload.role };
    next();
  } catch {
    unauthorized(res);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
      return;
    }
    next();
  };
}

/** Student private-link routes only. */
export function requireStudentAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return unauthorized(res);
  try {
    const payload = verifyStudentToken(token);
    req.student = { id: payload.sub, organizationId: payload.org };
    next();
  } catch {
    unauthorized(res);
  }
}
