import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  STUDENT_JWT_SECRET: z.string().min(16),
  STUDENT_JWT_TTL: z.string().default("90d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_DOMAIN: z.string().optional(),
  // The public web origin, used to build the full URL encoded in a student's
  // QR code (so an ordinary phone camera — not just the in-app scanner — can
  // open their private link directly). Distinct from CORS_ORIGIN, which may
  // be a comma-separated allow-list rather than one canonical origin.
  WEB_BASE_URL: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
