import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const configDir = path.dirname(currentFilePath);
const serverDir = path.resolve(configDir, "..", "..");
const repoRoot = path.resolve(serverDir, "..");

let loaded = false;

export function loadEnv() {
  if (loaded) {
    return;
  }

  for (const candidate of [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
    path.join(serverDir, ".env.local"),
    path.join(serverDir, ".env")
  ]) {
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    process.env.DATABASE_URL ??= "postgresql://prisma:prisma@localhost:5432/prism_v4?schema=public";
    process.env.JWT_SECRET ??= "dev-secret";
    process.env.PORT ??= "3050";
  }

  loaded = true;
}

