import Handlebars from "handlebars";

import { prisma } from "../../lib/db.js";
import { createResolverRegistry } from "./resolvers.js";
import type {
  ConversationContext,
  ResolverRegistry,
  RenderedBlock,
} from "./types.js";

const registry: ResolverRegistry = createResolverRegistry();

interface FetchedBlock {
  key: string;
  name: string;
  type: "STATIC" | "TEMPLATE" | "QUERY_TEMPLATE";
  content: string;
  resolverKey: string | null;
  sortOrder: number;
}

async function passesGating(
  block: {
    requiredFeatureFlag: string | null;
    allowedUserTypes: string[];
    requiredPlanTier: string | null;
  },
  ctx: ConversationContext
): Promise<boolean> {
  if (
    block.allowedUserTypes.length > 0 &&
    !block.allowedUserTypes.includes(ctx.userType)
  ) {
    return false;
  }

  if (block.requiredFeatureFlag) {
    const flag = await prisma.agencyFeatureFlag.findFirst({
      where: {
        agencyId: ctx.agencyId,
        featureFlag: { key: block.requiredFeatureFlag },
        enabled: true,
      },
    });
    if (!flag) return false;
  }

  if (block.requiredPlanTier) {
    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: ctx.agencyId },
      select: { planTier: true },
    });
    if (
      block.requiredPlanTier === "STANDARD_AI" &&
      agency.planTier !== "STANDARD_AI"
    ) {
      return false;
    }
  }

  return true;
}

function matchesScope(
  block: {
    scope: string;
    agencyId: string | null;
    policyTypeId: string | null;
    offeringId: string | null;
  },
  ctx: ConversationContext
): boolean {
  switch (block.scope) {
    case "GLOBAL":
      return true;
    case "AGENCY":
      return !block.agencyId || block.agencyId === ctx.agencyId;
    case "POLICY_TYPE":
      return !block.policyTypeId || block.policyTypeId === ctx.policyTypeId;
    case "CARRIER_OFFERING":
      return !block.offeringId || block.offeringId === ctx.offeringId;
    default:
      return true;
  }
}

async function renderBlock(
  block: FetchedBlock,
  ctx: ConversationContext,
  baseVars: Record<string, unknown>
): Promise<string> {
  switch (block.type) {
    case "STATIC":
      return block.content;

    case "TEMPLATE": {
      const template = Handlebars.compile(block.content, { noEscape: true });
      return template(baseVars);
    }

    case "QUERY_TEMPLATE": {
      if (!block.resolverKey) {
        return block.content;
      }
      const resolver = registry.get(block.resolverKey);
      if (!resolver) {
        console.warn(
          `Context block "${block.key}" references unknown resolver "${block.resolverKey}"`
        );
        return "";
      }
      const data = await resolver(ctx);
      const merged = { ...baseVars, ...data };
      const template = Handlebars.compile(block.content, { noEscape: true });
      return template(merged);
    }

    default:
      return block.content;
  }
}

export interface AssembledContext {
  systemPrompt: string;
  blocks: RenderedBlock[];
}

export async function assembleContext(
  ctx: ConversationContext
): Promise<AssembledContext> {
  const allBlocks = await prisma.contextBlock.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const baseVars: Record<string, unknown> = {
    userId: ctx.userId,
    userType: ctx.userType,
    agencyId: ctx.agencyId,
    insuredAccountId: ctx.insuredAccountId,
    policyId: ctx.policyId,
    policyTypeId: ctx.policyTypeId,
    carrierId: ctx.carrierId,
    stateId: ctx.stateId,
    offeringId: ctx.offeringId,
  };

  const rendered: RenderedBlock[] = [];

  for (const block of allBlocks) {
    // Agent filter: if the block has agents specified, the requested agent must be in the list
    if (block.agents.length > 0 && ctx.agent && !block.agents.includes(ctx.agent)) continue;

    if (!matchesScope(block, ctx)) continue;

    const gatingOk = await passesGating(block, ctx);
    if (!gatingOk) continue;

    try {
      const content = await renderBlock(block, ctx, baseVars);
      const trimmed = content.trim();
      if (!trimmed) continue;

      rendered.push({
        key: block.key,
        content: trimmed,
        sortOrder: block.sortOrder,
      });
    } catch (err) {
      console.warn(`[Context] Block "${block.key}" failed:`, err);
    }
  }

  const systemPrompt = rendered.map((b) => b.content).join("\n\n");

  return { systemPrompt, blocks: rendered };
}
