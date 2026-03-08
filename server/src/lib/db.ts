import { PrismaClient } from "@prisma/client";

import { loadEnv } from "../config/load-env.js";

loadEnv();

declare global {
  var __prismPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prismPrisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismPrisma = prisma;
}
