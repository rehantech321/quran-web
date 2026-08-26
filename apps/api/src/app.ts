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
import { createStudentAccessRouter } from "@/routes/studentAccess.routes.js";

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

  // Resource routers (organizations, circles, students, attendance, grades,
  // questions, tasks, reports) are mounted here starting Phase 5/6.

  app.use((_req, res) => {
    res
      .status(404)
      .json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });

  app.use(errorHandler);

  return app;
}
