<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Message from "primevue/message";
import Button from "primevue/button";

import { loadStaffDashboard, type StaffDashboard } from "../../staff";
import { hasPermission } from "../../permissions";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const dashboard = ref<StaffDashboard | null>(null);

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  try {
    dashboard.value = await loadStaffDashboard(session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load dashboard.";
  }
}

function statusSeverity(status: string) {
  const map: Record<string, string> = {
    INVITED: "secondary",
    STARTED: "info",
    IN_PROGRESS: "info",
    AWAITING_AGENCY: "warn",
    CLOSED: "success",
  };
  return (map[status] ?? "secondary") as "warn" | "info" | "danger" | "success" | "secondary";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

const canViewAiUsage = computed(() => hasPermission("staff.ai_usage.view"));

const aiUsageStats = computed(() => {
  if (!dashboard.value?.aiUsage) return [];

  const usage = dashboard.value.aiUsage.last30Days;

  return [
    {
      label: "AI Requests",
      value: formatCompact(usage.requestCount),
      help: `${formatCompact(dashboard.value.aiUsage.last7Days.requestCount)} in the last 7 days`,
      icon: "pi pi-send",
      color: "text-sky-600",
    },
    {
      label: "Total Tokens",
      value: formatCompact(usage.totalTokens),
      help: `${formatCompact(usage.inputCachedTokens)} cached input`,
      icon: "pi pi-database",
      color: "text-emerald-600",
    },
    {
      label: "Estimated Cost",
      value: formatCurrency(usage.providerCost),
      help: `${formatCurrency(usage.cacheDiscount)} cache discount`,
      icon: "pi pi-dollar",
      color: "text-amber-600",
    },
    {
      label: "Error Rate",
      value: formatPercent(usage.errorRate),
      help: `${formatCompact(usage.errorCount)} failed calls`,
      icon: "pi pi-exclamation-triangle",
      color: "text-rose-600",
    },
    {
      label: "Active AI Agencies",
      value: formatCompact(usage.activeAgencyCount),
      help: `${formatCompact(usage.activeUserCount)} active AI users`,
      icon: "pi pi-building-columns",
      color: "text-violet-600",
    },
  ];
});

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Platform Dashboard</h1>
      <p class="text-muted text-sm mt-1">System-wide overview</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <template v-if="dashboard">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card v-for="stat in [
          { label: 'Agencies', value: dashboard.stats.agencyCount, icon: 'pi pi-building', color: 'text-blue-600' },
          { label: 'Users', value: dashboard.stats.userCount, icon: 'pi pi-users', color: 'text-indigo-600' },
          { label: 'Insureds', value: dashboard.stats.insuredCount, icon: 'pi pi-id-card', color: 'text-green-600' },
          { label: 'Policies', value: dashboard.stats.policyCount, icon: 'pi pi-file', color: 'text-amber-600' },
          { label: 'Reviews', value: dashboard.stats.reviewCount, icon: 'pi pi-comments', color: 'text-purple-600' },
        ]" :key="stat.label">
          <template #content>
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-surface-alt flex items-center justify-center">
                <i :class="[stat.icon, stat.color]" class="text-xl" />
              </div>
              <div>
                <div class="text-2xl font-bold">{{ stat.value }}</div>
                <div class="text-sm text-muted">{{ stat.label }}</div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card>
        <template #title>
          <div class="flex items-center gap-2">
            <i class="pi pi-clock text-muted" />
            Recent Reviews
          </div>
        </template>
        <template #content>
          <DataTable :value="dashboard.recentReviews" stripedRows>
            <Column field="insuredDisplayName" header="Insured" sortable />
            <Column field="agencyName" header="Agency" sortable />
            <Column field="policyTypeName" header="Policy Type">
              <template #body="{ data }">{{ data.policyTypeName ?? "General" }}</template>
            </Column>
            <Column field="status" header="Status">
              <template #body="{ data }">
                <Tag :value="data.status" :severity="statusSeverity(data.status)" />
              </template>
            </Column>
            <Column field="summary" header="Summary">
              <template #body="{ data }">
                <span class="text-sm text-muted truncate max-w-64 block">{{ data.summary ?? "—" }}</span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <template v-if="canViewAiUsage && dashboard.aiUsage">
        <div class="flex items-center justify-between gap-4 mt-8 mb-4">
          <div>
            <h2 class="text-xl font-bold">AI Usage Snapshot</h2>
            <p class="text-muted text-sm mt-1">Last 30 days of provider usage and cost.</p>
          </div>
          <Button
            label="Open AI Usage"
            icon="pi pi-chart-bar"
            severity="secondary"
            @click="router.push('/staff/ai-usage')"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card v-for="stat in aiUsageStats" :key="stat.label">
            <template #content>
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-surface-alt flex items-center justify-center">
                  <i :class="[stat.icon, stat.color]" class="text-xl" />
                </div>
                <div>
                  <div class="text-2xl font-bold">{{ stat.value }}</div>
                  <div class="text-sm text-muted">{{ stat.label }}</div>
                  <div class="text-xs text-muted mt-1">{{ stat.help }}</div>
                </div>
              </div>
            </template>
          </Card>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <template #title>Top AI Surfaces</template>
            <template #content>
              <div class="flex flex-col gap-3">
                <div
                  v-for="item in dashboard.aiUsage.surfaces30Days.slice(0, 5)"
                  :key="item.key"
                  class="rounded-xl border border-border p-3 bg-white/70"
                >
                  <div class="flex justify-between gap-3 mb-2">
                    <div class="font-medium">{{ item.label }}</div>
                    <div class="text-sm text-muted">{{ formatCompact(item.totalTokens) }} tokens</div>
                  </div>
                  <div class="flex justify-between text-xs text-muted">
                    <span>{{ formatCompact(item.requestCount) }} requests</span>
                    <span>{{ formatCurrency(item.providerCost) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </Card>

          <Card>
            <template #title>Top AI Agencies</template>
            <template #content>
              <div class="flex flex-col gap-3">
                <div
                  v-for="item in dashboard.aiUsage.topAgencies30Days.slice(0, 5)"
                  :key="item.key"
                  class="rounded-xl border border-border p-3 bg-white/70"
                >
                  <div class="flex justify-between gap-3 mb-2">
                    <div class="font-medium">{{ item.label }}</div>
                    <div class="text-sm text-muted">{{ formatCompact(item.totalTokens) }} tokens</div>
                  </div>
                  <div class="flex justify-between text-xs text-muted">
                    <span>{{ formatCompact(item.requestCount) }} requests</span>
                    <span>{{ formatCurrency(item.providerCost) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </template>
    </template>
  </div>
</template>
