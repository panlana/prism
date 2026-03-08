import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PREFIX = "scrypt";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedValue: string | null | undefined) {
  if (!storedValue) {
    return false;
  }

  if (!storedValue.startsWith(`${SCRYPT_PREFIX}$`)) {
    return storedValue === password;
  }

  const [, salt, expectedHash] = storedValue.split("$");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");

  if (expected.length !== actualHash.length) {
    return false;
  }

  return timingSafeEqual(expected, actualHash);
}

