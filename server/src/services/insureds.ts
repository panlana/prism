import { prisma } from "../lib/db.js";
import { ServiceError } from "./errors.js";

export { ServiceError };

// ---------------------------------------------------------------------------
// Input interfaces
// ---------------------------------------------------------------------------

export interface CreateInsuredInput {
  accountCode: string;
  displayName: string;
  primaryEmail?: string | undefined;
  primaryPhone?: string | undefined;
  primaryStateCode?: string | undefined;
  streetLineOne?: string | undefined;
  streetLineTwo?: string | undefined;
  city?: string | undefined;
  postalCode?: string | undefined;
  sourceSystem?: string | undefined;
  notes?: string | undefined;
  contacts?: Array<{
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    relationship?: string | undefined;
    isPrimary?: boolean | undefined;
  }> | undefined;
}

export interface UpdateInsuredInput {
  displayName?: string | undefined;
  primaryEmail?: string | null | undefined;
  primaryPhone?: string | null | undefined;
  primaryStateCode?: string | null | undefined;
  streetLineOne?: string | null | undefined;
  streetLineTwo?: string | null | undefined;
  city?: string | null | undefined;
  postalCode?: string | null | undefined;
  sourceSystem?: string | null | undefined;
  notes?: string | null | undefined;
  accountCode?: string | undefined;
}

export interface AddContactInput {
  firstName: string;
  lastName: string;
  email?: string | undefined;
  phone?: string | undefined;
  relationship?: string | undefined;
  isPrimary?: boolean | undefined;
}

export interface UpdateContactInput {
  firstName?: string | undefined;
  lastName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  relationship?: string | undefined;
  isPrimary?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a state code (e.g. "VA") to its database id. Throws 400 if invalid. */
async function resolveStateId(stateCode: string): Promise<string> {
  const state = await prisma.state.findUnique({ where: { code: stateCode.toUpperCase() } });
  if (!state) {
    throw new ServiceError(400, `Invalid state code: ${stateCode}`);
  }
  return state.id;
}

/** Re-fetch an insured account with contacts ordered by isPrimary desc. */
async function fetchInsuredWithContacts(id: string) {
  return prisma.insuredAccount.findUniqueOrThrow({
    where: { id },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
    },
  });
}

// ---------------------------------------------------------------------------
// 1. createInsured
// ---------------------------------------------------------------------------

export async function createInsured(agencyId: string, input: CreateInsuredInput) {
  // Resolve state if provided
  let primaryStateId: string | undefined;
  if (input.primaryStateCode) {
    primaryStateId = await resolveStateId(input.primaryStateCode);
  }

  // Check for duplicate accountCode within agency
  const existing = await prisma.insuredAccount.findUnique({
    where: { agencyId_accountCode: { agencyId, accountCode: input.accountCode } },
  });
  if (existing) {
    throw new ServiceError(409, `An insured with account code "${input.accountCode}" already exists for this agency`);
  }

  // Build contacts to create
  let contactsCreate: Array<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    relationship?: string;
    isPrimary: boolean;
  }>;

  if (input.contacts && input.contacts.length > 0) {
    contactsCreate = input.contacts.map((c) => ({
      ...(c.firstName ? { firstName: c.firstName } : {}),
      ...(c.lastName ? { lastName: c.lastName } : {}),
      ...(c.email ? { email: c.email } : {}),
      ...(c.phone != null ? { phone: String(c.phone) } : {}),
      ...(c.relationship ? { relationship: c.relationship } : {}),
      isPrimary: c.isPrimary ?? false,
    }));
  } else {
    // Auto-create a primary contact from displayName
    const parts = input.displayName.trim().split(/\s+/);
    const firstName = parts[0] ?? input.displayName;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Contact";
    contactsCreate = [
      {
        firstName,
        lastName,
        ...(input.primaryEmail ? { email: input.primaryEmail } : {}),
        ...(input.primaryPhone != null ? { phone: String(input.primaryPhone) } : {}),
        isPrimary: true,
      },
    ];
  }

  // Create the insured account
  const created = await prisma.insuredAccount.create({
    data: {
      agencyId,
      accountCode: input.accountCode,
      displayName: input.displayName,
      ...(input.primaryEmail ? { primaryEmail: input.primaryEmail } : {}),
      ...(input.primaryPhone != null ? { primaryPhone: String(input.primaryPhone) } : {}),
      ...(primaryStateId ? { primaryStateId } : {}),
      ...(input.streetLineOne ? { streetLineOne: input.streetLineOne } : {}),
      ...(input.streetLineTwo ? { streetLineTwo: input.streetLineTwo } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.postalCode ? { postalCode: input.postalCode } : {}),
      ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      contacts: {
        create: contactsCreate,
      },
    },
  });

  return fetchInsuredWithContacts(created.id);
}

// ---------------------------------------------------------------------------
// 2. updateInsured
// ---------------------------------------------------------------------------

export async function updateInsured(
  agencyId: string,
  insuredAccountId: string,
  input: UpdateInsuredInput,
) {
  // Verify insured belongs to agency
  const account = await prisma.insuredAccount.findFirst({
    where: { id: insuredAccountId, agencyId },
  });
  if (!account) {
    throw new ServiceError(404, "Insured account not found");
  }

  // Resolve state if provided (null clears it)
  let primaryStateId: string | null | undefined;
  if (input.primaryStateCode !== undefined) {
    if (input.primaryStateCode === null) {
      primaryStateId = null;
    } else {
      primaryStateId = await resolveStateId(input.primaryStateCode);
    }
  }

  // Check duplicate accountCode if changed
  if (input.accountCode && input.accountCode !== account.accountCode) {
    const duplicate = await prisma.insuredAccount.findUnique({
      where: { agencyId_accountCode: { agencyId, accountCode: input.accountCode } },
    });
    if (duplicate) {
      throw new ServiceError(409, `An insured with account code "${input.accountCode}" already exists for this agency`);
    }
  }

  // Build update data — nullable fields use null to clear, undefined to skip
  const data: Record<string, unknown> = {};

  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.accountCode !== undefined) data.accountCode = input.accountCode;

  // Nullable string fields
  const nullableFields = [
    "primaryEmail",
    "primaryPhone",
    "streetLineOne",
    "streetLineTwo",
    "city",
    "postalCode",
    "sourceSystem",
    "notes",
  ] as const;

  for (const field of nullableFields) {
    if (input[field] !== undefined) {
      if (input[field] === null) {
        data[field] = null;
      } else {
        // Coerce phone to string
        data[field] = field === "primaryPhone" ? String(input[field]) : input[field];
      }
    }
  }

  // State handled separately
  if (primaryStateId !== undefined) {
    data.primaryStateId = primaryStateId;
  }

  await prisma.insuredAccount.update({
    where: { id: insuredAccountId },
    data,
  });

  return fetchInsuredWithContacts(insuredAccountId);
}

// ---------------------------------------------------------------------------
// 3. addContact
// ---------------------------------------------------------------------------

export async function addContact(
  agencyId: string,
  insuredAccountId: string,
  input: AddContactInput,
) {
  // Verify insured belongs to agency
  const account = await prisma.insuredAccount.findFirst({
    where: { id: insuredAccountId, agencyId },
  });
  if (!account) {
    throw new ServiceError(404, "Insured account not found");
  }

  // If isPrimary, clear existing primary contacts first
  if (input.isPrimary) {
    await prisma.insuredContact.updateMany({
      where: { insuredAccountId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return prisma.insuredContact.create({
    data: {
      insuredAccountId,
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone != null ? { phone: String(input.phone) } : {}),
      ...(input.relationship ? { relationship: input.relationship } : {}),
      isPrimary: input.isPrimary ?? false,
    },
  });
}

// ---------------------------------------------------------------------------
// 4. updateContact
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. deleteInsured
// ---------------------------------------------------------------------------

export async function deleteInsured(agencyId: string, insuredAccountId: string) {
  const account = await prisma.insuredAccount.findFirst({
    where: { id: insuredAccountId, agencyId },
  });
  if (!account) {
    throw new ServiceError(404, "Insured account not found");
  }

  await prisma.insuredAccount.delete({ where: { id: insuredAccountId } });
}

// ---------------------------------------------------------------------------
// 6. deleteContact
// ---------------------------------------------------------------------------

export async function deleteContact(
  agencyId: string,
  insuredAccountId: string,
  contactId: string,
) {
  const account = await prisma.insuredAccount.findFirst({
    where: { id: insuredAccountId, agencyId },
  });
  if (!account) {
    throw new ServiceError(404, "Insured account not found");
  }

  const contact = await prisma.insuredContact.findFirst({
    where: { id: contactId, insuredAccountId },
  });
  if (!contact) {
    throw new ServiceError(404, "Contact not found");
  }

  await prisma.insuredContact.delete({ where: { id: contactId } });
}

// ---------------------------------------------------------------------------
// 7. updateContact
// ---------------------------------------------------------------------------

export async function updateContact(
  agencyId: string,
  insuredAccountId: string,
  contactId: string,
  input: UpdateContactInput,
) {
  // Verify insured belongs to agency
  const account = await prisma.insuredAccount.findFirst({
    where: { id: insuredAccountId, agencyId },
  });
  if (!account) {
    throw new ServiceError(404, "Insured account not found");
  }

  // Verify contact belongs to insured
  const contact = await prisma.insuredContact.findFirst({
    where: { id: contactId, insuredAccountId },
  });
  if (!contact) {
    throw new ServiceError(404, "Contact not found");
  }

  // If setting as primary, clear other primaries first
  if (input.isPrimary) {
    await prisma.insuredContact.updateMany({
      where: { insuredAccountId, isPrimary: true, id: { not: contactId } },
      data: { isPrimary: false },
    });
  }

  return prisma.insuredContact.update({
    where: { id: contactId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: String(input.phone) } : {}),
      ...(input.relationship !== undefined ? { relationship: input.relationship } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
    },
  });
}
