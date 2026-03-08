import { prisma } from "./seed-utils.js";

interface ToolSeed {
  key: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  agents: string[];
  screens?: string[];
  requiredFlags?: string[];
  requiredPermission?: string;
  sortOrder: number;
}

const tools: ToolSeed[] = [
  {
    key: "create_insured",
    name: "Create Insured Account",
    description:
      "Create a new insured account for the agency. Use this when the user asks to add a new insured, customer, or client.",
    parameters: {
      type: "object",
      properties: {
        accountCode: {
          type: "string",
          description:
            "A short unique code for the account (e.g. SMITH-001). Generate one if not provided.",
        },
        displayName: {
          type: "string",
          description: "Full display name for the insured account (e.g. 'John Smith Household').",
        },
        primaryEmail: { type: "string", description: "Primary email address." },
        primaryPhone: { type: "string", description: "Primary phone number." },
        primaryStateCode: {
          type: "string",
          description: "Two-letter US state code (e.g. VA, CA, TX).",
        },
        contactFirstName: { type: "string", description: "First name of the primary contact." },
        contactLastName: { type: "string", description: "Last name of the primary contact." },
      },
      required: ["accountCode", "displayName"],
    },
    agents: ["agency_assistant"],
    requiredPermission: "insureds.manage",
    sortOrder: 10,
  },
  {
    key: "update_insured",
    name: "Update Insured Account",
    description:
      "Update an existing insured account's details. Use this when the user asks to change email, phone, name, address, or other account fields.",
    parameters: {
      type: "object",
      properties: {
        insuredAccountId: {
          type: "string",
          description:
            "The ID of the insured account to update. Use the current account from context if available.",
        },
        displayName: { type: "string", description: "Updated display name." },
        primaryEmail: { type: "string", description: "Updated primary email address." },
        primaryPhone: { type: "string", description: "Updated primary phone number." },
        primaryStateCode: { type: "string", description: "Two-letter US state code." },
      },
      required: ["insuredAccountId"],
    },
    agents: ["agency_assistant"],
    requiredPermission: "insureds.manage",
    sortOrder: 20,
  },
  {
    key: "add_contact",
    name: "Add Contact",
    description:
      "Add a new contact to an existing insured account. Use this when the user asks to add a contact, spouse, additional insured, or named person to an account.",
    parameters: {
      type: "object",
      properties: {
        insuredAccountId: {
          type: "string",
          description:
            "The ID of the insured account to add the contact to. Use the current account from context if available.",
        },
        firstName: { type: "string", description: "First name of the contact." },
        lastName: { type: "string", description: "Last name of the contact." },
        email: { type: "string", description: "Email address of the contact." },
        phone: { type: "string", description: "Phone number of the contact." },
        relationship: {
          type: "string",
          description:
            "Relationship to the primary insured (e.g. Spouse, Child, Business Partner).",
        },
        isPrimary: {
          type: "boolean",
          description: "Whether this contact should be the primary contact. Defaults to false.",
        },
      },
      required: ["insuredAccountId", "firstName", "lastName"],
    },
    agents: ["agency_assistant"],
    requiredPermission: "insureds.manage",
    sortOrder: 30,
  },
  {
    key: "update_contact",
    name: "Update Contact",
    description:
      "Update an existing contact on an insured account. Use this when the user asks to change a contact's name, email, phone, or other details.",
    parameters: {
      type: "object",
      properties: {
        insuredAccountId: {
          type: "string",
          description:
            "The ID of the insured account. Use the current account from context if available.",
        },
        contactId: { type: "string", description: "The ID of the contact to update." },
        firstName: { type: "string", description: "Updated first name." },
        lastName: { type: "string", description: "Updated last name." },
        email: { type: "string", description: "Updated email address." },
        phone: { type: "string", description: "Updated phone number." },
        relationship: { type: "string", description: "Updated relationship." },
        isPrimary: {
          type: "boolean",
          description: "Whether this contact should be the primary contact.",
        },
      },
      required: ["insuredAccountId", "contactId"],
    },
    agents: ["agency_assistant"],
    requiredPermission: "insureds.manage",
    sortOrder: 40,
  },
  {
    key: "create_policy",
    name: "Create Policy",
    description:
      "Create a new policy for an insured account. Use this when the user asks to add a policy, start a new policy, or set up coverage.",
    parameters: {
      type: "object",
      properties: {
        insuredAccountId: {
          type: "string",
          description:
            "The ID of the insured account. Use the current account from context if available.",
        },
        policyTypeCode: {
          type: "string",
          description: "Policy type code: HOMEOWNERS or PERSONAL_AUTO.",
        },
        policyNumber: { type: "string", description: "Policy number if known." },
        carrierName: { type: "string", description: "Name of the insurance carrier." },
        status: {
          type: "string",
          enum: ["DRAFT", "ACTIVE", "CANCELLED", "EXPIRED"],
          description: "Policy status. Defaults to DRAFT.",
        },
        effectiveDate: { type: "string", description: "Policy effective date (YYYY-MM-DD)." },
        expirationDate: { type: "string", description: "Policy expiration date (YYYY-MM-DD)." },
        premium: { type: "string", description: "Annual premium amount." },
        stateCode: { type: "string", description: "Two-letter US state code." },
      },
      required: ["insuredAccountId", "policyTypeCode"],
    },
    agents: ["agency_assistant"],
    requiredPermission: "policies.manage",
    sortOrder: 50,
  },
  {
    key: "update_policy",
    name: "Update Policy",
    description:
      "Update an existing policy's details such as policy number, premium, dates, status, or carrier. Identify the policy by policyId from context, or by insuredAccountId + policyTypeCode.",
    parameters: {
      type: "object",
      properties: {
        policyId: {
          type: "string",
          description:
            "The ID of the policy to update. Get this from the policies listed in context.",
        },
        insuredAccountId: {
          type: "string",
          description:
            "Insured account ID — used to find the policy if policyId is not available.",
        },
        policyTypeCode: {
          type: "string",
          description:
            "Policy type code (HOMEOWNERS or PERSONAL_AUTO) — used with insuredAccountId to find the policy.",
        },
        policyNumber: { type: "string", description: "Updated policy number." },
        carrierName: { type: "string", description: "Updated carrier name." },
        status: {
          type: "string",
          enum: ["DRAFT", "ACTIVE", "CANCELLED", "EXPIRED"],
          description: "Updated policy status.",
        },
        effectiveDate: { type: "string", description: "Updated effective date (YYYY-MM-DD)." },
        expirationDate: {
          type: "string",
          description: "Updated expiration date (YYYY-MM-DD).",
        },
        premium: { type: "string", description: "Updated annual premium amount." },
        stateCode: { type: "string", description: "Two-letter US state code." },
      },
      required: [],
    },
    agents: ["agency_assistant"],
    requiredPermission: "policies.manage",
    sortOrder: 60,
  },
];

async function main() {
  console.log("Seeding tool definitions...");

  for (const tool of tools) {
    await prisma.toolDefinition.upsert({
      where: { key: tool.key },
      update: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        agents: tool.agents,
        screens: tool.screens ?? [],
        requiredFlags: tool.requiredFlags ?? [],
        requiredPermission: tool.requiredPermission ?? null,
        sortOrder: tool.sortOrder,
      },
      create: {
        key: tool.key,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        agents: tool.agents,
        screens: tool.screens ?? [],
        requiredFlags: tool.requiredFlags ?? [],
        requiredPermission: tool.requiredPermission ?? null,
        sortOrder: tool.sortOrder,
      },
    });
    console.log(`  ✓ ${tool.key}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
