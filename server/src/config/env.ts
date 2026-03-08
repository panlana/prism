import { z } from "zod";

import { loadEnv } from "./load-env.js";

loadEnv();

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  DATABASE_URL: isProduction
    ? z.string().min(1)
    : z.string().min(1).default("postgresql://prisma:prisma@localhost:5432/prism_v4?schema=public"),
  PORT: z.coerce.number().default(3050),
  JWT_SECRET: isProduction ? z.string().min(1) : z.string().min(1).default("dev-secret"),
  AI_GATEWAY: z.enum(["openrouter", "openai"]).default("openrouter"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_STORAGE_BUCKET: z.string().default("documents")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
