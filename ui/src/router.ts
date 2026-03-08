import { createRouter, createWebHistory } from "vue-router";

import HomePage from "./views/HomePage.vue";
import InsuredPage from "./views/InsuredPage.vue";
import AgencyLayout from "./views/agency/AgencyLayout.vue";
import AgencyDashboardPage from "./views/agency/AgencyDashboardPage.vue";
import AgencyInsuredsPage from "./views/agency/AgencyInsuredsPage.vue";
import AgencyInsuredDetailPage from "./views/agency/AgencyInsuredDetailPage.vue";
import AgencyPoliciesPage from "./views/agency/AgencyPoliciesPage.vue";
import AgencyPolicyDetailPage from "./views/agency/AgencyPolicyDetailPage.vue";
import AgencyRecommendationsPage from "./views/agency/AgencyRecommendationsPage.vue";
import AgencySettingsPage from "./views/agency/AgencySettingsPage.vue";
import AgencyTasksPage from "./views/agency/AgencyTasksPage.vue";
import StaffLayout from "./views/staff/StaffLayout.vue";
import StaffDashboardPage from "./views/staff/StaffDashboardPage.vue";
import StaffAiUsagePage from "./views/staff/StaffAiUsagePage.vue";
import StaffAgenciesPage from "./views/staff/StaffAgenciesPage.vue";
import StaffAgencyDetailPage from "./views/staff/StaffAgencyDetailPage.vue";
import StaffCoverageLibraryPage from "./views/staff/StaffCoverageLibraryPage.vue";
import StaffCarriersPage from "./views/staff/StaffCarriersPage.vue";
import StaffCarrierDetailPage from "./views/staff/StaffCarrierDetailPage.vue";
import StaffOfferingDetailPage from "./views/staff/StaffOfferingDetailPage.vue";
import StaffPolicyTypesPage from "./views/staff/StaffPolicyTypesPage.vue";
import StaffContextBlocksPage from "./views/staff/StaffContextBlocksPage.vue";
import StaffContextPreviewPage from "./views/staff/StaffContextPreviewPage.vue";
import StaffFeatureFlagsPage from "./views/staff/StaffFeatureFlagsPage.vue";
import StaffToolsPage from "./views/staff/StaffToolsPage.vue";
import StaffPermissionsPage from "./views/staff/StaffPermissionsPage.vue";
import StaffRolesPage from "./views/staff/StaffRolesPage.vue";
import StaffUsersPage from "./views/staff/StaffUsersPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: HomePage
    },
    {
      path: "/agency",
      component: AgencyLayout,
      children: [
        { path: "", redirect: "/agency/dashboard" },
        { path: "dashboard", component: AgencyDashboardPage },
        { path: "insureds", component: AgencyInsuredsPage },
        { path: "insureds/:insuredAccountId", component: AgencyInsuredDetailPage },
        { path: "recommendations", component: AgencyRecommendationsPage },
        { path: "policies", component: AgencyPoliciesPage },
        { path: "policies/:policyId", component: AgencyPolicyDetailPage },
        { path: "tasks", component: AgencyTasksPage },
        { path: "settings", component: AgencySettingsPage }
      ]
    },
    {
      path: "/staff",
      component: StaffLayout,
      children: [
        { path: "", redirect: "/staff/dashboard" },
        { path: "dashboard", component: StaffDashboardPage },
        { path: "ai-usage", component: StaffAiUsagePage },
        { path: "agencies", component: StaffAgenciesPage },
        { path: "agencies/:agencyId", component: StaffAgencyDetailPage },
        { path: "coverage", component: StaffCoverageLibraryPage },
        { path: "carriers", component: StaffCarriersPage },
        { path: "carriers/:carrierId", component: StaffCarrierDetailPage },
        { path: "offerings/:offeringId", component: StaffOfferingDetailPage },
        { path: "policy-types", component: StaffPolicyTypesPage },
        { path: "context-blocks", component: StaffContextBlocksPage },
        { path: "context-preview", component: StaffContextPreviewPage },
        { path: "feature-flags", component: StaffFeatureFlagsPage },
        { path: "tools", component: StaffToolsPage },
        { path: "permissions", component: StaffPermissionsPage },
        { path: "roles", component: StaffRolesPage },
        { path: "users", component: StaffUsersPage }
      ]
    },
    {
      path: "/insured",
      component: InsuredPage
    }
  ]
});
