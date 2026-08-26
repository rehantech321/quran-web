import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";

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

  // Feature routers are mounted here starting in Phase 4/5.

  app.use((_req, res) => {
    res
      .status(404)
      .json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  return app;
}
