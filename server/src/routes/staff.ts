import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";

import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireStaffUser, requirePermission } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { hashPassword } from "../auth/password.js";
import { getAiUsageReport, getAiUsageSummary } from "../services/ai-analytics.js";
import { assembleContext } from "../ai/context/assembler.js";
import { chatCompletion, type ChatMessage } from "../ai/gateway.js";
import { extractDeclarationPage } from "../ai/extraction.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRouteParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value) {
    throw new HttpError(400, `Missing route parameter: ${key}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const agencyCreateSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  adminEmail: z.string().trim().email(),
  adminFirstName: z.string().trim().min(1),
  adminLastName: z.string().trim().min(1),
  planTier: z.enum(["STANDARD", "STANDARD_AI"]).default("STANDARD"),
});

const agencySearchSchema = z.object({
  query: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const aiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  agencyId: z.string().trim().min(1).optional(),
  provider: z.string().trim().min(1).optional(),
  gateway: z.string().trim().min(1).optional(),
  surface: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  userType: z.enum(["STAFF", "AGENCY", "INSURED"]).optional(),
});

export const staffRouter = Router();

staffRouter.post(
  "/agencies",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const input = agencyCreateSchema.parse(request.body);

    const existingAgency = await prisma.agency.findUnique({
      where: { slug: input.slug },
    });
    if (existingAgency) {
      throw new HttpError(409, "An agency with this slug already exists.");
    }

    const principalRole = await prisma.role.findUniqueOrThrow({
      where: { key: "principal_agent" },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Agency
      const agency = await tx.agency.create({
        data: {
          name: input.name,
          slug: input.slug,
          planTier: input.planTier,
          hasInAppAi: input.planTier === "STANDARD_AI",
          status: "ACTIVE",
        },
      });

      // 2. Create/Link Admin User
      const user = await tx.user.upsert({
        where: { email: input.adminEmail },
        update: {
          firstName: input.adminFirstName,
          lastName: input.adminLastName,
          userType: "AGENCY",
        },
        create: {
          email: input.adminEmail,
          firstName: input.adminFirstName,
          lastName: input.adminLastName,
          userType: "AGENCY",
          isActive: true,
        },
      });

      // 3. Create Membership
      await tx.agencyMembership.create({
        data: {
          agencyId: agency.id,
          userId: user.id,
          roleId: principalRole.id,
          status: "ACTIVE",
          isPrimary: true,
          joinedAt: new Date(),
        },
      });

      // 4. Initialize Feature Flags (default from global flags)
      const flags = await tx.featureFlag.findMany();
      if (flags.length > 0) {
        await tx.agencyFeatureFlag.createMany({
          data: flags.map((f) => ({
            agencyId: agency.id,
            featureFlagId: f.id,
            enabled: f.defaultEnabled,
          })),
        });
      }

      // 5. Initialize Policy Type Settings
      const policyTypes = await tx.policyType.findMany({
        where: { isActive: true },
      });
      if (policyTypes.length > 0) {
        await tx.agencyPolicyTypeSetting.createMany({
          data: policyTypes.map((pt) => ({
            agencyId: agency.id,
            policyTypeId: pt.id,
            enabled: true,
          })),
        });
      }

      return agency;
    });

    response.status(201).json(result);
  })
);

const agencyUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  planTier: z.enum(["STANDARD", "STANDARD_AI"]).optional(),
  primaryEmail: z.string().email().nullable().optional(),
  primaryPhone: z.string().nullable().optional(),
  timezone: z.string().optional(),
});

const agencyFeaturesSchema = z.object({
  flags: z.array(
    z.object({
      featureFlagId: z.string().min(1),
      enabled: z.boolean(),
    })
  ),
});

const coverageKindEnum = z.enum(["COVERAGE", "ENDORSEMENT", "EXCLUSION"]);

const coverageDefinitionCreateSchema = z.object({
  code: z.string().trim().min(1).optional(),
  categoryId: z.string().optional(),
  policyTypeId: z.string().optional(),
  kind: coverageKindEnum.optional(),
  name: z.string().trim().min(1),
  aliasOne: z.string().trim().optional(),
  aliasTwo: z.string().trim().optional(),
  definition: z.string().trim().optional(),
  claimExamples: z.string().trim().optional(),
  additionalHelp: z.string().trim().optional(),
  riskSummary: z.string().trim().optional(),
  isCommonlyRecommended: z.boolean().optional(),
});

const coverageDefinitionUpdateSchema = z.object({
  code: z.string().trim().min(1).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  policyTypeId: z.string().nullable().optional(),
  kind: coverageKindEnum.optional(),
  name: z.string().trim().min(1).optional(),
  aliasOne: z.string().trim().nullable().optional(),
  aliasTwo: z.string().trim().nullable().optional(),
  definition: z.string().trim().nullable().optional(),
  claimExamples: z.string().trim().nullable().optional(),
  additionalHelp: z.string().trim().nullable().optional(),
  riskSummary: z.string().trim().nullable().optional(),
  isCommonlyRecommended: z.boolean().optional(),
});

const coverageDefinitionQuerySchema = z.object({
  policyTypeId: z.string().optional(),
});

const carrierCreateSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  naicCode: z.string().trim().optional(),
});

const policyTypeCreateSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  lineOfBusiness: z.string().trim().optional(),
});

const policyTypeUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  lineOfBusiness: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

const contextBlockCreateSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["STATIC", "TEMPLATE", "QUERY_TEMPLATE"]),
  scope: z.enum(["GLOBAL", "AGENCY", "POLICY_TYPE", "CARRIER_OFFERING"]).optional().default("GLOBAL"),
  content: z.string(),
  resolverKey: z.string().trim().nullable().optional(),
  agents: z.array(z.string()).optional().default([]),
  sortOrder: z.number().int().optional().default(100),
  isActive: z.boolean().optional().default(true),
  requiredFeatureFlag: z.string().trim().nullable().optional(),
  allowedUserTypes: z.array(z.string()).optional().default([]),
  requiredPlanTier: z.enum(["STANDARD", "STANDARD_AI"]).nullable().optional(),
  agencyId: z.string().nullable().optional(),
  policyTypeId: z.string().nullable().optional(),
  offeringId: z.string().nullable().optional(),
});

const contextBlockUpdateSchema = z.object({
  key: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  type: z.enum(["STATIC", "TEMPLATE", "QUERY_TEMPLATE"]).optional(),
  scope: z.enum(["GLOBAL", "AGENCY", "POLICY_TYPE", "CARRIER_OFFERING"]).optional(),
  content: z.string().optional(),
  resolverKey: z.string().trim().nullable().optional(),
  agents: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  requiredFeatureFlag: z.string().trim().nullable().optional(),
  allowedUserTypes: z.array(z.string()).optional(),
  requiredPlanTier: z.enum(["STANDARD", "STANDARD_AI"]).nullable().optional(),
  agencyId: z.string().nullable().optional(),
  policyTypeId: z.string().nullable().optional(),
  offeringId: z.string().nullable().optional(),
});

// ===========================================================================
// Dashboard
// ===========================================================================

staffRouter.get(
  "/dashboard",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    const auth = requirePermission(response, "staff.dashboard.view");

    const [
      totalAgencies,
      totalUsers,
      totalPolicies,
      totalReviews,
      totalInsureds,
      recentReviews,
      aiUsageLast7Days,
      aiUsageLast30Days,
    ] = await Promise.all([
      prisma.agency.count(),
      prisma.user.count(),
      prisma.policy.count(),
      prisma.reviewSession.count(),
      prisma.insuredAccount.count(),
      prisma.reviewSession.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          insuredAccount: { select: { displayName: true } },
          agency: { select: { name: true } },
          policy: { select: { policyType: { select: { name: true } } } },
        },
      }),
      auth.permissionKeys.includes("staff.ai_usage.view")
        ? getAiUsageSummary({ days: 7 })
        : null,
      auth.permissionKeys.includes("staff.ai_usage.view")
        ? getAiUsageSummary({ days: 30 })
        : null,
    ]);

    response.json({
      stats: {
        agencyCount: totalAgencies,
        userCount: totalUsers,
        policyCount: totalPolicies,
        reviewCount: totalReviews,
        insuredCount: totalInsureds,
      },
      recentReviews: recentReviews.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        insuredDisplayName: r.insuredAccount.displayName,
        agencyName: r.agency.name,
        policyTypeName: r.policy?.policyType?.name ?? null,
        summary: r.summary,
      })),
      aiUsage:
        aiUsageLast7Days && aiUsageLast30Days
          ? {
              last7Days: {
                ...aiUsageLast7Days.summary,
                range: aiUsageLast7Days.range,
              },
              last30Days: {
                ...aiUsageLast30Days.summary,
                range: aiUsageLast30Days.range,
              },
              surfaces30Days: aiUsageLast30Days.breakdowns.surfaces,
              topAgencies30Days: aiUsageLast30Days.breakdowns.agencies,
            }
          : null,
    });
  })
);

staffRouter.get(
  "/ai-usage",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai_usage.view");

    const input = aiUsageQuerySchema.parse(request.query);
    const report = await getAiUsageReport(input);

    response.json(report);
  })
);

// ===========================================================================
// Agencies
// ===========================================================================

staffRouter.get(
  "/agencies",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.view");

    const input = agencySearchSchema.parse(request.query);
    const where = input.query
      ? {
          OR: [
            {
              name: {
                contains: input.query,
                mode: "insensitive" as const,
              },
            },
            {
              slug: {
                contains: input.query,
                mode: "insensitive" as const,
              },
            },
            {
              primaryEmail: {
                contains: input.query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : undefined;

    const agencies = await prisma.agency.findMany({
      ...(where ? { where } : {}),
      include: {
        featureFlags: {
          include: {
            featureFlag: true,
          },
        },
        _count: {
          select: {
            insuredAccounts: true,
            policies: true,
            memberships: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: input.limit,
    });

    response.json({
      items: agencies.map((agency) => ({
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        primaryEmail: agency.primaryEmail,
        primaryPhone: agency.primaryPhone,
        planTier: agency.planTier,
        hasInAppAi: agency.hasInAppAi,
        counts: agency._count,
        featureFlags: agency.featureFlags.map(({ featureFlag, enabled }) => ({
          key: featureFlag.key,
          enabled,
        })),
      })),
    });
  })
);

staffRouter.get(
  "/agencies/:agencyId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.view");

    const agencyId = getRouteParam(request, "agencyId");

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
            role: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        featureFlags: {
          include: {
            featureFlag: true,
          },
        },
        carrierAppointments: {
          include: {
            carrier: { select: { id: true, name: true } },
            state: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            insuredAccounts: true,
            policies: true,
            memberships: true,
            reviewSessions: true,
          },
        },
      },
    });

    if (!agency) {
      throw new HttpError(404, "Agency not found");
    }

    response.json({
      agency: {
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        primaryEmail: agency.primaryEmail,
        primaryPhone: agency.primaryPhone,
        planTier: agency.planTier,
        hasInAppAi: agency.hasInAppAi,
        timezone: agency.timezone,
        settings: agency.settings,
        createdAt: agency.createdAt,
        updatedAt: agency.updatedAt,
        counts: agency._count,
        members: agency.memberships.map((m) => ({
          id: m.id,
          userId: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          roleId: m.role.id,
          roleName: m.role.name,
          status: m.status,
          isPrimary: m.isPrimary,
        })),
        featureFlags: agency.featureFlags.map(({ featureFlag, enabled }) => ({
          featureFlagId: featureFlag.id,
          key: featureFlag.key,
          name: featureFlag.name,
          enabled,
        })),
        carrierAppointments: agency.carrierAppointments.map((a) => ({
          id: a.id,
          carrierId: a.carrier.id,
          carrierName: a.carrier.name,
          stateId: a.state?.id ?? null,
          stateCode: a.state?.code ?? null,
          stateName: a.state?.name ?? null,
        })),
      },
    });
  })
);

staffRouter.patch(
  "/agencies/:agencyId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const agencyId = getRouteParam(request, "agencyId");
    const input = agencyUpdateSchema.parse(request.body);

    const existing = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!existing) {
      throw new HttpError(404, "Agency not found");
    }

    const agency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.planTier ? { planTier: input.planTier, hasInAppAi: input.planTier === "STANDARD_AI" } : {}),
        ...(input.primaryEmail !== undefined ? { primaryEmail: input.primaryEmail } : {}),
        ...(input.primaryPhone !== undefined ? { primaryPhone: input.primaryPhone } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
      },
    });

    response.json({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      status: agency.status,
      primaryEmail: agency.primaryEmail,
      primaryPhone: agency.primaryPhone,
      planTier: agency.planTier,
      hasInAppAi: agency.hasInAppAi,
      timezone: agency.timezone,
      updatedAt: agency.updatedAt,
    });
  })
);

staffRouter.put(
  "/agencies/:agencyId/features",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const agencyId = getRouteParam(request, "agencyId");
    const input = agencyFeaturesSchema.parse(request.body);

    const existing = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!existing) {
      throw new HttpError(404, "Agency not found");
    }

    await prisma.$transaction(
      input.flags.map((flag) =>
        prisma.agencyFeatureFlag.upsert({
          where: {
            agencyId_featureFlagId: {
              agencyId,
              featureFlagId: flag.featureFlagId,
            },
          },
          create: {
            agencyId,
            featureFlagId: flag.featureFlagId,
            enabled: flag.enabled,
          },
          update: {
            enabled: flag.enabled,
          },
        })
      )
    );

    const flags = await prisma.agencyFeatureFlag.findMany({
      where: { agencyId },
      include: { featureFlag: true },
    });

    response.json({
      items: flags.map(({ featureFlag, enabled }) => ({
        featureFlagId: featureFlag.id,
        key: featureFlag.key,
        name: featureFlag.name,
        enabled,
      })),
    });
  })
);

// ===========================================================================
// Agency Carrier Appointments
// ===========================================================================

staffRouter.post(
  "/agencies/:agencyId/appointments",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const agencyId = getRouteParam(request, "agencyId");
    const { carrierId, stateId } = z.object({
      carrierId: z.string().min(1),
      stateId: z.string().min(1).optional(),
    }).parse(request.body);

    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new HttpError(404, "Agency not found");

    const existing = await prisma.agencyCarrierAppointment.findFirst({
      where: { agencyId, carrierId, stateId: stateId ?? null },
    });

    const appointment = existing
      ? existing
      : await prisma.agencyCarrierAppointment.create({
          data: { agencyId, carrierId, stateId: stateId ?? null },
        });

    const carrier = await prisma.carrier.findUniqueOrThrow({ where: { id: carrierId }, select: { id: true, name: true } });
    const state = stateId ? await prisma.state.findUnique({ where: { id: stateId }, select: { id: true, code: true, name: true } }) : null;

    response.status(201).json({
      id: appointment.id,
      carrierId: carrier.id,
      carrierName: carrier.name,
      stateId: state?.id ?? null,
      stateCode: state?.code ?? null,
      stateName: state?.name ?? null,
    });
  })
);

staffRouter.delete(
  "/agencies/:agencyId/appointments/:appointmentId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const agencyId = getRouteParam(request, "agencyId");
    const appointmentId = getRouteParam(request, "appointmentId");

    const appointment = await prisma.agencyCarrierAppointment.findFirst({
      where: { id: appointmentId, agencyId },
    });
    if (!appointment) throw new HttpError(404, "Appointment not found");

    await prisma.agencyCarrierAppointment.delete({ where: { id: appointmentId } });
    response.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Agency Insureds (lightweight lookups for context preview)
// ---------------------------------------------------------------------------

staffRouter.get(
  "/agencies/:agencyId/insureds",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.view");

    const agencyId = getRouteParam(request, "agencyId");

    const insureds = await prisma.insuredAccount.findMany({
      where: { agencyId },
      select: { id: true, displayName: true, accountCode: true },
      orderBy: { displayName: "asc" },
    });

    response.json({ items: insureds });
  })
);

staffRouter.get(
  "/agencies/:agencyId/insureds/:insuredAccountId/policies",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.view");

    const agencyId = getRouteParam(request, "agencyId");
    const insuredAccountId = getRouteParam(request, "insuredAccountId");

    const policies = await prisma.policy.findMany({
      where: { agencyId, insuredAccountId },
      select: {
        id: true,
        policyNumber: true,
        policyType: { select: { name: true } },
        carrier: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    response.json({
      items: policies.map((p) => ({
        id: p.id,
        label: [p.policyType.name, p.carrier?.name, p.policyNumber].filter(Boolean).join(" — "),
      })),
    });
  })
);

// ---------------------------------------------------------------------------
// Agency Members
// ---------------------------------------------------------------------------

staffRouter.patch(
  "/agencies/:agencyId/members/:membershipId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const agencyId = getRouteParam(request, "agencyId");
    const membershipId = getRouteParam(request, "membershipId");

    const input = z
      .object({
        roleId: z.string().min(1).optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .parse(request.body);

    const membership = await prisma.agencyMembership.findFirst({
      where: { id: membershipId, agencyId },
    });
    if (!membership) throw new HttpError(404, "Membership not found");

    if (input.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: input.roleId, scope: "AGENCY" },
      });
      if (!role) throw new HttpError(400, "Invalid agency role");
    }

    const updated = await prisma.agencyMembership.update({
      where: { id: membershipId },
      data: {
        ...(input.roleId ? { roleId: input.roleId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        role: { select: { id: true, name: true } },
      },
    });

    response.json({
      id: updated.id,
      userId: updated.user.id,
      email: updated.user.email,
      firstName: updated.user.firstName,
      lastName: updated.user.lastName,
      roleId: updated.role.id,
      roleName: updated.role.name,
      status: updated.status,
      isPrimary: updated.isPrimary,
    });
  })
);

// ===========================================================================
// Coverage Library
// ===========================================================================

staffRouter.get(
  "/coverage-categories",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.view");

    const categories = await prisma.coverageCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });

    response.json({
      items: categories.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
      })),
    });
  })
);

staffRouter.get(
  "/coverage-definitions",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.view");

    const query = coverageDefinitionQuerySchema.parse(request.query);

    const definitions = await prisma.coverageDefinition.findMany({
      where: {
        ...(query.policyTypeId ? { policyTypeId: query.policyTypeId } : {}),
      },
      include: {
        policyType: { select: { id: true, code: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
        _count: { select: { formMappings: true } },
      },
      orderBy: [{ policyType: { name: "asc" } }, { name: "asc" }],
    });

    response.json({
      items: definitions.map((d) => ({
        id: d.id,
        code: d.code,
        kind: d.kind,
        categoryId: d.categoryId,
        categoryName: d.category?.name ?? null,
        policyTypeId: d.policyTypeId,
        policyTypeName: d.policyType?.name ?? null,
        name: d.name,
        aliasOne: d.aliasOne,
        aliasTwo: d.aliasTwo,
        definition: d.definition,
        claimExamples: d.claimExamples,
        additionalHelp: d.additionalHelp,
        riskSummary: d.riskSummary,
        isCommonlyRecommended: d.isCommonlyRecommended,
        isActive: d.isActive,
        formMappingCount: d._count.formMappings,
      })),
    });
  })
);

staffRouter.post(
  "/coverage-definitions",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.manage");

    const input = coverageDefinitionCreateSchema.parse(request.body);

    const definition = await prisma.coverageDefinition.create({
      data: {
        name: input.name,
        ...(input.code ? { code: input.code } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.policyTypeId ? { policyType: { connect: { id: input.policyTypeId } } } : {}),
        ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
        ...(input.aliasOne ? { aliasOne: input.aliasOne } : {}),
        ...(input.aliasTwo ? { aliasTwo: input.aliasTwo } : {}),
        ...(input.definition ? { definition: input.definition } : {}),
        ...(input.claimExamples ? { claimExamples: input.claimExamples } : {}),
        ...(input.additionalHelp ? { additionalHelp: input.additionalHelp } : {}),
        ...(input.riskSummary ? { riskSummary: input.riskSummary } : {}),
        ...(input.isCommonlyRecommended !== undefined ? { isCommonlyRecommended: input.isCommonlyRecommended } : {}),
      },
      include: {
        policyType: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    response.status(201).json({
      id: definition.id,
      code: definition.code,
      kind: definition.kind,
      categoryId: definition.categoryId,
      categoryName: definition.category?.name ?? null,
      policyTypeId: definition.policyTypeId,
      policyTypeName: definition.policyType?.name ?? null,
      name: definition.name,
      aliasOne: definition.aliasOne,
      aliasTwo: definition.aliasTwo,
      definition: definition.definition,
      claimExamples: definition.claimExamples,
      additionalHelp: definition.additionalHelp,
      riskSummary: definition.riskSummary,
      isCommonlyRecommended: definition.isCommonlyRecommended,
      isActive: definition.isActive,
    });
  })
);

staffRouter.patch(
  "/coverage-definitions/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.manage");

    const id = getRouteParam(request, "id");
    const input = coverageDefinitionUpdateSchema.parse(request.body);

    const existing = await prisma.coverageDefinition.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Coverage definition not found");
    }

    const { policyTypeId, categoryId, kind, name, code, aliasOne, aliasTwo, definition: def, claimExamples, additionalHelp, riskSummary, isCommonlyRecommended } = input;
    const definition = await prisma.coverageDefinition.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(kind ? { kind } : {}),
        ...(aliasOne !== undefined ? { aliasOne } : {}),
        ...(aliasTwo !== undefined ? { aliasTwo } : {}),
        ...(def !== undefined ? { definition: def } : {}),
        ...(claimExamples !== undefined ? { claimExamples } : {}),
        ...(additionalHelp !== undefined ? { additionalHelp } : {}),
        ...(riskSummary !== undefined ? { riskSummary } : {}),
        ...(isCommonlyRecommended !== undefined ? { isCommonlyRecommended } : {}),
        ...(policyTypeId !== undefined
          ? policyTypeId
            ? { policyType: { connect: { id: policyTypeId } } }
            : { policyType: { disconnect: true } }
          : {}),
        ...(categoryId !== undefined
          ? categoryId
            ? { category: { connect: { id: categoryId } } }
            : { category: { disconnect: true } }
          : {}),
      },
      include: {
        policyType: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    response.json({
      id: definition.id,
      code: definition.code,
      kind: definition.kind,
      categoryId: definition.categoryId,
      categoryName: definition.category?.name ?? null,
      policyTypeId: definition.policyTypeId,
      policyTypeName: definition.policyType?.name ?? null,
      name: definition.name,
      aliasOne: definition.aliasOne,
      aliasTwo: definition.aliasTwo,
      definition: definition.definition,
      claimExamples: definition.claimExamples,
      additionalHelp: definition.additionalHelp,
      riskSummary: definition.riskSummary,
      isCommonlyRecommended: definition.isCommonlyRecommended,
      isActive: definition.isActive,
    });
  })
);

staffRouter.delete(
  "/coverage-definitions/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.manage");

    const id = getRouteParam(request, "id");

    const existing = await prisma.coverageDefinition.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Coverage definition not found");
    }

    await prisma.coverageDefinition.update({
      where: { id },
      data: { isActive: false },
    });

    response.json({ success: true });
  })
);

// ===========================================================================
// Agency Coverage Settings (availability matrix)
// ===========================================================================

const coverageSettingUpsertSchema = z.object({
  items: z.array(
    z.object({
      agencyCarrierAppointmentId: z.string(),
      coverageDefinitionId: z.string(),
      policyTypeId: z.string(),
      isAvailable: z.boolean(),
      limitTiers: z
        .array(z.object({ value: z.number(), label: z.string() }))
        .nullable()
        .optional(),
      defaultLimitValue: z.number().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
    })
  ),
});

staffRouter.get(
  "/agencies/:agencyId/coverage-settings",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.view");

    const agencyId = getRouteParam(request, "agencyId");

    const settings = await prisma.agencyCoverageSetting.findMany({
      where: {
        appointment: { agencyId },
      },
      include: {
        appointment: {
          include: {
            carrier: { select: { id: true, name: true } },
            state: { select: { id: true, code: true, name: true } },
          },
        },
        coverageDefinition: { select: { id: true, code: true, name: true, kind: true } },
        policyType: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { policyType: { name: "asc" } },
        { coverageDefinition: { name: "asc" } },
      ],
    });

    response.json({
      items: settings.map((s) => ({
        id: s.id,
        agencyCarrierAppointmentId: s.agencyCarrierAppointmentId,
        carrierName: s.appointment.carrier.name,
        stateCode: s.appointment.state?.code ?? null,
        stateName: s.appointment.state?.name ?? null,
        coverageDefinitionId: s.coverageDefinitionId,
        coverageDefinitionCode: s.coverageDefinition.code,
        coverageDefinitionName: s.coverageDefinition.name,
        coverageKind: s.coverageDefinition.kind,
        policyTypeId: s.policyTypeId,
        policyTypeName: s.policyType.name,
        isAvailable: s.isAvailable,
        limitTiers: s.limitTiers,
        defaultLimitValue: s.defaultLimitValue ? Number(s.defaultLimitValue) : null,
        notes: s.notes,
      })),
    });
  })
);

staffRouter.put(
  "/agencies/:agencyId/coverage-settings",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.agencies.manage");

    const agencyId = getRouteParam(request, "agencyId");
    const input = coverageSettingUpsertSchema.parse(request.body);

    // Verify all appointments belong to this agency
    const appointmentIds = [...new Set(input.items.map((i) => i.agencyCarrierAppointmentId))];
    const appointments = await prisma.agencyCarrierAppointment.findMany({
      where: { id: { in: appointmentIds }, agencyId },
    });
    if (appointments.length !== appointmentIds.length) {
      throw new HttpError(400, "One or more appointments do not belong to this agency");
    }

    // Upsert each setting
    const results = await Promise.all(
      input.items.map((item) => {
        const optionals: Record<string, unknown> = {};
        if (item.limitTiers != null) optionals.limitTiers = item.limitTiers;
        if (item.defaultLimitValue != null) optionals.defaultLimitValue = item.defaultLimitValue;
        if (item.notes != null) optionals.notes = item.notes;

        return prisma.agencyCoverageSetting.upsert({
          where: {
            agencyCarrierAppointmentId_coverageDefinitionId_policyTypeId: {
              agencyCarrierAppointmentId: item.agencyCarrierAppointmentId,
              coverageDefinitionId: item.coverageDefinitionId,
              policyTypeId: item.policyTypeId,
            },
          },
          create: {
            agencyCarrierAppointmentId: item.agencyCarrierAppointmentId,
            coverageDefinitionId: item.coverageDefinitionId,
            policyTypeId: item.policyTypeId,
            isAvailable: item.isAvailable,
            ...optionals,
          },
          update: {
            isAvailable: item.isAvailable,
            ...optionals,
          },
        });
      })
    );

    response.json({ updated: results.length });
  })
);

// ===========================================================================
// Carriers
// ===========================================================================

staffRouter.get(
  "/carriers",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.view");

    const carriers = await prisma.carrier.findMany({
      include: {
        _count: {
          select: { offerings: true },
        },
      },
      orderBy: { name: "asc" },
    });

    response.json({
      items: carriers.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        naicCode: c.naicCode,
        isActive: c.isActive,
        offeringCount: c._count.offerings,
      })),
    });
  })
);

staffRouter.post(
  "/carriers",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.manage");

    const input = carrierCreateSchema.parse(request.body);

    const { naicCode, ...carrierRest } = input;
    const carrier = await prisma.carrier.create({
      data: {
        ...carrierRest,
        ...(naicCode ? { naicCode } : {}),
      },
    });

    response.status(201).json({
      id: carrier.id,
      name: carrier.name,
      slug: carrier.slug,
      naicCode: carrier.naicCode,
      isActive: carrier.isActive,
    });
  })
);

staffRouter.get(
  "/carriers/:carrierId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.view");

    const carrierId = getRouteParam(request, "carrierId");

    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId },
      include: {
        offerings: {
          include: {
            state: { select: { code: true, name: true } },
            policyType: { select: { code: true, name: true } },
            _count: { select: { forms: true } },
          },
          orderBy: [{ policyType: { name: "asc" } }, { state: { code: "asc" } }],
        },
      },
    });

    if (!carrier) {
      throw new HttpError(404, "Carrier not found");
    }

    response.json({
      id: carrier.id,
      name: carrier.name,
      slug: carrier.slug,
      naicCode: carrier.naicCode,
      isActive: carrier.isActive,
      createdAt: carrier.createdAt,
      updatedAt: carrier.updatedAt,
      offerings: carrier.offerings.map((o) => ({
        id: o.id,
        stateCode: o.state.code,
        stateName: o.state.name,
        policyTypeCode: o.policyType.code,
        policyTypeName: o.policyType.name,
        isActive: o.isActive,
        formCount: o._count.forms,
      })),
    });
  })
);

staffRouter.get(
  "/offerings/:offeringId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.view");

    const offeringId = getRouteParam(request, "offeringId");

    const offering = await prisma.carrierPolicyOffering.findUnique({
      where: { id: offeringId },
      include: {
        carrier: { select: { id: true, name: true } },
        state: { select: { code: true, name: true } },
        policyType: { select: { code: true, name: true } },
        forms: {
          include: {
            coverageMappings: {
              include: {
                coverageDefinition: {
                  select: {
                    id: true, name: true, code: true, kind: true,
                    definition: true, riskSummary: true, claimExamples: true,
                    category: { select: { name: true } },
                  },
                },
              },
              orderBy: { coverageDefinition: { name: "asc" } },
            },
            sections: {
              where: { parentId: null },
              orderBy: { sortOrder: "asc" },
              include: {
                children: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
          orderBy: [{ isBasePolicy: "desc" }, { title: "asc" }],
        },
      },
    });

    if (!offering) {
      throw new HttpError(404, "Offering not found");
    }

    response.json({
      id: offering.id,
      carrierId: offering.carrier.id,
      carrierName: offering.carrier.name,
      stateCode: offering.state.code,
      stateName: offering.state.name,
      policyTypeCode: offering.policyType.code,
      policyTypeName: offering.policyType.name,
      isActive: offering.isActive,
      decExtractionHints: offering.decExtractionHints,
      forms: offering.forms.map((f) => ({
        id: f.id,
        title: f.title,
        formNumber: f.formNumber,
        version: f.version,
        kind: f.kind,
        isBasePolicy: f.isBasePolicy,
        coverageMappings: f.coverageMappings.map((m) => ({
          id: m.id,
          coverageDefinitionId: m.coverageDefinition.id,
          coverageDefinitionName: m.coverageDefinition.name,
          coverageDefinitionCode: m.coverageDefinition.code,
          coverageKind: m.coverageDefinition.kind,
          categoryName: m.coverageDefinition.category?.name ?? null,
          definition: m.coverageDefinition.definition,
          riskSummary: m.coverageDefinition.riskSummary,
          claimExamples: m.coverageDefinition.claimExamples,
          isManualOverride: m.isManualOverride,
          isRemoved: m.isRemoved,
          knownMaxLimit: m.knownMaxLimit,
        })),
        sections: f.sections.map((s) => ({
          id: s.id,
          sectionRef: s.sectionRef,
          title: s.title,
          sectionType: s.sectionType,
          content: s.content,
          children: s.children.map((c) => ({
            id: c.id,
            sectionRef: c.sectionRef,
            title: c.title,
            sectionType: c.sectionType,
            content: c.content,
          })),
        })),
      })),
    });
  })
);

// ===========================================================================
// Form Sections (extracted content)
// ===========================================================================

const sectionUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().optional(),
  sectionType: z.string().trim().optional(),
});

staffRouter.patch(
  "/form-sections/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.manage");

    const id = getRouteParam(request, "id");
    const input = sectionUpdateSchema.parse(request.body);

    const existing = await prisma.offeringFormSection.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Section not found");
    }

    const section = await prisma.offeringFormSection.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.sectionType !== undefined ? { sectionType: input.sectionType } : {}),
      },
    });

    response.json({
      id: section.id,
      sectionRef: section.sectionRef,
      title: section.title,
      sectionType: section.sectionType,
      content: section.content,
    });
  })
);

// ===========================================================================
// Coverage Mappings (on offering forms)
// ===========================================================================

const coverageMappingCreateSchema = z.object({
  offeringFormId: z.string(),
  coverageDefinitionId: z.string(),
  isManualOverride: z.boolean().optional().default(true),
  knownMaxLimit: z.number().nullable().optional(),
});

const coverageMappingUpdateSchema = z.object({
  isManualOverride: z.boolean().optional(),
  isRemoved: z.boolean().optional(),
  knownMaxLimit: z.number().nullable().optional(),
});

staffRouter.post(
  "/coverage-mappings",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.manage");

    const input = coverageMappingCreateSchema.parse(request.body);

    const mapping = await prisma.formCoverageMapping.create({
      data: {
        offeringFormId: input.offeringFormId,
        coverageDefinitionId: input.coverageDefinitionId,
        isManualOverride: input.isManualOverride,
        ...(input.knownMaxLimit != null ? { knownMaxLimit: input.knownMaxLimit } : {}),
      },
      include: {
        coverageDefinition: { select: { id: true, name: true } },
      },
    });

    response.status(201).json({
      id: mapping.id,
      coverageDefinitionId: mapping.coverageDefinition.id,
      coverageDefinitionName: mapping.coverageDefinition.name,
      isManualOverride: mapping.isManualOverride,
      isRemoved: mapping.isRemoved,
      knownMaxLimit: mapping.knownMaxLimit,
    });
  })
);

staffRouter.patch(
  "/coverage-mappings/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.manage");

    const id = getRouteParam(request, "id");
    const input = coverageMappingUpdateSchema.parse(request.body);

    const existing = await prisma.formCoverageMapping.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Coverage mapping not found");
    }

    const mapping = await prisma.formCoverageMapping.update({
      where: { id },
      data: {
        ...(input.isManualOverride !== undefined ? { isManualOverride: input.isManualOverride } : {}),
        ...(input.isRemoved !== undefined ? { isRemoved: input.isRemoved } : {}),
        ...(input.knownMaxLimit !== undefined ? { knownMaxLimit: input.knownMaxLimit } : {}),
      },
      include: {
        coverageDefinition: { select: { id: true, name: true } },
      },
    });

    response.json({
      id: mapping.id,
      coverageDefinitionId: mapping.coverageDefinition.id,
      coverageDefinitionName: mapping.coverageDefinition.name,
      isManualOverride: mapping.isManualOverride,
      isRemoved: mapping.isRemoved,
      knownMaxLimit: mapping.knownMaxLimit,
    });
  })
);

staffRouter.delete(
  "/coverage-mappings/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.manage");

    const id = getRouteParam(request, "id");

    const existing = await prisma.formCoverageMapping.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Coverage mapping not found");
    }

    await prisma.formCoverageMapping.delete({ where: { id } });
    response.json({ success: true });
  })
);

// ===========================================================================
// Policy Types
// ===========================================================================

staffRouter.get(
  "/policy-types",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.view");

    const types = await prisma.policyType.findMany({
      include: {
        _count: {
          select: {
            coverageDefinitions: true,
            offerings: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    response.json({
      items: types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        lineOfBusiness: t.lineOfBusiness,
        isActive: t.isActive,
        coverageDefinitionCount: t._count.coverageDefinitions,
        offeringCount: t._count.offerings,
      })),
    });
  })
);

staffRouter.post(
  "/policy-types",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.manage");

    const input = policyTypeCreateSchema.parse(request.body);

    const { lineOfBusiness, ...policyTypeRest } = input;
    const policyType = await prisma.policyType.create({
      data: {
        ...policyTypeRest,
        ...(lineOfBusiness ? { lineOfBusiness } : {}),
      },
    });

    response.status(201).json({
      id: policyType.id,
      code: policyType.code,
      name: policyType.name,
      lineOfBusiness: policyType.lineOfBusiness,
      isActive: policyType.isActive,
    });
  })
);

staffRouter.patch(
  "/policy-types/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.coverage.manage");

    const id = getRouteParam(request, "id");
    const input = policyTypeUpdateSchema.parse(request.body);

    const existing = await prisma.policyType.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Policy type not found");
    }

    const policyType = await prisma.policyType.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.lineOfBusiness !== undefined ? { lineOfBusiness: input.lineOfBusiness } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    response.json({
      id: policyType.id,
      code: policyType.code,
      name: policyType.name,
      lineOfBusiness: policyType.lineOfBusiness,
      isActive: policyType.isActive,
    });
  })
);

// ===========================================================================
// Context Blocks
// ===========================================================================

staffRouter.get(
  "/context-blocks",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.view");

    const blocks = await prisma.contextBlock.findMany({
      include: {
        policyType: { select: { id: true, name: true } },
        agency: { select: { id: true, name: true } },
        offering: {
          select: {
            id: true,
            carrier: { select: { name: true } },
            policyType: { select: { name: true } },
            state: { select: { code: true } },
          },
        },
      },
      orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    response.json({
      items: blocks.map((b) => ({
        id: b.id,
        key: b.key,
        name: b.name,
        type: b.type,
        scope: b.scope,
        content: b.content,
        resolverKey: b.resolverKey,
        agents: b.agents,
        sortOrder: b.sortOrder,
        isActive: b.isActive,
        requiredFeatureFlag: b.requiredFeatureFlag,
        allowedUserTypes: b.allowedUserTypes,
        requiredPlanTier: b.requiredPlanTier,
        agencyId: b.agencyId,
        agencyName: b.agency?.name ?? null,
        policyTypeId: b.policyTypeId,
        policyTypeName: b.policyType?.name ?? null,
        offeringId: b.offeringId,
        offeringLabel: b.offering
          ? `${b.offering.carrier.name} / ${b.offering.policyType.name} / ${b.offering.state.code}`
          : null,
      })),
    });
  })
);

staffRouter.post(
  "/context-blocks",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.manage");

    const input = contextBlockCreateSchema.parse(request.body);

    const { agencyId, policyTypeId, offeringId, resolverKey, requiredFeatureFlag, requiredPlanTier, ...blockRest } = input;
    const block = await prisma.contextBlock.create({
      data: {
        ...blockRest,
        ...(resolverKey !== undefined ? { resolverKey } : {}),
        ...(requiredFeatureFlag !== undefined ? { requiredFeatureFlag } : {}),
        ...(requiredPlanTier !== undefined ? { requiredPlanTier } : {}),
        ...(agencyId !== undefined ? { agencyId } : {}),
        ...(policyTypeId !== undefined ? { policyTypeId } : {}),
        ...(offeringId !== undefined ? { offeringId } : {}),
      },
    });

    response.status(201).json({
      id: block.id,
      key: block.key,
      name: block.name,
      type: block.type,
      scope: block.scope,
      content: block.content,
      resolverKey: block.resolverKey,
      agents: block.agents,
      sortOrder: block.sortOrder,
      isActive: block.isActive,
      requiredFeatureFlag: block.requiredFeatureFlag,
      allowedUserTypes: block.allowedUserTypes,
      requiredPlanTier: block.requiredPlanTier,
      agencyId: block.agencyId,
      policyTypeId: block.policyTypeId,
      offeringId: block.offeringId,
    });
  })
);

staffRouter.patch(
  "/context-blocks/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.manage");

    const id = getRouteParam(request, "id");
    const input = contextBlockUpdateSchema.parse(request.body);

    const existing = await prisma.contextBlock.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Context block not found");
    }

    const { agencyId, policyTypeId, offeringId, resolverKey, requiredFeatureFlag, requiredPlanTier, ...blockUpdateRest } = input;
    const block = await prisma.contextBlock.update({
      where: { id },
      data: {
        ...(blockUpdateRest.key ? { key: blockUpdateRest.key } : {}),
        ...(blockUpdateRest.name ? { name: blockUpdateRest.name } : {}),
        ...(blockUpdateRest.type ? { type: blockUpdateRest.type } : {}),
        ...(blockUpdateRest.scope ? { scope: blockUpdateRest.scope } : {}),
        ...(blockUpdateRest.content ? { content: blockUpdateRest.content } : {}),
        ...(blockUpdateRest.sortOrder !== undefined ? { sortOrder: blockUpdateRest.sortOrder } : {}),
        ...(blockUpdateRest.isActive !== undefined ? { isActive: blockUpdateRest.isActive } : {}),
        ...(blockUpdateRest.agents !== undefined ? { agents: blockUpdateRest.agents } : {}),
        ...(blockUpdateRest.allowedUserTypes !== undefined ? { allowedUserTypes: blockUpdateRest.allowedUserTypes } : {}),
        ...(resolverKey !== undefined ? { resolverKey } : {}),
        ...(requiredFeatureFlag !== undefined ? { requiredFeatureFlag } : {}),
        ...(requiredPlanTier !== undefined ? { requiredPlanTier } : {}),
        ...(agencyId !== undefined ? { agencyId } : {}),
        ...(policyTypeId !== undefined ? { policyTypeId } : {}),
        ...(offeringId !== undefined ? { offeringId } : {}),
      },
    });

    response.json({
      id: block.id,
      key: block.key,
      name: block.name,
      type: block.type,
      scope: block.scope,
      content: block.content,
      resolverKey: block.resolverKey,
      agents: block.agents,
      sortOrder: block.sortOrder,
      isActive: block.isActive,
      requiredFeatureFlag: block.requiredFeatureFlag,
      allowedUserTypes: block.allowedUserTypes,
      requiredPlanTier: block.requiredPlanTier,
      agencyId: block.agencyId,
      policyTypeId: block.policyTypeId,
      offeringId: block.offeringId,
    });
  })
);

staffRouter.delete(
  "/context-blocks/:id",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.manage");

    const id = getRouteParam(request, "id");

    const existing = await prisma.contextBlock.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Context block not found");
    }

    await prisma.contextBlock.delete({ where: { id } });

    response.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Context Preview helpers
// ---------------------------------------------------------------------------

async function resolvePreviewContext(input: {
  agent: string;
  agencyId?: string | undefined;
  insuredAccountId?: string | undefined;
  policyId?: string | undefined;
}) {
  let agencyId = input.agencyId;
  if (!agencyId) {
    const agency = await prisma.agency.findFirst({ select: { id: true } });
    if (!agency) throw new HttpError(400, "No agencies exist. Create one first.");
    agencyId = agency.id;
  }

  let policyTypeId: string | undefined;
  let carrierId: string | undefined;
  let stateId: string | undefined;
  let offeringId: string | undefined;

  if (input.policyId) {
    const policy = await prisma.policy.findUnique({
      where: { id: input.policyId },
      select: { policyTypeId: true, carrierId: true, stateId: true },
    });
    if (policy) {
      policyTypeId = policy.policyTypeId;
      carrierId = policy.carrierId ?? undefined;
      stateId = policy.stateId ?? undefined;
      if (carrierId && stateId) {
        const offering = await prisma.carrierPolicyOffering.findUnique({
          where: {
            carrierId_stateId_policyTypeId: { carrierId, stateId, policyTypeId },
          },
          select: { id: true },
        });
        offeringId = offering?.id;
      }
    }
  }

  return { agencyId, policyTypeId, carrierId, stateId, offeringId };
}

// ---------------------------------------------------------------------------
// GET /context-preview — Assemble and preview the full system prompt for an agent
// ---------------------------------------------------------------------------

const contextPreviewSchema = z.object({
  agent: z.string().min(1),
  agencyId: z.string().optional(),
  insuredAccountId: z.string().optional(),
  policyId: z.string().optional(),
});

staffRouter.get(
  "/context-preview",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.view");

    const input = contextPreviewSchema.parse(request.query);
    const resolved = await resolvePreviewContext(input);

    const assembled = await assembleContext({
      userId: "preview",
      userType: input.agent === "insured_review" ? "INSURED" : "AGENCY",
      agencyId: resolved.agencyId,
      agent: input.agent,
      insuredAccountId: input.insuredAccountId,
      policyId: input.policyId,
      policyTypeId: resolved.policyTypeId,
      carrierId: resolved.carrierId,
      stateId: resolved.stateId,
      offeringId: resolved.offeringId,
    });

    response.json({
      agent: input.agent,
      agencyId: resolved.agencyId,
      blockCount: assembled.blocks.length,
      blocks: assembled.blocks.map((b) => ({
        key: b.key,
        sortOrder: b.sortOrder,
        contentLength: b.content.length,
        content: b.content,
      })),
      systemPrompt: assembled.systemPrompt,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /context-preview/chat — Test chat using assembled context
// ---------------------------------------------------------------------------

const contextPreviewChatSchema = z.object({
  message: z.string().trim().min(1).max(10000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).default([]),
  agent: z.string().min(1),
  agencyId: z.string().optional(),
  insuredAccountId: z.string().optional(),
  policyId: z.string().optional(),
});

staffRouter.post(
  "/context-preview/chat",
  asyncHandler(async (request, response) => {
    const staffUser = await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.view");

    const input = contextPreviewChatSchema.parse(request.body);
    const resolved = await resolvePreviewContext(input);

    const assembled = await assembleContext({
      userId: "preview",
      userType: input.agent === "insured_review" ? "INSURED" : "AGENCY",
      agencyId: resolved.agencyId,
      agent: input.agent,
      insuredAccountId: input.insuredAccountId,
      policyId: input.policyId,
      policyTypeId: resolved.policyTypeId,
      carrierId: resolved.carrierId,
      stateId: resolved.stateId,
      offeringId: resolved.offeringId,
    });

    const messages: ChatMessage[] = [
      { role: "system", content: assembled.systemPrompt },
      ...input.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: input.message },
    ];

    const result = await chatCompletion({
      messages,
      usageContext: {
        operation: "chat_completion",
        surface: "context_preview_chat",
        userType: "STAFF",
        userId: staffUser.id,
        agencyId: resolved.agencyId,
        route: "/api/staff/context-preview/chat",
        meta: {
          agent: input.agent,
          contextBlockCount: assembled.blocks.length,
          historyLength: input.history.length,
        },
      },
    });

    response.json({
      message: result.content,
      model: result.model,
      usage: result.usage,
    });
  })
);

// ===========================================================================
// Feature Flags
// ===========================================================================

staffRouter.get(
  "/feature-flags",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.flags.view");

    const flags = await prisma.featureFlag.findMany({
      include: {
        _count: {
          select: { agencies: true },
        },
        agencies: {
          where: { enabled: true },
        },
      },
      orderBy: { name: "asc" },
    });

    response.json({
      items: flags.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        description: f.description,
        defaultEnabled: f.defaultEnabled,
        enabledAgencyCount: f.agencies.length,
      })),
    });
  })
);

// ===========================================================================
// Reference Data - States
// ===========================================================================

staffRouter.get(
  "/states",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);

    const states = await prisma.state.findMany({
      orderBy: { name: "asc" },
    });

    response.json({
      items: states.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        isActive: s.isActive,
      })),
    });
  })
);

// ===========================================================================
// Tool Definitions
// ===========================================================================

staffRouter.get(
  "/tools",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.view");

    const tools = await prisma.toolDefinition.findMany({
      orderBy: { sortOrder: "asc" },
    });

    response.json({
      items: tools.map((t) => ({
        id: t.id,
        key: t.key,
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        agents: t.agents,
        screens: t.screens,
        requiredFlags: t.requiredFlags,
        requiredPermission: t.requiredPermission,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
      })),
    });
  })
);

const toolUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  parameters: z.record(z.unknown()).optional(),
  agents: z.array(z.string().trim().min(1)).optional(),
  screens: z.array(z.string().trim().min(1)).optional(),
  requiredFlags: z.array(z.string().trim().min(1)).optional(),
  requiredPermission: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

staffRouter.patch(
  "/tools/:toolId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.manage");

    const toolId = getRouteParam(request, "toolId");
    const input = toolUpdateSchema.parse(request.body);

    const existing = await prisma.toolDefinition.findUnique({ where: { id: toolId } });
    if (!existing) {
      throw new HttpError(404, "Tool definition not found.");
    }

    const updated = await prisma.toolDefinition.update({
      where: { id: toolId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.parameters !== undefined ? { parameters: input.parameters as Prisma.InputJsonValue } : {}),
        ...(input.agents !== undefined ? { agents: input.agents } : {}),
        ...(input.screens !== undefined ? { screens: input.screens } : {}),
        ...(input.requiredFlags !== undefined ? { requiredFlags: input.requiredFlags } : {}),
        ...(input.requiredPermission !== undefined ? { requiredPermission: input.requiredPermission } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    response.json({
      id: updated.id,
      key: updated.key,
      name: updated.name,
      description: updated.description,
      parameters: updated.parameters,
      agents: updated.agents,
      screens: updated.screens,
      requiredFlags: updated.requiredFlags,
      requiredPermission: updated.requiredPermission,
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
    });
  })
);

// ===========================================================================
// Permissions
// ===========================================================================

staffRouter.get(
  "/permissions",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.rbac.view");

    const permissions = await prisma.permission.findMany({
      orderBy: [{ scope: "asc" }, { key: "asc" }],
      include: {
        _count: { select: { roles: true } },
      },
    });

    response.json({
      items: permissions.map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        description: p.description,
        scope: p.scope,
        roleCount: p._count.roles,
      })),
    });
  })
);

const permissionCreateSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  scope: z.enum(["STAFF", "AGENCY"]),
});

staffRouter.post(
  "/permissions",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.rbac.manage");

    const input = permissionCreateSchema.parse(request.body);

    const existing = await prisma.permission.findUnique({ where: { key: input.key } });
    if (existing) {
      throw new HttpError(409, "A permission with this key already exists.");
    }

    const permission = await prisma.permission.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        scope: input.scope,
      },
    });

    response.status(201).json({
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
      scope: permission.scope,
    });
  })
);

const permissionUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
});

staffRouter.patch(
  "/permissions/:permissionId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.rbac.manage");

    const permissionId = getRouteParam(request, "permissionId");
    const input = permissionUpdateSchema.parse(request.body);

    const existing = await prisma.permission.findUnique({ where: { id: permissionId } });
    if (!existing) {
      throw new HttpError(404, "Permission not found.");
    }

    const updated = await prisma.permission.update({
      where: { id: permissionId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });

    response.json({
      id: updated.id,
      key: updated.key,
      name: updated.name,
      description: updated.description,
      scope: updated.scope,
    });
  })
);

// ===========================================================================
// Roles
// ===========================================================================

staffRouter.get(
  "/roles",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.rbac.view");

    const roles = await prisma.role.findMany({
      orderBy: [{ scope: "asc" }, { key: "asc" }],
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { agencyMemberships: true, staffAssignments: true },
        },
      },
    });

    response.json({
      items: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        scope: r.scope,
        isSystem: r.isSystem,
        permissions: r.permissions.map((rp) => ({
          id: rp.permission.id,
          key: rp.permission.key,
          name: rp.permission.name,
        })),
        assignmentCount: r._count.agencyMemberships + r._count.staffAssignments,
      })),
    });
  })
);

const roleCreateSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  scope: z.enum(["STAFF", "AGENCY"]),
  permissionIds: z.array(z.string()).default([]),
});

staffRouter.post(
  "/roles",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.rbac.manage");

    const input = roleCreateSchema.parse(request.body);

    const existing = await prisma.role.findUnique({ where: { key: input.key } });
    if (existing) {
      throw new HttpError(409, "A role with this key already exists.");
    }

    const role = await prisma.role.create({
      data: {
        key: input.key,
        name: input.name,
        scope: input.scope,
        isSystem: false,
        permissions: {
          create: input.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    response.status(201).json({
      id: role.id,
      key: role.key,
      name: role.name,
      scope: role.scope,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        name: rp.permission.name,
      })),
    });
  })
);

const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  permissionIds: z.array(z.string()).optional(),
});

staffRouter.patch(
  "/roles/:roleId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.rbac.manage");

    const roleId = getRouteParam(request, "roleId");
    const input = roleUpdateSchema.parse(request.body);

    const existing = await prisma.role.findUnique({ where: { id: roleId } });
    if (!existing) {
      throw new HttpError(404, "Role not found.");
    }

    // Update name if provided
    if (input.name !== undefined) {
      await prisma.role.update({
        where: { id: roleId },
        data: { name: input.name },
      });
    }

    // Replace permissions if provided
    if (input.permissionIds !== undefined) {
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        ...input.permissionIds.map((permissionId) =>
          prisma.rolePermission.create({
            data: { roleId, permissionId },
          })
        ),
      ]);
    }

    const updated = await prisma.role.findUniqueOrThrow({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { agencyMemberships: true, staffAssignments: true } },
      },
    });

    response.json({
      id: updated.id,
      key: updated.key,
      name: updated.name,
      scope: updated.scope,
      isSystem: updated.isSystem,
      permissions: updated.permissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        name: rp.permission.name,
      })),
      assignmentCount: updated._count.agencyMemberships + updated._count.staffAssignments,
    });
  })
);

// ===========================================================================
// Staff Users
// ===========================================================================

const staffUserCreateSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  password: z.string().min(8),
  roleIds: z.array(z.string()).default([]),
});

const staffUserUpdateSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  roleIds: z.array(z.string()).optional(),
});

staffRouter.get(
  "/staff-users",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    await requirePermission(response, "staff.users.view");

    const users = await prisma.user.findMany({
      where: { userType: "STAFF" },
      include: { staffRoles: { include: { role: true } } },
      orderBy: { email: "asc" },
    });

    response.json({
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive,
        createdAt: u.createdAt,
        roles: u.staffRoles.map((sr) => ({
          id: sr.role.id,
          key: sr.role.key,
          name: sr.role.name,
        })),
      })),
    });
  })
);

staffRouter.post(
  "/staff-users",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    await requirePermission(response, "staff.users.manage");

    const input = staffUserCreateSchema.parse(request.body);

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new HttpError(409, "A user with this email already exists.");
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          userType: "STAFF",
          isActive: true,
          passwordHash: hashPassword(input.password),
        },
      });

      if (input.roleIds.length > 0) {
        await tx.staffUserRole.createMany({
          data: input.roleIds.map((roleId) => ({
            userId: created.id,
            roleId,
          })),
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { staffRoles: { include: { role: true } } },
      });
    });

    response.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.staffRoles.map((sr) => ({
        id: sr.role.id,
        key: sr.role.key,
        name: sr.role.name,
      })),
    });
  })
);

staffRouter.patch(
  "/staff-users/:userId",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    await requirePermission(response, "staff.users.manage");

    const userId = getRouteParam(request, "userId");
    const input = staffUserUpdateSchema.parse(request.body);

    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing || existing.userType !== "STAFF") {
      throw new HttpError(404, "Staff user not found.");
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.password !== undefined ? { passwordHash: hashPassword(input.password) } : {}),
        },
      });

      if (input.roleIds !== undefined) {
        await tx.staffUserRole.deleteMany({ where: { userId } });
        if (input.roleIds.length > 0) {
          await tx.staffUserRole.createMany({
            data: input.roleIds.map((roleId) => ({
              userId,
              roleId,
            })),
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { staffRoles: { include: { role: true } } },
      });
    });

    response.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.staffRoles.map((sr) => ({
        id: sr.role.id,
        key: sr.role.key,
        name: sr.role.name,
      })),
    });
  })
);

// ===========================================================================
// Dec Page Extraction
// ===========================================================================

const extractionHintsSchema = z.object({
  decExtractionHints: z.string().nullable(),
});

staffRouter.patch(
  "/offerings/:offeringId/extraction-hints",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.carriers.manage");

    const offeringId = getRouteParam(request, "offeringId");
    const input = extractionHintsSchema.parse(request.body);

    const offering = await prisma.carrierPolicyOffering.update({
      where: { id: offeringId },
      data: { decExtractionHints: input.decExtractionHints },
      include: {
        carrier: { select: { name: true } },
        state: { select: { code: true } },
        policyType: { select: { code: true } },
      },
    });

    response.json({
      id: offering.id,
      carrierName: offering.carrier.name,
      stateCode: offering.state.code,
      policyTypeCode: offering.policyType.code,
      decExtractionHints: offering.decExtractionHints,
    });
  })
);

const decExtractionSchema = z.object({
  pageImages: z
    .array(z.string().min(1))
    .min(1, "At least one page image is required."),
  carrierName: z.string().optional(),
  stateCode: z.string().optional(),
  policyTypeCode: z.string().optional(),
  hints: z.string().optional(),
});

staffRouter.post(
  "/extract-dec-page",
  asyncHandler(async (request, response) => {
    await requireStaffUser(request, response);
    requirePermission(response, "staff.ai.manage");

    const input = decExtractionSchema.parse(request.body);
    const userId = (response.locals.user as { id: string }).id;

    const result = await extractDeclarationPage({
      pageImages: input.pageImages,
      carrierName: input.carrierName,
      stateCode: input.stateCode,
      policyTypeCode: input.policyTypeCode,
      hints: input.hints,
      userId,
    });

    response.json(result);
  })
);
