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
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
