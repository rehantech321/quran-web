import "express-async-errors";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { createAuthRouter } from "@/routes/auth.routes.js";
import { createCirclesRouter } from "@/routes/circles.routes.js";
import { createOrganizationsRouter } from "@/routes/organizations.routes.js";
import { createStudentAccessRouter } from "@/routes/studentAccess.routes.js";
import { createStudentsRouter } from "@/routes/students.routes.js";
import { createUsersRouter } from "@/routes/users.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get("/api/v1/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  app.use("/api/v1/auth", createAuthRouter());
  app.use("/api/v1/student-access", createStudentAccessRouter());
  app.use("/api/v1/organizations", createOrganizationsRouter());
  app.use("/api/v1/circles", createCirclesRouter());
  app.use("/api/v1/users", createUsersRouter());
  // Defines its own full paths (/circles/:id/students, /students, /students/:id, ...)
  // rather than being namespaced under one prefix — SPEC.md §6 nests student
  // listing under circles but everything else under /students directly.
  app.use("/api/v1", createStudentsRouter());

  // Feature-area routers (attendance, grades, questions, tasks, reports) are
  // mounted here starting Phase 6/7.

  app.use((_req, res) => {
    res
      .status(404)
      .json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });

  app.use(errorHandler);

  return app;
}
