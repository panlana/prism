import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { ServiceError } from "./errors.js";

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const VALID_STATUSES = ["DRAFT", "ACTIVE", "CANCELLED", "EXPIRED"] as const;
type PolicyStatus = (typeof VALID_STATUSES)[number];

function resolveStatus(raw: string | undefined, fallback: PolicyStatus): PolicyStatus {
  return raw && VALID_STATUSES.includes(raw as PolicyStatus)
    ? (raw as PolicyStatus)
    : fallback;
}

/* ------------------------------------------------------------------ */
/*  Shared include for policy queries                                  */
/* ------------------------------------------------------------------ */

const policyInclude = {
  insuredAccount: true,
  policyType: true,
  carrier: true,
} as const;

/* ------------------------------------------------------------------ */
/*  Input interfaces                                                   */
/* ------------------------------------------------------------------ */

export interface CreatePolicyInput {
  insuredAccountId: string;
  policyTypeCode: string;
  policyNumber?: string | undefined;
  carrierId?: string | undefined;
  carrierName?: string | undefined;
  status?: "DRAFT" | "ACTIVE" | "CANCELLED" | "EXPIRED" | undefined;
  effectiveDate?: string | undefined;
  expirationDate?: string | undefined;
  premium?: string | undefined;
  stateCode?: string | undefined;
  readinessSource?: "NONE" | "DECLARATION_PAGE" | "AMS" | "MANUAL" | undefined;
  extractedCarrierName?: string | undefined;
  producerName?: string | undefined;
  locationName?: string | undefined;
}

export interface UpdatePolicyInput {
  insuredAccountId?: string | undefined;
  policyTypeCode?: string | undefined;
  policyNumber?: string | undefined;
  carrierId?: string | null | undefined;
  carrierName?: string | undefined;
  status?: "DRAFT" | "ACTIVE" | "CANCELLED" | "EXPIRED" | undefined;
  effectiveDate?: string | null | undefined;
  expirationDate?: string | null | undefined;
  premium?: string | null | undefined;
  stateCode?: string | null | undefined;
  readinessSource?: "NONE" | "DECLARATION_PAGE" | "AMS" | "MANUAL" | undefined;
  extractedCarrierName?: string | null | undefined;
  producerName?: string | null | undefined;
  locationName?: string | null | undefined;
}

export interface FindPolicyCriteria {
  policyId?: string | undefined;
  insuredAccountId?: string | undefined;
  policyTypeCode?: string | undefined;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

async function resolveCarrier(carrierName: string) {
  return prisma.carrier.findFirst({
    where: { name: { contains: carrierName, mode: "insensitive" } },
  });
}

async function resolveState(stateCode: string) {
  const state = await prisma.state.findUnique({ where: { code: stateCode } });
  if (!state) throw new ServiceError(400, `Invalid state code: ${stateCode}`);
  return state;
}

async function resolvePolicyType(code: string) {
  const pt = await prisma.policyType.findUnique({ where: { code } });
  if (!pt) throw new ServiceError(400, `Invalid policy type code: ${code}`);
  return pt;
}

/* ------------------------------------------------------------------ */
/*  createPolicy                                                       */
/* ------------------------------------------------------------------ */

export async function createPolicy(agencyId: string, input: CreatePolicyInput) {
  // Verify insured belongs to agency
  const insured = await prisma.insuredAccount.findFirst({
    where: { id: input.insuredAccountId, agencyId },
  });
  if (!insured) {
    throw new ServiceError(404, "Insured account not found for this agency");
  }

  // Resolve policy type
  const policyType = await resolvePolicyType(input.policyTypeCode);

  // Resolve state if provided
  let stateId: string | undefined;
  if (input.stateCode) {
    const state = await resolveState(input.stateCode);
    stateId = state.id;
  }

  // Resolve carrier — use explicit carrierId if provided, otherwise fuzzy-match by name
  let carrierId: string | undefined;
  let extractedCarrierName: string | undefined;
  if (input.carrierId) {
    carrierId = input.carrierId;
  } else if (input.carrierName) {
    const carrier = await resolveCarrier(input.carrierName);
    if (carrier) {
      carrierId = carrier.id;
    } else {
      extractedCarrierName = input.carrierName;
    }
  }
  if (input.extractedCarrierName) {
    extractedCarrierName = input.extractedCarrierName;
  }

  // Check duplicate policy number within agency
  if (input.policyNumber) {
    const existing = await prisma.policy.findUnique({
      where: {
        agencyId_policyNumber: { agencyId, policyNumber: input.policyNumber },
      },
    });
    if (existing) {
      throw new ServiceError(409, `Policy number "${input.policyNumber}" already exists for this agency`);
    }
  }

  const status = resolveStatus(input.status, "DRAFT");
  const readinessSource = input.readinessSource ?? "NONE";

  const policy = await prisma.policy.create({
    data: {
      agencyId,
      insuredAccountId: input.insuredAccountId,
      policyTypeId: policyType.id,
      status,
      readinessSource,
      ...(readinessSource !== "NONE" ? { readinessConfirmedAt: new Date() } : {}),
      ...(input.policyNumber ? { policyNumber: input.policyNumber } : {}),
      ...(carrierId ? { carrierId } : {}),
      ...(extractedCarrierName ? { extractedCarrierName } : {}),
      ...(stateId ? { stateId } : {}),
      ...(input.effectiveDate ? { effectiveDate: new Date(input.effectiveDate) } : {}),
      ...(input.expirationDate ? { expirationDate: new Date(input.expirationDate) } : {}),
      ...(input.premium ? { premium: new Prisma.Decimal(input.premium) } : {}),
      ...(input.producerName ? { producerName: input.producerName } : {}),
      ...(input.locationName ? { locationName: input.locationName } : {}),
    },
    include: policyInclude,
  });

  return policy;
}

/* ------------------------------------------------------------------ */
/*  updatePolicy                                                       */
/* ------------------------------------------------------------------ */

export async function updatePolicy(
  agencyId: string,
  policyId: string,
  input: UpdatePolicyInput
) {
  // Verify policy belongs to agency
  const existing = await prisma.policy.findFirst({
    where: { id: policyId, agencyId },
  });
  if (!existing) {
    throw new ServiceError(404, "Policy not found for this agency");
  }

  // Resolve carrier — use explicit carrierId if provided, otherwise fuzzy-match by name
  let carrierId: string | undefined | null;
  let extractedCarrierName: string | undefined | null;
  if (input.carrierId !== undefined) {
    carrierId = input.carrierId;
    if (input.carrierId) {
      extractedCarrierName = null; // clear extracted name since we have a direct match
    }
  } else if (input.carrierName !== undefined) {
    const carrier = await resolveCarrier(input.carrierName);
    if (carrier) {
      carrierId = carrier.id;
      extractedCarrierName = null; // clear extracted name since we matched
    } else {
      carrierId = null; // clear carrier link
      extractedCarrierName = input.carrierName;
    }
  }

  // Resolve state if provided
  let stateId: string | undefined | null;
  if (input.stateCode !== undefined) {
    if (input.stateCode === null) {
      stateId = null;
    } else {
      const state = await resolveState(input.stateCode);
      stateId = state.id;
    }
  }

  // Check duplicate policy number if changed
  if (
    input.policyNumber !== undefined &&
    input.policyNumber !== existing.policyNumber
  ) {
    if (input.policyNumber) {
      const dup = await prisma.policy.findUnique({
        where: {
          agencyId_policyNumber: { agencyId, policyNumber: input.policyNumber },
        },
      });
      if (dup && dup.id !== policyId) {
        throw new ServiceError(
          409,
          `Policy number "${input.policyNumber}" already exists for this agency`
        );
      }
    }
  }

  // Resolve policy type if changed
  let policyTypeId: string | undefined;
  if (input.policyTypeCode) {
    const policyType = await resolvePolicyType(input.policyTypeCode);
    policyTypeId = policyType.id;
  }

  // Build update data using conditional spreads (exactOptionalPropertyTypes)
  const data: Prisma.PolicyUpdateInput = {
    ...(input.insuredAccountId ? { insuredAccount: { connect: { id: input.insuredAccountId } } } : {}),
    ...(policyTypeId ? { policyType: { connect: { id: policyTypeId } } } : {}),
    ...(input.status ? { status: resolveStatus(input.status, existing.status as PolicyStatus) } : {}),
    ...(input.readinessSource ? {
      readinessSource: input.readinessSource,
      readinessConfirmedAt: input.readinessSource === "NONE" ? null : new Date(),
    } : {}),
    ...(input.policyNumber !== undefined
      ? { policyNumber: input.policyNumber ?? null }
      : {}),
    ...(carrierId !== undefined
      ? carrierId === null
        ? { carrier: { disconnect: true } }
        : { carrier: { connect: { id: carrierId } } }
      : {}),
    ...(extractedCarrierName !== undefined
      ? { extractedCarrierName: extractedCarrierName }
      : {}),
    ...("extractedCarrierName" in input && carrierId === undefined
      ? { extractedCarrierName: input.extractedCarrierName ?? null }
      : {}),
    ...(stateId !== undefined
      ? stateId === null
        ? { state: { disconnect: true } }
        : { state: { connect: { id: stateId } } }
      : {}),
    ...(input.effectiveDate !== undefined
      ? { effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null }
      : {}),
    ...(input.expirationDate !== undefined
      ? { expirationDate: input.expirationDate ? new Date(input.expirationDate) : null }
      : {}),
    ...(input.premium !== undefined
      ? { premium: input.premium ? new Prisma.Decimal(input.premium) : null }
      : {}),
    ...(input.producerName !== undefined
      ? { producerName: input.producerName ?? null }
      : {}),
    ...(input.locationName !== undefined
      ? { locationName: input.locationName ?? null }
      : {}),
  };

  const policy = await prisma.policy.update({
    where: { id: policyId },
    data,
    include: policyInclude,
  });

  return policy;
}

/* ------------------------------------------------------------------ */
/*  deletePolicy                                                       */
/* ------------------------------------------------------------------ */

export async function deletePolicy(agencyId: string, policyId: string) {
  const existing = await prisma.policy.findFirst({
    where: { id: policyId, agencyId },
  });
  if (!existing) {
    throw new ServiceError(404, "Policy not found for this agency");
  }

  await prisma.policy.delete({ where: { id: policyId } });
}

/* ------------------------------------------------------------------ */
/*  findPolicy                                                         */
/* ------------------------------------------------------------------ */

export async function findPolicy(agencyId: string, criteria: FindPolicyCriteria) {
  // By explicit policy ID
  if (criteria.policyId) {
    const policy = await prisma.policy.findFirst({
      where: { id: criteria.policyId, agencyId },
      include: { policyType: true },
    });
    if (!policy) {
      throw new ServiceError(404, "Policy not found for this agency");
    }
    return policy;
  }

  // By insured + policy type (most recent)
  if (criteria.insuredAccountId && criteria.policyTypeCode) {
    const policyType = await resolvePolicyType(criteria.policyTypeCode);
    const policy = await prisma.policy.findFirst({
      where: {
        agencyId,
        insuredAccountId: criteria.insuredAccountId,
        policyTypeId: policyType.id,
      },
      orderBy: { createdAt: "desc" },
      include: { policyType: true },
    });
    if (!policy) {
      throw new ServiceError(404, "Policy not found for the given insured and policy type");
    }
    return policy;
  }

  // By insured only — return single or error on ambiguity
  if (criteria.insuredAccountId) {
    const policies = await prisma.policy.findMany({
      where: { agencyId, insuredAccountId: criteria.insuredAccountId },
      include: { policyType: true },
    });
    if (policies.length === 0) {
      throw new ServiceError(404, "Policy not found for this insured account");
    }
    if (policies.length > 1) {
      throw new ServiceError(
        400,
        "Multiple policies found for this insured account; provide a policyTypeCode or policyId to disambiguate"
      );
    }
    return policies[0]!;
  }

  throw new ServiceError(404, "Policy not found — no search criteria provided");
}
