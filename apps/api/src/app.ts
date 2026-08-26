import "express-async-errors";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { createAttendanceRouter } from "@/routes/attendance.routes.js";
import { createAuthRouter } from "@/routes/auth.routes.js";
import { createCirclesRouter } from "@/routes/circles.routes.js";
import { createGradesRouter } from "@/routes/grades.routes.js";
import { createOrganizationsRouter } from "@/routes/organizations.routes.js";
import { createQuestionsRouter } from "@/routes/questions.routes.js";
import { createStudentAccessRouter } from "@/routes/studentAccess.routes.js";
import { createStudentsRouter } from "@/routes/students.routes.js";
import { createTasksRouter } from "@/routes/tasks.routes.js";
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
  app.use("/api/v1/attendance", createAttendanceRouter());
  app.use("/api/v1/grades", createGradesRouter());
  app.use("/api/v1/questions", createQuestionsRouter());
  app.use("/api/v1/tasks", createTasksRouter());
  // Mounted at the bare /api/v1 prefix (it defines its own full paths —
  // /circles/:id/students, /students, /students/:id, ... — since SPEC.md §6
  // nests student listing under circles but everything else under /students
  // directly). Must be registered LAST: Express matches app.use() mount
  // prefixes in registration order, and "/api/v1" is a prefix of every route
  // above. This router's own unconditional `router.use(requireAuth)` would
  // otherwise intercept and 401 every request to those routers before Express
  // ever got to check whether they — not this one — were the actual match
  // (e.g. a student token hitting /questions/active got swallowed here and
  // rejected, since this router only accepts staff tokens).
  app.use("/api/v1", createStudentsRouter());

  // Reports routers are mounted here starting Phase 7.

  app.use((_req, res) => {
    res
      .status(404)
      .json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });

  app.use(errorHandler);

  return app;
}
