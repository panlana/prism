import { deleteWithToken, getWithToken, patchWithToken, postWithToken } from "./api";

export type AgencyDashboard = {
  summary: {
    insuredCount: number;
    activePolicyCount: number;
    openTaskCount: number;
    pendingReviewCount: number;
  };
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    insuredDisplayName: string;
    policyTypeName: string | null;
    assignedTo: string | null;
  }>;
  recentReviews: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    insuredDisplayName: string;
    policyTypeName: string | null;
    summary: string | null;
  }>;
};

export type AgencyInsureds = {
  items: Array<{
    id: string;
    accountCode: string;
    displayName: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    policies: Array<{
      id: string;
      policyNumber: string | null;
      policyTypeName: string;
      carrierName: string | null;
      status: string;
      premium: string | null;
    }>;
  }>;
};

export type AgencyPolicies = {
  items: Array<{
    id: string;
    insuredDisplayName: string;
    policyNumber: string | null;
    policyTypeName: string;
    carrierName: string | null;
    status: string;
    readinessSource: string;
  }>;
};

export type AgencyInsuredDetail = {
  insured: {
    id: string;
    accountCode: string;
    displayName: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    primaryState: {
      code: string;
      name: string;
    } | null;
    address: {
      streetLineOne: string | null;
      streetLineTwo: string | null;
      city: string | null;
      postalCode: string | null;
    };
    contacts: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      isPrimary: boolean;
      relationship: string | null;
    }>;
    policies: Array<{
      id: string;
      policyNumber: string | null;
      status: string;
      premium: string | null;
      effectiveDate: string | null;
      expirationDate: string | null;
      readinessSource: string;
      isReviewReady: boolean;
      carrierName: string | null;
      policyTypeName: string;
      recentReviews: Array<{
        id: string;
        status: string;
        summary: string | null;
        createdAt: string;
      }>;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      type: string;
      dueAt: string | null;
    }>;
    notes: Array<{
      id: string;
      title: string;
      body: string;
      createdAt: string;
    }>;
    reviewSessions: Array<{
      id: string;
      status: string;
      summary: string | null;
      createdAt: string;
    }>;
  };
};

export type AgencyPolicyDetail = {
  policy: {
    id: string;
    insuredAccountId: string;
    insuredDisplayName: string;
    policyNumber: string | null;
    status: string;
    premium: string | null;
    deductible: string | null;
    effectiveDate: string | null;
    expirationDate: string | null;
    policyFormCode: string | null;
    readinessSource: string;
    readinessConfirmedAt: string | null;
    carrierName: string | null;
    stateCode: string | null;
    policyTypeName: string;
    producerName: string | null;
    locationName: string | null;
    mortgagee: string | null;
    propertyStreet: string | null;
    propertyCity: string | null;
    propertyStateCode: string | null;
    propertyPostalCode: string | null;
    propertyCounty: string | null;
    decForms: string[] | null;
    declarationPages: Array<{
      id: string;
      isActive: boolean;
      extractionStatus: string;
      confidence: string | null;
      uploadedAt: string;
      documentPath: string;
    }>;
    forms: Array<{
      id: string;
      title: string;
      formNumber: string | null;
      source: string;
      limitText: string | null;
    }>;
    coverages: Array<{
      id: string;
      section: string;
      label: string;
      coverageCode: string | null;
      limitAmount: string | null;
      limitText: string | null;
      premiumAmount: string | null;
      premiumText: string | null;
      deductible: string | null;
      source: string;
    }>;
    recommendations: Array<{
      id: string;
      title: string;
      type: string;
      description: string | null;
      minimumLimitText: string | null;
      coverageName: string | null;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      type: string;
      dueAt: string | null;
    }>;
    notes: Array<{
      id: string;
      title: string;
      body: string;
      createdAt: string;
    }>;
    reviewSessions: Array<{
      id: string;
      status: string;
      summary: string | null;
      createdAt: string;
    }>;
  };
};

export type AgencySettings = {
  agency: {
    name: string;
    slug: string;
    planTier: string;
    hasInAppAi: boolean;
  };
  featureFlags: Array<{
    key: string;
    name: string;
    enabled: boolean;
  }>;
  emailTemplates: Array<{
    id: string;
    name: string;
    templateType: string;
    subject: string | null;
    isActive: boolean;
  }>;
};

export type AgencyReferenceData = {
  states: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  carriers: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  policyTypes: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

export async function loadAgencyDashboard(token: string) {
  return getWithToken<AgencyDashboard>("/api/agency/dashboard", token);
}

export async function loadAgencyInsureds(token: string) {
  return getWithToken<AgencyInsureds>("/api/agency/insureds", token);
}

export async function loadAgencyPolicies(token: string) {
  return getWithToken<AgencyPolicies>("/api/agency/policies", token);
}

export async function loadAgencyInsuredDetail(token: string, insuredAccountId: string) {
  return getWithToken<AgencyInsuredDetail>(`/api/agency/insureds/${insuredAccountId}`, token);
}

export async function loadAgencyPolicyDetail(token: string, policyId: string) {
  return getWithToken<AgencyPolicyDetail>(`/api/agency/policies/${policyId}`, token);
}

export async function loadAgencySettings(token: string) {
  return getWithToken<AgencySettings>("/api/agency/settings", token);
}

export async function loadAgencyRecommendations(token: string) {
  return getWithToken<{
    items: Array<{
      id: string;
      title: string;
      type: string;
      description: string | null;
      minimumLimitText: string | null;
      policyTypeName: string;
      coverageName: string | null;
    }>;
  }>("/api/agency/recommendations", token);
}

export async function loadAgencyReferenceData(token: string) {
  return getWithToken<AgencyReferenceData>("/api/agency/reference-data", token);
}

export async function createAgencyInsured(token: string, body: unknown) {
  return postWithToken("/api/agency/insureds", token, body);
}

export async function createAgencyPolicy(token: string, body: unknown) {
  return postWithToken("/api/agency/policies", token, body);
}

export async function updateAgencyInsured(token: string, insuredAccountId: string, body: unknown) {
  return patchWithToken(`/api/agency/insureds/${insuredAccountId}`, token, body);
}

export async function deleteAgencyInsured(token: string, insuredAccountId: string) {
  return deleteWithToken(`/api/agency/insureds/${insuredAccountId}`, token);
}

export async function deleteAgencyPolicy(token: string, policyId: string) {
  return deleteWithToken(`/api/agency/policies/${policyId}`, token);
}

export async function deleteAgencyContact(token: string, insuredAccountId: string, contactId: string) {
  return deleteWithToken(`/api/agency/insureds/${insuredAccountId}/contacts/${contactId}`, token);
}

export async function updateAgencyTaskStatus(
  token: string,
  taskId: string,
  status: "IN_PROGRESS" | "CLOSED"
) {
  return patchWithToken(`/api/agency/tasks/${taskId}`, token, { status });
}
