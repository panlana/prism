import { createHash, randomBytes } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { signSessionToken, type SessionTokenPayload } from "./jwt.js";
import { verifyPassword } from "./password.js";

const userSessionInclude = {
  agencyMemberships: {
    where: {
      status: "ACTIVE",
      agency: { status: "ACTIVE" }
    },
    include: {
      agency: true,
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  },
  staffRoles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  },
  contacts: {
    include: {
      insuredAccount: {
        include: {
          agency: true
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

type UserWithSessionRelations = Prisma.UserGetPayload<{
  include: typeof userSessionInclude;
}>;

export type SessionEnvelope = {
  token: string;
  auth: SessionTokenPayload;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    userType: UserWithSessionRelations["userType"];
  };
  activeAgency:
    | {
        id: string;
        name: string;
        slug: string;
        roleKey?: string;
        hasInAppAi?: boolean;
        planTier?: string;
      }
    | undefined;
  agencyMemberships: Array<{
    agencyId: string;
    agencyName: string;
    agencySlug: string;
    roleKey: string;
    isPrimary: boolean;
  }>;
  insuredAccounts: Array<{
    id: string;
    accountCode: string;
    displayName: string;
    agencyId: string;
    agencyName: string;
    agencySlug: string;
  }>;
};

function buildAgencyContext(user: UserWithSessionRelations, agencySlug?: string) {
  if (user.userType !== "AGENCY") {
    return undefined;
  }

  const membership =
    (agencySlug
      ? user.agencyMemberships.find((candidate) => candidate.agency.slug === agencySlug)
      : undefined) ??
    user.agencyMemberships.find((candidate) => candidate.isPrimary) ??
    user.agencyMemberships[0];

  if (!membership) {
    throw new HttpError(403, "No active agency membership is available for this user.");
  }

  const permissionKeys = membership.role.permissions.map(({ permission }) => permission.key);

  return {
    activeAgencyId: membership.agencyId,
    roleKeys: [membership.role.key],
    permissionKeys,
    activeAgency: {
      id: membership.agency.id,
      name: membership.agency.name,
      slug: membership.agency.slug,
      roleKey: membership.role.key,
      hasInAppAi: membership.agency.hasInAppAi,
      planTier: membership.agency.planTier,
    }
  };
}

function buildStaffContext(user: UserWithSessionRelations) {
  if (user.userType !== "STAFF") {
    return undefined;
  }

  const roleKeys = user.staffRoles.map(({ role }) => role.key);
  const permissionKeys = Array.from(
    new Set(
      user.staffRoles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key)
      )
    )
  );

  return {
    activeAgencyId: undefined,
    roleKeys,
    permissionKeys,
    activeAgency: undefined
  };
}

function buildInsuredContext(user: UserWithSessionRelations) {
  if (user.userType !== "INSURED") {
    return undefined;
  }

  const firstAccount = user.contacts[0]?.insuredAccount;

  return {
    activeAgencyId: firstAccount?.agencyId,
    roleKeys: [],
    permissionKeys: [],
    activeAgency: firstAccount
      ? {
          id: firstAccount.agency.id,
          name: firstAccount.agency.name,
          slug: firstAccount.agency.slug
        }
      : undefined
  };
}

function buildSessionEnvelope(user: UserWithSessionRelations, agencySlug?: string): SessionEnvelope {
  const context =
    buildAgencyContext(user, agencySlug) ??
    buildStaffContext(user) ??
    buildInsuredContext(user);

  if (!context) {
    throw new HttpError(403, "Unable to build an authenticated session for this user.");
  }

  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    userType: user.userType,
    roleKeys: context.roleKeys,
    permissionKeys: context.permissionKeys,
    ...(context.activeAgencyId ? { activeAgencyId: context.activeAgencyId } : {})
  };

  return {
    token: signSessionToken(payload),
    auth: payload,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      userType: user.userType
    },
    activeAgency: context.activeAgency,
    agencyMemberships: user.agencyMemberships.map((membership) => ({
      agencyId: membership.agencyId,
      agencyName: membership.agency.name,
      agencySlug: membership.agency.slug,
      roleKey: membership.role.key,
      isPrimary: membership.isPrimary
    })),
    insuredAccounts: user.contacts.map(({ insuredAccount }) => ({
      id: insuredAccount.id,
      accountCode: insuredAccount.accountCode,
      displayName: insuredAccount.displayName,
      agencyId: insuredAccount.agencyId,
      agencyName: insuredAccount.agency.name,
      agencySlug: insuredAccount.agency.slug
    }))
  };
}

export async function createPasswordSession(input: {
  email: string;
  password: string;
  agencySlug?: string | undefined;
}) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email.toLowerCase().trim()
    },
    include: userSessionInclude
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Invalid email or password.");
  }

  if (user.userType === "INSURED") {
    throw new HttpError(400, "Insured users must sign in using a magic link.");
  }

  if (!verifyPassword(input.password, user.passwordHash)) {
    throw new HttpError(401, "Invalid email or password.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date()
    }
  });

  return buildSessionEnvelope(user, input.agencySlug);
}

export async function createMagicLinkSession(input: {
  email: string;
  tokenHash: string;
}) {
  const token = await prisma.magicLoginToken.findFirst({
    where: {
      email: input.email.toLowerCase().trim(),
      tokenHash: input.tokenHash,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!token) {
    throw new HttpError(401, "The magic link is invalid or has expired.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: token.userId
    },
    include: userSessionInclude
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "The magic link user is unavailable.");
  }

  await prisma.$transaction([
    prisma.magicLoginToken.update({
      where: {
        id: token.id
      },
      data: {
        consumedAt: new Date()
      }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date()
      }
    })
  ]);

  return buildSessionEnvelope(user);
}

export async function requestMagicLink(input: { email: string }) {
  const normalizedEmail = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    include: {
      contacts: true
    }
  });

  if (!user || !user.isActive || user.userType !== "INSURED" || user.contacts.length === 0) {
    throw new HttpError(404, "No insured account is available for that email address.");
  }

  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

  await prisma.$transaction([
    prisma.magicLoginToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null
      },
      data: {
        consumedAt: new Date()
      }
    }),
    prisma.magicLoginToken.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        tokenHash,
        expiresAt
      }
    })
  ]);

  return {
    sent: true,
    expiresAt,
    ...(process.env.NODE_ENV !== "production" ? { debugToken: rawToken } : {})
  };
}

export async function createAgencySwitchSession(input: {
  userId: string;
  agencySlug: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: userSessionInclude
  });

  if (!user || !user.isActive || user.userType !== "AGENCY") {
    throw new HttpError(403, "Agency switching is only available to active agency users.");
  }

  return buildSessionEnvelope(user, input.agencySlug);
}

export async function getSessionEnvelope(userId: string, agencyId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userSessionInclude
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Authenticated user could not be found.");
  }

  const agencySlug = agencyId
    ? user.agencyMemberships.find((membership) => membership.agencyId === agencyId)?.agency.slug
    : undefined;

  return buildSessionEnvelope(user, agencySlug);
}
