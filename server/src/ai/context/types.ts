import type { UserType, PlanTier } from "@prisma/client";

export interface ConversationContext {
  userId: string;
  userType: UserType;
  agencyId: string;
  agent?: string | undefined;
  insuredAccountId?: string | undefined;
  policyId?: string | undefined;
  policyTypeId?: string | undefined;
  carrierId?: string | undefined;
  stateId?: string | undefined;
  offeringId?: string | undefined;
}

export interface BlockGating {
  requiredFeatureFlag: string | null;
  allowedUserTypes: string[];
  requiredPlanTier: PlanTier | null;
}

export type Resolver = (
  ctx: ConversationContext
) => Promise<Record<string, unknown>>;

export type ResolverRegistry = Map<string, Resolver>;

export interface RenderedBlock {
  key: string;
  content: string;
  sortOrder: number;
}
