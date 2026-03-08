import type { Request, Response } from "express";

import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { verifySessionToken, type SessionTokenPayload } from "../auth/jwt.js";

type AuthenticatedUser = {
  id: string;
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

type AgencyAuth = AuthenticatedUser & {
  userType: "AGENCY";
  activeAgencyId: string;
};

type StaffAuth = AuthenticatedUser & {
  userType: "STAFF";
};

type InsuredAuth = AuthenticatedUser & {
  userType: "INSURED";
};

export type AuthLocals = {
  auth?: AuthenticatedUser;
};

function getBearerToken(request: Request) {
  const value = request.header("authorization");

  if (!value?.startsWith("Bearer ")) {
    return undefined;
  }

  return value.slice("Bearer ".length);
}

async function loadUser(payload: SessionTokenPayload): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUnique({
    where: {
      id: payload.sub
    },
    select: {
      id: true,
      email: true,
      userType: true,
      isActive: true
    }
  });

  if (!user?.isActive) {
    throw new HttpError(401, "The authenticated user is inactive.");
  }

  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    roleKeys: payload.roleKeys,
    permissionKeys: payload.permissionKeys,
    ...(payload.activeAgencyId ? { activeAgencyId: payload.activeAgencyId } : {})
  };
}

export async function requireAuth(request: Request, response: Response) {
  const token = getBearerToken(request);

  if (!token) {
    throw new HttpError(401, "Missing bearer token.");
  }

  const payload = verifySessionToken(token);
  const auth = await loadUser(payload);

  response.locals.auth = auth;

  return auth;
}

export async function requireAgencyUser(request: Request, response: Response): Promise<AgencyAuth> {
  const auth = await requireAuth(request, response);

  if (auth.userType !== "AGENCY" || !auth.activeAgencyId) {
    throw new HttpError(403, "Agency access is required for this endpoint.");
  }

  const agency = await prisma.agency.findUnique({
    where: { id: auth.activeAgencyId },
    select: { status: true }
  });

  if (!agency || agency.status !== "ACTIVE") {
    throw new HttpError(403, "This agency account is inactive.");
  }

  return {
    ...auth,
    userType: "AGENCY",
    activeAgencyId: auth.activeAgencyId
  };
}

export async function requireStaffUser(request: Request, response: Response): Promise<StaffAuth> {
  const auth = await requireAuth(request, response);

  if (auth.userType !== "STAFF") {
    throw new HttpError(403, "Staff access is required for this endpoint.");
  }

  return {
    ...auth,
    userType: "STAFF"
  };
}

export async function requireInsuredUser(request: Request, response: Response): Promise<InsuredAuth> {
  const auth = await requireAuth(request, response);

  if (auth.userType !== "INSURED") {
    throw new HttpError(403, "Insured access is required for this endpoint.");
  }

  return {
    ...auth,
    userType: "INSURED"
  };
}

export function requirePermission(response: Response, permissionKey: string) {
  const auth = response.locals.auth as AuthenticatedUser | undefined;

  if (!auth) {
    throw new HttpError(500, "Permission guard requires an authenticated context.");
  }

  if (!auth.permissionKeys.includes(permissionKey)) {
    throw new HttpError(403, `Missing permission: ${permissionKey}`);
  }

  return auth;
}
