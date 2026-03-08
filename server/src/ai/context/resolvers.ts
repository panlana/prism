import { prisma } from "../../lib/db.js";
import type { ConversationContext, Resolver, ResolverRegistry } from "./types.js";

const agencyProfile: Resolver = async (ctx) => {
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: ctx.agencyId },
    include: {
      carrierAppointments: {
        include: {
          carrier: true,
          state: true,
        },
      },
      notificationEndpoints: {
        where: { isEnabled: true },
      },
    },
  });

  return {
    agency: {
      name: agency.name,
      primaryEmail: agency.primaryEmail,
      primaryPhone: agency.primaryPhone,
      timezone: agency.timezone,
      carriers: agency.carrierAppointments.map((a) => ({
        name: a.carrier.name,
        state: a.state?.name ?? "All states",
      })),
      notificationEndpoints: agency.notificationEndpoints.map((n) => ({
        kind: n.kind,
        label: n.label,
        destination: n.destination,
      })),
    },
  };
};

const insuredProfile: Resolver = async (ctx) => {
  if (!ctx.insuredAccountId) return { insured: null };

  const insured = await prisma.insuredAccount.findUniqueOrThrow({
    where: { id: ctx.insuredAccountId },
    include: {
      primaryState: true,
      contacts: {
        orderBy: { isPrimary: "desc" },
      },
    },
  });

  return {
    insured: {
      id: insured.id,
      accountCode: insured.accountCode,
      displayName: insured.displayName,
      state: insured.primaryState?.name,
      primaryEmail: insured.primaryEmail,
      primaryPhone: insured.primaryPhone,
      address: [insured.streetLineOne, insured.streetLineTwo, insured.city]
        .filter(Boolean)
        .join(", "),
      contacts: insured.contacts.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(" "),
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
      })),
    },
  };
};

const insuredPolicies: Resolver = async (ctx) => {
  if (!ctx.insuredAccountId) return { policies: [] };

  const policies = await prisma.policy.findMany({
    where: {
      insuredAccountId: ctx.insuredAccountId,
      agencyId: ctx.agencyId,
      status: "ACTIVE",
    },
    include: {
      policyType: true,
      carrier: true,
      state: true,
      formSelections: {
        include: {
          offeringForm: {
            include: {
              coverageMappings: {
                where: { isRemoved: false },
                include: { coverageDefinition: true },
              },
            },
          },
        },
      },
    },
  });

  return {
    policies: policies.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber,
      type: p.policyType.name,
      carrier: p.carrier?.name ?? p.extractedCarrierName,
      state: p.state?.name,
      status: p.status,
      premium: p.premium?.toString(),
      effectiveDate: p.effectiveDate?.toISOString().split("T")[0],
      expirationDate: p.expirationDate?.toISOString().split("T")[0],
      readinessSource: p.readinessSource,
      coverages: p.formSelections.map((fs) => ({
        formTitle: fs.offeringForm.title,
        formNumber: fs.offeringForm.formNumber,
        limit: fs.limitText,
        coverageNames: fs.offeringForm.coverageMappings.map(
          (m) => m.coverageDefinition.name
        ),
      })),
    })),
  };
};

const policyCoverages: Resolver = async (ctx) => {
  if (!ctx.policyId) return { currentPolicy: null };

  const policy = await prisma.policy.findUniqueOrThrow({
    where: { id: ctx.policyId },
    include: {
      policyType: true,
      carrier: true,
      state: true,
      coverages: {
        orderBy: { sortOrder: "asc" },
      },
      formSelections: {
        include: {
          offeringForm: {
            include: {
              coverageMappings: {
                where: { isRemoved: false },
                include: { coverageDefinition: true },
              },
            },
          },
        },
      },
      declarationPages: {
        where: { isActive: true },
        include: { document: true },
      },
    },
  });

  return {
    currentPolicy: {
      policyNumber: policy.policyNumber,
      type: policy.policyType.name,
      carrier: policy.carrier?.name ?? policy.extractedCarrierName,
      state: policy.state?.name,
      premium: policy.premium?.toString(),
      effectiveDate: policy.effectiveDate?.toISOString().split("T")[0],
      expirationDate: policy.expirationDate?.toISOString().split("T")[0],
      producerName: policy.producerName,
      locationName: policy.locationName,
      policyFormCode: policy.policyFormCode,
      deductible: policy.deductible?.toString(),
      decForms: policy.decForms,
      coverages: policy.coverages.map((c) => ({
        section: c.section,
        label: c.label,
        coverageCode: c.coverageCode,
        limit: c.limitText ?? c.limitAmount?.toString(),
        premium: c.premiumText ?? c.premiumAmount?.toString(),
        deductible: c.deductible,
      })),
      formSelections: policy.formSelections.map((fs) => ({
        formTitle: fs.offeringForm.title,
        formNumber: fs.offeringForm.formNumber,
        limit: fs.limitText,
        mappedCoverages: fs.offeringForm.coverageMappings.map((m) => ({
          name: m.coverageDefinition.name,
          alias: m.coverageDefinition.aliasOne,
          definition: m.coverageDefinition.definition,
          maxLimit: m.knownMaxLimit?.toString(),
        })),
      })),
      hasDecPage: policy.declarationPages.length > 0,
      decPageSummary: policy.declarationPages[0]?.extractedSummary ?? null,
    },
  };
};

const carrierForms: Resolver = async (ctx) => {
  const offeringId = ctx.offeringId;
  if (!offeringId) return { carrierForms: [] };

  const forms = await prisma.offeringForm.findMany({
    where: { offeringId },
    include: {
      coverageMappings: {
        where: { isRemoved: false },
        include: { coverageDefinition: true },
      },
      sections: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ isBasePolicy: "desc" }, { title: "asc" }],
  });

  return {
    carrierForms: forms.map((f) => ({
      title: f.title,
      formNumber: f.formNumber,
      kind: f.kind,
      isBasePolicy: f.isBasePolicy,
      isPackageEndorsement: f.isPackageEndorsement,
      mutuallyExclusiveGroup: f.mutuallyExclusiveGroup,
      summary: f.textSummary,
      sections: f.sections.map((s) => ({
        title: s.title,
        type: s.sectionType,
        content: s.content,
      })),
      coverages: f.coverageMappings.map((m) => ({
        name: m.coverageDefinition.name,
        alias: m.coverageDefinition.aliasOne,
        definition: m.coverageDefinition.definition,
        claimExamples: m.coverageDefinition.claimExamples,
        additionalHelp: m.coverageDefinition.additionalHelp,
        maxLimit: m.knownMaxLimit?.toString(),
      })),
    })),
  };
};

const agencyRecommendations: Resolver = async (ctx) => {
  const where: Record<string, unknown> = {
    agencyId: ctx.agencyId,
    isEnabled: true,
  };
  if (ctx.policyTypeId) where.policyTypeId = ctx.policyTypeId;

  const recs = await prisma.agencyRecommendation.findMany({
    where,
    include: {
      policyType: true,
      coverageDefinition: true,
    },
    orderBy: { title: "asc" },
  });

  return {
    recommendations: recs.map((r) => ({
      title: r.title,
      type: r.type,
      description: r.description,
      minimumLimit: r.minimumLimitText,
      policyType: r.policyType.name,
      coverageName: r.coverageDefinition?.name ?? null,
    })),
  };
};

const crossSellRules: Resolver = async (ctx) => {
  const rules = await prisma.agencyCrossSellRule.findMany({
    where: {
      agencyId: ctx.agencyId,
      isEnabled: true,
    },
    include: {
      sourcePolicyType: true,
      targetPolicyType: true,
    },
    orderBy: { priority: "asc" },
  });

  return {
    crossSellRules: rules.map((r) => ({
      source: r.sourcePolicyType?.name ?? "Any",
      target: r.targetPolicyType?.name,
      label: r.label,
      audience: r.audience,
      priority: r.priority,
    })),
  };
};

const reviewOrder: Resolver = async (ctx) => {
  const where: Record<string, unknown> = {};
  if (ctx.offeringId) {
    where.offeringId = ctx.offeringId;
  } else if (ctx.policyTypeId) {
    where.policyTypeId = ctx.policyTypeId;
    where.offeringId = null;
  }

  const items = await prisma.reviewOrderItem.findMany({
    where,
    include: { coverageDefinition: true },
    orderBy: { sortOrder: "asc" },
  });

  return {
    reviewOrder: items.map((item) => ({
      type: item.itemType,
      label: item.label,
      sortOrder: item.sortOrder,
      coverageName: item.coverageDefinition?.name,
      metadata: item.metadata,
    })),
  };
};

const stateInfo: Resolver = async (ctx) => {
  if (!ctx.stateId) return { stateInfo: null };

  const state = await prisma.state.findUnique({
    where: { id: ctx.stateId },
  });

  return {
    stateInfo: state
      ? {
          code: state.code,
          name: state.name,
        }
      : null,
  };
};

const agencySettings: Resolver = async (ctx) => {
  const settings: Record<string, unknown> = {};

  if (ctx.policyTypeId) {
    const ptSetting = await prisma.agencyPolicyTypeSetting.findUnique({
      where: {
        agencyId_policyTypeId: {
          agencyId: ctx.agencyId,
          policyTypeId: ctx.policyTypeId,
        },
      },
      include: { policyType: true },
    });
    if (ptSetting) {
      settings.policyTypeSetting = {
        policyType: ptSetting.policyType.name,
        enabled: ptSetting.enabled,
        reviewConfig: ptSetting.reviewConfig,
      };
    }
  }

  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: ctx.agencyId },
    select: { settings: true },
  });
  settings.agencyConfig = agency.settings;

  return { settings };
};

export function createResolverRegistry(): ResolverRegistry {
  const registry: ResolverRegistry = new Map();

  registry.set("agency_profile", agencyProfile);
  registry.set("insured_profile", insuredProfile);
  registry.set("insured_policies", insuredPolicies);
  registry.set("policy_coverages", policyCoverages);
  registry.set("carrier_forms", carrierForms);
  registry.set("agency_recommendations", agencyRecommendations);
  registry.set("cross_sell_rules", crossSellRules);
  registry.set("review_order", reviewOrder);
  registry.set("state_info", stateInfo);
  registry.set("agency_settings", agencySettings);

  return registry;
}
