export type LoginMode = "agency" | "staff" | "insured";

export type SessionResponse = {
  token: string;
  auth: {
    sub: string;
    email: string;
    userType: "AGENCY" | "STAFF" | "INSURED";
    roleKeys: string[];
    permissionKeys: string[];
    activeAgencyId?: string;
  };
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    userType: "AGENCY" | "STAFF" | "INSURED";
  };
  activeAgency?: {
    id: string;
    name: string;
    slug: string;
    roleKey?: string;
    hasInAppAi?: boolean;
    planTier?: string;
  };
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

export type MagicLinkRequestResponse = {
  sent: boolean;
  expiresAt: string;
  debugToken?: string;
};
