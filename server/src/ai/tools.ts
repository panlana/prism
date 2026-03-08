import { prisma } from "../lib/db.js";
import { ServiceError } from "../services/errors.js";
import {
  createInsured,
  updateInsured,
  addContact,
  updateContact,
} from "../services/insureds.js";
import {
  createPolicy,
  updatePolicy,
  findPolicy,
} from "../services/policies.js";
import type { CreatePolicyInput, UpdatePolicyInput } from "../services/policies.js";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ToolContext {
  agent: string;
  screen?: string | undefined;
  featureFlags: Set<string>;
  permissions: Set<string>;
}

// ---------------------------------------------------------------------------
// Meta Tools (the only tools sent to the model)
// ---------------------------------------------------------------------------

export const metaTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_tool",
      description:
        "Look up the full parameter schema for a specific tool before executing it. Always call this before execute_tool to understand the required arguments.",
      parameters: {
        type: "object",
        properties: {
          toolKey: {
            type: "string",
            description: "The tool key from the available tools list in context.",
          },
        },
        required: ["toolKey"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_tool",
      description:
        "Execute a tool with the given payload. You must call get_tool first to understand the required parameters.",
      parameters: {
        type: "object",
        properties: {
          toolKey: {
            type: "string",
            description: "The tool key to execute.",
          },
          payload: {
            type: "object",
            description: "The arguments for the tool, matching the schema returned by get_tool.",
          },
        },
        required: ["toolKey", "payload"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_data",
      description:
        "Search for insureds, contacts, or policies by name, email, account code, or policy number. Use this to look up entity IDs before calling execute_tool. This is a read-only operation.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["insured", "contact", "policy"],
            description: "The type of entity to search for.",
          },
          query: {
            type: "string",
            description: "Search term (name, account code, email, policy number).",
          },
          insuredAccountId: {
            type: "string",
            description: "Scope contact search to a specific insured account.",
          },
        },
        required: ["entity", "query"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// DB-backed tool registry queries
// ---------------------------------------------------------------------------

function matchesContext(
  tool: { agents: string[]; screens: string[]; requiredFlags: string[]; requiredPermission: string | null },
  ctx: ToolContext,
): boolean {
  // Agent must match
  if (!tool.agents.includes(ctx.agent)) return false;

  // Screen filter: if tool has screens specified, current screen must be one of them
  if (tool.screens.length > 0 && ctx.screen) {
    if (!tool.screens.includes(ctx.screen)) return false;
  }

  // Feature flags: all required flags must be enabled
  for (const flag of tool.requiredFlags) {
    if (!ctx.featureFlags.has(flag)) return false;
  }

  // Permission: user must have the required permission
  if (tool.requiredPermission && !ctx.permissions.has(tool.requiredPermission)) {
    return false;
  }

  return true;
}

/**
 * Build the tool catalog string for the system prompt.
 * Queries DB for active tools matching the given context.
 */
export async function getToolCatalog(ctx: ToolContext): Promise<string> {
  const tools = await prisma.toolDefinition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const filtered = tools.filter((t) => matchesContext(t, ctx));

  if (filtered.length === 0) {
    return "";
  }

  const lines = filtered.map(
    (t) => `- ${t.key}: ${t.description.split(". ")[0]}`
  );

  return [
    "## Available Tools",
    "You have access to the following tools. Use get_tool to look up the full parameter schema, then execute_tool to run it.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Look up the full schema for a single tool.
 * Validates the tool exists, is active, and is accessible in the given context.
 */
export async function getToolSchema(toolKey: string, ctx: ToolContext): Promise<ToolResult> {
  const tool = await prisma.toolDefinition.findUnique({
    where: { key: toolKey },
  });

  if (!tool || !tool.isActive) {
    return { success: false, error: `Unknown tool: ${toolKey}. Check the available tools list.` };
  }

  if (!matchesContext(tool, ctx)) {
    return { success: false, error: `Tool "${toolKey}" is not available in this context.` };
  }

  return {
    success: true,
    data: {
      name: tool.key,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  };
}

// ---------------------------------------------------------------------------
// Tool Execution (called after user confirms)
// ---------------------------------------------------------------------------

type ToolExecutor = (
  agencyId: string,
  args: Record<string, unknown>
) => Promise<ToolResult>;

function str(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

const executors: Record<string, ToolExecutor> = {
  create_insured: async (agencyId, args) => {
    const contactFirstName = str(args.contactFirstName);
    const contactLastName = str(args.contactLastName);

    const result = await createInsured(agencyId, {
      accountCode: args.accountCode as string,
      displayName: args.displayName as string,
      primaryEmail: str(args.primaryEmail),
      primaryPhone: str(args.primaryPhone),
      primaryStateCode: str(args.primaryStateCode),
      ...(contactFirstName || contactLastName
        ? {
            contacts: [{
              firstName: contactFirstName,
              lastName: contactLastName,
              email: str(args.primaryEmail),
              phone: str(args.primaryPhone),
              isPrimary: true,
            }],
          }
        : {}),
    });

    return {
      success: true,
      data: { id: result.id, accountCode: result.accountCode, displayName: result.displayName },
    };
  },

  add_contact: async (agencyId, args) => {
    const contact = await addContact(agencyId, args.insuredAccountId as string, {
      firstName: args.firstName as string,
      lastName: args.lastName as string,
      email: str(args.email),
      phone: str(args.phone),
      relationship: str(args.relationship),
      isPrimary: args.isPrimary != null ? bool(args.isPrimary) : undefined,
    });

    return {
      success: true,
      data: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
    };
  },

  update_contact: async (agencyId, args) => {
    const contact = await updateContact(
      agencyId,
      args.insuredAccountId as string,
      args.contactId as string,
      {
        firstName: str(args.firstName),
        lastName: str(args.lastName),
        email: str(args.email),
        phone: str(args.phone),
        relationship: str(args.relationship),
        isPrimary: args.isPrimary != null ? bool(args.isPrimary) : undefined,
      },
    );

    return {
      success: true,
      data: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
    };
  },

  update_insured: async (agencyId, args) => {
    const result = await updateInsured(agencyId, args.insuredAccountId as string, {
      displayName: str(args.displayName),
      primaryEmail: str(args.primaryEmail),
      primaryPhone: str(args.primaryPhone),
      primaryStateCode: str(args.primaryStateCode),
    });

    return {
      success: true,
      data: { id: result.id, accountCode: result.accountCode, displayName: result.displayName },
    };
  },

  create_policy: async (agencyId, args) => {
    const policy = await createPolicy(agencyId, {
      insuredAccountId: args.insuredAccountId as string,
      policyTypeCode: args.policyTypeCode as string,
      policyNumber: str(args.policyNumber),
      carrierName: str(args.carrierName),
      status: str(args.status) as CreatePolicyInput["status"],
      effectiveDate: str(args.effectiveDate),
      expirationDate: str(args.expirationDate),
      premium: str(args.premium),
      stateCode: str(args.stateCode),
    });

    return {
      success: true,
      data: {
        id: policy.id,
        policyNumber: policy.policyNumber,
        policyType: policy.policyType.name,
        carrier: policy.carrier?.name ?? policy.extractedCarrierName,
        status: policy.status,
      },
    };
  },

  update_policy: async (agencyId, args) => {
    const policy = await findPolicy(agencyId, {
      policyId: str(args.policyId),
      insuredAccountId: str(args.insuredAccountId),
      policyTypeCode: str(args.policyTypeCode),
    });

    const updated = await updatePolicy(agencyId, policy.id, {
      policyNumber: str(args.policyNumber),
      carrierName: str(args.carrierName),
      status: str(args.status) as UpdatePolicyInput["status"],
      effectiveDate: str(args.effectiveDate),
      expirationDate: str(args.expirationDate),
      premium: str(args.premium),
      stateCode: str(args.stateCode),
    });

    return {
      success: true,
      data: {
        id: updated.id,
        policyNumber: updated.policyNumber,
        policyType: updated.policyType.name,
        status: updated.status,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Read-only search (auto-executed without user confirmation)
// ---------------------------------------------------------------------------

export async function executeSearch(
  agencyId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const entity = String(args.entity ?? "");
  const query = String(args.query ?? "").trim();

  if (!query) {
    return { success: false, error: "A search query is required." };
  }

  if (entity === "insured") {
    const words = query.split(/\s+/).filter(Boolean);
    const orConditions: Record<string, unknown>[] = [
      { displayName: { contains: query, mode: "insensitive" } },
      { accountCode: { contains: query, mode: "insensitive" } },
      { primaryEmail: { contains: query, mode: "insensitive" } },
      // Also find accounts by contact name
      { contacts: { some: { firstName: { contains: words[0] ?? query, mode: "insensitive" } } } },
    ];
    if (words.length >= 2) {
      orConditions.push({
        contacts: {
          some: {
            AND: [
              { firstName: { contains: words[0], mode: "insensitive" } },
              { lastName: { contains: words.slice(1).join(" "), mode: "insensitive" } },
            ],
          },
        },
      });
    }

    const results = await prisma.insuredAccount.findMany({
      where: {
        agencyId,
        OR: orConditions,
      },
      include: {
        contacts: { orderBy: { isPrimary: "desc" } },
        primaryState: true,
      },
      take: 5,
    });

    return {
      success: true,
      data: {
        results: results.map((r) => ({
          insuredAccountId: r.id,
          accountCode: r.accountCode,
          displayName: r.displayName,
          primaryEmail: r.primaryEmail,
          primaryPhone: r.primaryPhone,
          state: r.primaryState?.name ?? null,
          contacts: r.contacts.map((c) => ({
            contactId: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" "),
            email: c.email,
            phone: c.phone,
            relationship: c.relationship,
            isPrimary: c.isPrimary,
          })),
        })),
      },
    };
  }

  if (entity === "contact") {
    // Split query into words to handle "Gaylyn Pantana" → match firstName/lastName independently
    const words = query.split(/\s+/).filter(Boolean);
    const nameConditions: Record<string, unknown>[] = [];
    if (words.length >= 2) {
      // Try first+last name match
      nameConditions.push({
        AND: [
          { firstName: { contains: words[0], mode: "insensitive" } },
          { lastName: { contains: words.slice(1).join(" "), mode: "insensitive" } },
        ],
      });
    }
    // Also try each word against either field, plus email
    for (const word of words) {
      nameConditions.push({ firstName: { contains: word, mode: "insensitive" } });
      nameConditions.push({ lastName: { contains: word, mode: "insensitive" } });
    }
    nameConditions.push({ email: { contains: query, mode: "insensitive" } });

    const where: Record<string, unknown> = {
      insuredAccount: { agencyId },
      OR: nameConditions,
    };
    if (args.insuredAccountId) {
      where.insuredAccountId = args.insuredAccountId;
    }

    const results = await prisma.insuredContact.findMany({
      where,
      include: { insuredAccount: { select: { id: true, displayName: true, accountCode: true } } },
      take: 10,
    });

    return {
      success: true,
      data: {
        results: results.map((c) => ({
          contactId: c.id,
          insuredAccountId: c.insuredAccount.id,
          accountName: c.insuredAccount.displayName,
          name: [c.firstName, c.lastName].filter(Boolean).join(" "),
          email: c.email,
          phone: c.phone,
          relationship: c.relationship,
          isPrimary: c.isPrimary,
        })),
      },
    };
  }

  if (entity === "policy") {
    const results = await prisma.policy.findMany({
      where: {
        agencyId,
        OR: [
          { policyNumber: { contains: query, mode: "insensitive" } },
          { extractedCarrierName: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        policyType: true,
        carrier: true,
        insuredAccount: { select: { id: true, displayName: true } },
      },
      take: 5,
    });

    return {
      success: true,
      data: {
        results: results.map((p) => ({
          policyId: p.id,
          insuredAccountId: p.insuredAccount.id,
          accountName: p.insuredAccount.displayName,
          policyNumber: p.policyNumber,
          type: p.policyType.name,
          carrier: p.carrier?.name ?? p.extractedCarrierName,
          status: p.status,
        })),
      },
    };
  }

  return { success: false, error: `Unknown entity type: ${entity}. Use "insured", "contact", or "policy".` };
}

/**
 * Execute a tool by key. Validates the tool exists and is accessible,
 * then runs the code-side executor.
 */
export async function executeTool(
  toolName: string,
  agencyId: string,
  args: Record<string, unknown>,
  ctx?: ToolContext | undefined,
): Promise<ToolResult> {
  // Validate tool is accessible if context provided
  if (ctx) {
    const tool = await prisma.toolDefinition.findUnique({ where: { key: toolName } });
    if (!tool || !tool.isActive) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
    if (!matchesContext(tool, ctx)) {
      return { success: false, error: `Tool "${toolName}" is not available in this context.` };
    }
  }

  const executor = executors[toolName];
  if (!executor) {
    return { success: false, error: `No executor for tool: ${toolName}` };
  }

  try {
    return await executor(agencyId, args);
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : "Tool execution failed.";
    return { success: false, error: message };
  }
}
