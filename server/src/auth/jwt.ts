import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export type SessionTokenPayload = {
  sub: string;
  email: string;
  userType: "STAFF" | "AGENCY" | "INSURED";
  roleKeys: string[];
  permissionKeys: string[];
} & (
  | {
      activeAgencyId: string;
    }
  | {
      activeAgencyId?: never;
    }
);

const ACCESS_TOKEN_TTL = "12h";

export function signSessionToken(payload: SessionTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL
  });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"]
  }) as SessionTokenPayload;
}
