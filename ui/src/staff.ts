import { deleteWithToken, getWithToken, patchWithToken, postWithToken, putWithToken } from "./api";

export type StaffDashboard = {
  stats: {
    agencyCount: number;
    userCount: number;
    policyCount: number;
    reviewCount: number;
    insuredCount: number;
  };
  recentReviews: Array<{
    id: string;
    status: string;
    createdAt: string;
    insuredDisplayName: string;
    agencyName: string;
    policyTypeName: string | null;
    summary: string | null;
  }>;
  aiUsage: null | {
    last7Days: {
      range: { start: string; end: string; days: number };
      requestCount: number;
      successCount: number;
      errorCount: number;
      errorRate: number;
      activeAgencyCount: number;
      activeUserCount: number;
      totalTokens: number;
      inputTokens: number;
      inputCachedTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      providerCost: number;
      cacheDiscount: number;
    };
    last30Days: {
      range: { start: string; end: string; days: number };
      requestCount: number;
      successCount: number;
      errorCount: number;
      errorRate: number;
      activeAgencyCount: number;
      activeUserCount: number;
      totalTokens: number;
      inputTokens: number;
      inputCachedTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      providerCost: number;
      cacheDiscount: number;
    };
    surfaces30Days: StaffAiUsageBreakdownItem[];
    topAgencies30Days: StaffAiUsageBreakdownItem[];
  };
};

export type StaffAiUsageBreakdownItem = {
  key: string;
  label: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalTokens: number;
  inputTokens: number;
  inputCachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  providerCost: number;
  cacheDiscount: number;
};

export type StaffAiUsageSeriesPoint = {
  date: string;
  requestCount: number;
  errorCount: number;
  totalTokens: number;
  inputCachedTokens: number;
  providerCost: number;
};

export type StaffAiUsageReport = {
  range: {
    start: string;
    end: string;
    days: number;
  };
  appliedFilters: {
    days: number;
    agencyId: string | null;
    provider: string | null;
    gateway: string | null;
    surface: string | null;
    status: string | null;
    model: string | null;
    userType: "STAFF" | "AGENCY" | "INSURED" | null;
  };
  summary: {
    requestCount: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    activeAgencyCount: number;
    activeUserCount: number;
    totalTokens: number;
    inputTokens: number;
    inputCachedTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    providerCost: number;
    cacheDiscount: number;
  };
  timeSeries: StaffAiUsageSeriesPoint[];
  breakdowns: {
    surfaces: StaffAiUsageBreakdownItem[];
    providers: StaffAiUsageBreakdownItem[];
    models: StaffAiUsageBreakdownItem[];
    agencies: StaffAiUsageBreakdownItem[];
  };
  recentEvents: Array<{
    id: string;
    createdAt: string;
    agencyName: string | null;
    userEmail: string | null;
    userDisplayName: string | null;
    userType: string | null;
    gateway: string;
    provider: string | null;
    model: string;
    surface: string;
    status: string;
    route: string | null;
    screen: string | null;
    latencyMs: number | null;
    inputTokens: number;
    inputCachedTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    providerCost: number;
  }>;
  filterOptions: {
    agencies: Array<{ id: string; name: string }>;
    providers: string[];
    gateways: string[];
    surfaces: string[];
    statuses: string[];
    models: string[];
    userTypes: Array<"STAFF" | "AGENCY" | "INSURED">;
  };
};

export type StaffAgencyList = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    planTier: string;
    hasInAppAi: boolean;
    counts: { insuredAccounts: number; policies: number; memberships: number };
    featureFlags: Array<{ key: string; enabled: boolean }>;
  }>;
};

export type StaffAgencyMember = {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roleId: string;
  roleName: string;
  status: string;
  isPrimary: boolean;
};

export type StaffAgencyDetail = {
  agency: {
    id: string;
    name: string;
    slug: string;
    status: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    planTier: string;
    hasInAppAi: boolean;
    timezone: string;
    createdAt: string;
    updatedAt: string;
    counts: { insuredAccounts: number; policies: number; memberships: number; reviewSessions: number };
    members: StaffAgencyMember[];
    featureFlags: Array<{
      featureFlagId: string;
      key: string;
      name: string;
      enabled: boolean;
    }>;
    carrierAppointments: Array<{
      id: string;
      carrierId: string;
      carrierName: string;
      stateId: string | null;
      stateCode: string | null;
    }>;
  };
};

export type StaffCoverageCategory = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type CoverageKind = "COVERAGE" | "ENDORSEMENT" | "EXCLUSION";

export type StaffCoverageDefinition = {
  id: string;
  code: string | null;
  kind: CoverageKind;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  aliasOne: string | null;
  aliasTwo: string | null;
  definition: string | null;
  claimExamples: string | null;
  additionalHelp: string | null;
  riskSummary: string | null;
  isCommonlyRecommended: boolean;
  isActive: boolean;
  policyTypeName: string | null;
  policyTypeId: string | null;
  formMappingCount: number;
};

export type StaffCarrier = {
  id: string;
  name: string;
  slug: string;
  naicCode: string | null;
  isActive: boolean;
  offeringCount: number;
};

export type StaffCarrierDetail = {
  id: string;
  name: string;
  slug: string;
  naicCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  offerings: Array<{
    id: string;
    stateCode: string;
    stateName: string;
    policyTypeCode: string;
    policyTypeName: string;
    isActive: boolean;
    formCount: number;
  }>;
};

export type StaffOfferingFormSection = {
  id: string;
  sectionRef: string | null;
  title: string;
  sectionType: string;
  content: string;
  children: Array<{
    id: string;
    sectionRef: string | null;
    title: string;
    sectionType: string;
    content: string;
  }>;
};

export type StaffOfferingCoverageMapping = {
  id: string;
  coverageDefinitionId: string;
  coverageDefinitionName: string;
  coverageDefinitionCode: string | null;
  coverageKind: CoverageKind;
  categoryName: string | null;
  definition: string | null;
  riskSummary: string | null;
  claimExamples: string | null;
  isManualOverride: boolean;
  isRemoved: boolean;
  knownMaxLimit: string | null;
};

export type StaffOfferingDetail = {
  id: string;
  carrierId: string;
  carrierName: string;
  stateCode: string;
  stateName: string;
  policyTypeCode: string;
  policyTypeName: string;
  isActive: boolean;
  forms: Array<{
    id: string;
    title: string;
    formNumber: string | null;
    version: string | null;
    kind: string;
    isBasePolicy: boolean;
    coverageMappings: StaffOfferingCoverageMapping[];
    sections: StaffOfferingFormSection[];
  }>;
};

export type StaffPolicyType = {
  id: string;
  code: string;
  name: string;
  lineOfBusiness: string | null;
  isActive: boolean;
  coverageDefinitionCount: number;
  offeringCount: number;
};

export type StaffContextBlock = {
  id: string;
  key: string;
  name: string;
  type: string;
  scope: string;
  content: string;
  resolverKey: string | null;
  agents: string[];
  sortOrder: number;
  isActive: boolean;
  requiredFeatureFlag: string | null;
  allowedUserTypes: string[];
  requiredPlanTier: string | null;
  agencyName: string | null;
  policyTypeName: string | null;
};

export type StaffFeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  defaultEnabled: boolean;
  enabledCount: number;
};

export type StaffState = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export async function loadStaffDashboard(token: string) {
  return getWithToken<StaffDashboard>("/api/staff/dashboard", token);
}

export async function loadStaffAiUsage(
  token: string,
  filters?: {
    days?: number;
    agencyId?: string;
    provider?: string;
    gateway?: string;
    surface?: string;
    status?: string;
    model?: string;
    userType?: "STAFF" | "AGENCY" | "INSURED";
  }
) {
  const params = new URLSearchParams();

  if (filters?.days) params.set("days", String(filters.days));
  if (filters?.agencyId) params.set("agencyId", filters.agencyId);
  if (filters?.provider) params.set("provider", filters.provider);
  if (filters?.gateway) params.set("gateway", filters.gateway);
  if (filters?.surface) params.set("surface", filters.surface);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.model) params.set("model", filters.model);
  if (filters?.userType) params.set("userType", filters.userType);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getWithToken<StaffAiUsageReport>(`/api/staff/ai-usage${suffix}`, token);
}

export async function loadStaffAgencies(token: string, query?: string) {
  const path = query
    ? `/api/staff/agencies?query=${encodeURIComponent(query)}`
    : "/api/staff/agencies";
  return getWithToken<StaffAgencyList>(path, token);
}

export async function createStaffAgency(token: string, body: unknown) {
  return postWithToken("/api/staff/agencies", token, body);
}

export async function loadStaffAgencyDetail(token: string, agencyId: string) {
  return getWithToken<StaffAgencyDetail>(`/api/staff/agencies/${agencyId}`, token);
}

export async function updateStaffAgency(token: string, agencyId: string, body: unknown) {
  return patchWithToken(`/api/staff/agencies/${agencyId}`, token, body);
}

export async function updateStaffAgencyFeatures(
  token: string,
  agencyId: string,
  flags: Array<{ featureFlagId: string; enabled: boolean }>
) {
  return putWithToken(`/api/staff/agencies/${agencyId}/features`, token, { flags });
}

export async function addStaffAgencyAppointment(
  token: string,
  agencyId: string,
  body: { carrierId: string; stateId?: string | undefined }
) {
  return postWithToken<StaffAgencyDetail["agency"]["carrierAppointments"][number]>(
    `/api/staff/agencies/${agencyId}/appointments`,
    token,
    body
  );
}

export async function loadStaffAgencyInsureds(token: string, agencyId: string) {
  return getWithToken<{ items: Array<{ id: string; displayName: string; accountCode: string }> }>(
    `/api/staff/agencies/${agencyId}/insureds`,
    token
  );
}

export async function loadStaffAgencyPolicies(token: string, agencyId: string, insuredAccountId: string) {
  return getWithToken<{ items: Array<{ id: string; label: string }> }>(
    `/api/staff/agencies/${agencyId}/insureds/${insuredAccountId}/policies`,
    token
  );
}

export async function deleteStaffAgencyAppointment(token: string, agencyId: string, appointmentId: string) {
  return deleteWithToken(`/api/staff/agencies/${agencyId}/appointments/${appointmentId}`, token);
}

export async function updateStaffAgencyMember(
  token: string,
  agencyId: string,
  membershipId: string,
  body: { roleId?: string | undefined; status?: string | undefined }
) {
  return patchWithToken<StaffAgencyMember>(`/api/staff/agencies/${agencyId}/members/${membershipId}`, token, body);
}

export async function loadStaffCoverageCategories(token: string) {
  return getWithToken<{ items: StaffCoverageCategory[] }>("/api/staff/coverage-categories", token);
}

export async function loadStaffCoverageDefinitions(token: string, policyTypeId?: string) {
  const path = policyTypeId
    ? `/api/staff/coverage-definitions?policyTypeId=${encodeURIComponent(policyTypeId)}`
    : "/api/staff/coverage-definitions";
  return getWithToken<{ items: StaffCoverageDefinition[] }>(path, token);
}

export async function createStaffCoverageDefinition(token: string, body: unknown) {
  return postWithToken("/api/staff/coverage-definitions", token, body);
}

export async function updateStaffCoverageDefinition(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/coverage-definitions/${id}`, token, body);
}

export async function deleteStaffCoverageDefinition(token: string, id: string) {
  return deleteWithToken(`/api/staff/coverage-definitions/${id}`, token);
}

export async function loadStaffCarriers(token: string) {
  return getWithToken<{ items: StaffCarrier[] }>("/api/staff/carriers", token);
}

export async function createStaffCarrier(token: string, body: unknown) {
  return postWithToken("/api/staff/carriers", token, body);
}

export async function loadStaffCarrierDetail(token: string, carrierId: string) {
  return getWithToken<StaffCarrierDetail>(`/api/staff/carriers/${carrierId}`, token);
}

export async function loadStaffOfferingDetail(token: string, offeringId: string) {
  return getWithToken<StaffOfferingDetail>(`/api/staff/offerings/${offeringId}`, token);
}

export async function updateStaffFormSection(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/form-sections/${id}`, token, body);
}

export async function createStaffCoverageMapping(token: string, body: unknown) {
  return postWithToken("/api/staff/coverage-mappings", token, body);
}

export async function updateStaffCoverageMapping(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/coverage-mappings/${id}`, token, body);
}

export async function deleteStaffCoverageMapping(token: string, id: string) {
  return deleteWithToken(`/api/staff/coverage-mappings/${id}`, token);
}

export async function loadStaffPolicyTypes(token: string) {
  return getWithToken<{ items: StaffPolicyType[] }>("/api/staff/policy-types", token);
}

export async function createStaffPolicyType(token: string, body: unknown) {
  return postWithToken("/api/staff/policy-types", token, body);
}

export async function updateStaffPolicyType(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/policy-types/${id}`, token, body);
}

export async function loadStaffContextBlocks(token: string) {
  return getWithToken<{ items: StaffContextBlock[] }>("/api/staff/context-blocks", token);
}

export type StaffContextPreview = {
  agent: string;
  agencyId: string;
  blockCount: number;
  blocks: Array<{ key: string; sortOrder: number; contentLength: number; content: string }>;
  systemPrompt: string;
};

export async function loadStaffContextPreview(
  token: string,
  params: { agent: string; agencyId?: string; insuredAccountId?: string; policyId?: string },
) {
  const qs = new URLSearchParams({ agent: params.agent });
  if (params.agencyId) qs.set("agencyId", params.agencyId);
  if (params.insuredAccountId) qs.set("insuredAccountId", params.insuredAccountId);
  if (params.policyId) qs.set("policyId", params.policyId);
  return getWithToken<StaffContextPreview>(`/api/staff/context-preview?${qs}`, token);
}

export type StaffContextChatResponse = {
  message: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export async function sendStaffContextChat(
  token: string,
  body: {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    agent: string;
    agencyId?: string | undefined;
    insuredAccountId?: string | undefined;
    policyId?: string | undefined;
  },
) {
  return postWithToken<StaffContextChatResponse>("/api/staff/context-preview/chat", token, body);
}

export async function createStaffContextBlock(token: string, body: unknown) {
  return postWithToken("/api/staff/context-blocks", token, body);
}

export async function updateStaffContextBlock(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/context-blocks/${id}`, token, body);
}

export async function deleteStaffContextBlock(token: string, id: string) {
  return deleteWithToken(`/api/staff/context-blocks/${id}`, token);
}

export async function loadStaffFeatureFlags(token: string) {
  return getWithToken<{ items: StaffFeatureFlag[] }>("/api/staff/feature-flags", token);
}

export async function loadStaffStates(token: string) {
  return getWithToken<{ items: StaffState[] }>("/api/staff/states", token);
}

export type StaffToolDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  agents: string[];
  screens: string[];
  requiredFlags: string[];
  requiredPermission: string | null;
  isActive: boolean;
  sortOrder: number;
};

export async function loadStaffTools(token: string) {
  return getWithToken<{ items: StaffToolDefinition[] }>("/api/staff/tools", token);
}

export async function updateStaffTool(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/tools/${id}`, token, body);
}

export type StaffPermission = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: string;
  roleCount: number;
};

export async function loadStaffPermissions(token: string) {
  return getWithToken<{ items: StaffPermission[] }>("/api/staff/permissions", token);
}

export async function createStaffPermission(token: string, body: unknown) {
  return postWithToken("/api/staff/permissions", token, body);
}

export async function updateStaffPermission(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/permissions/${id}`, token, body);
}

export type StaffRole = {
  id: string;
  key: string;
  name: string;
  scope: string;
  isSystem: boolean;
  permissions: Array<{ id: string; key: string; name: string }>;
  assignmentCount: number;
};

export async function loadStaffRoles(token: string) {
  return getWithToken<{ items: StaffRole[] }>("/api/staff/roles", token);
}

export async function createStaffRole(token: string, body: unknown) {
  return postWithToken("/api/staff/roles", token, body);
}

export async function updateStaffRole(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/roles/${id}`, token, body);
}

export type StaffUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  roles: Array<{ id: string; key: string; name: string }>;
};

export async function loadStaffUsers(token: string) {
  return getWithToken<{ items: StaffUser[] }>("/api/staff/staff-users", token);
}

export async function createStaffUser(token: string, body: unknown) {
  return postWithToken("/api/staff/staff-users", token, body);
}

export async function updateStaffUser(token: string, id: string, body: unknown) {
  return patchWithToken(`/api/staff/staff-users/${id}`, token, body);
}
