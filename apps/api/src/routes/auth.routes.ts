import { Router } from "express";
import rateLimit from "express-rate-limit";
import ms from "ms";

import { loginSchema } from "@halaqat/shared";

import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { User } from "../models/User.js";
import {
  loginStaff,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../services/auth.service.js";

export const REFRESH_COOKIE_NAME = "halaqat_refresh_token";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
    maxAge: ms(env.JWT_REFRESH_TTL),
  };
}

function toPublicUser(user: InstanceType<typeof User>) {
  return {
    id: user._id.toString(),
    organizationId: user.organizationId.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

/**
 * Built fresh per `createApp()` call (not a module-level singleton) so each
 * Express app instance gets its own rate-limiter state — important for tests,
 * which build a new app per suite/case and must not share request budgets.
 */
export function createAuthRouter() {
  const router = Router();

  // Shared across login/refresh so brute-forcing a password can't outrun the
  // limiter by hammering one route more than the other.
  const authRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post("/login", authRateLimiter, validateBody(loginSchema), async (req, res) => {
    const user = await loginStaff(req.body.identifier, req.body.password);
    const accessToken = signAccessToken({
      sub: user._id.toString(),
      org: user.organizationId.toString(),
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      sub: user._id.toString(),
      org: user.organizationId.toString(),
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.json({ success: true, data: { accessToken, user: toPublicUser(user) } });
  });

  router.post("/refresh", authRateLimiter, async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Missing refresh token" },
        });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res
        .status(401)
        .json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" },
        });
      return;
    }

    const user = await User.findOne({
      _id: payload.sub,
      isActive: true,
      deletedAt: null,
    });
    if (!user) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "User no longer active" },
        });
      return;
    }

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      org: user.organizationId.toString(),
      role: user.role,
    });
    res.json({ success: true, data: { accessToken } });
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    res.json({ success: true, data: { loggedOut: true } });
  });

  router.get("/me", requireAuth, async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
      return;
    }
    res.json({ success: true, data: toPublicUser(user) });
  });

  return router;
}
