<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";

import { loadAgencyDashboard, type AgencyDashboard } from "../../agency";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const dashboard = ref<AgencyDashboard | null>(null);

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  try {
    dashboard.value = await loadAgencyDashboard(session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load dashboard.";
  }
}

function statusSeverity(status: string) {
  const map: Record<string, string> = {
    OPEN: "warn",
    IN_PROGRESS: "info",
    BLOCKED: "danger",
    CLOSED: "success",
    INVITED: "secondary",
    STARTED: "info",
    AWAITING_AGENCY: "warn",
  };
  return (map[status] ?? "secondary") as "warn" | "info" | "danger" | "success" | "secondary";
}

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Agency Dashboard</h1>
      <p class="text-muted text-sm mt-1">Operational overview for {{ sessionState.session?.activeAgency?.name }}</p>
    </div>

    <p v-if="errorMessage" class="text-danger text-sm mb-4">{{ errorMessage }}</p>

    <template v-if="dashboard">
      <!-- KPI cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card v-for="stat in [
          { label: 'Insureds', value: dashboard.summary.insuredCount, icon: 'pi pi-users', color: 'text-blue-600' },
          { label: 'Active Policies', value: dashboard.summary.activePolicyCount, icon: 'pi pi-file', color: 'text-green-600' },
          { label: 'Total Premium', value: formatCurrency(dashboard.summary.totalPremium), icon: 'pi pi-dollar', color: 'text-emerald-600' },
          { label: 'Open Tasks', value: dashboard.summary.openTaskCount, icon: 'pi pi-check-square', color: 'text-amber-600' },
          { label: 'Pending Reviews', value: dashboard.summary.pendingReviewCount, icon: 'pi pi-clock', color: 'text-indigo-600' },
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

      <!-- Tables -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="pi pi-check-square text-muted" />
              Recent Tasks
            </div>
          </template>
          <template #content>
            <DataTable :value="dashboard.recentTasks" :rows="5" size="small" stripedRows>
              <Column field="title" header="Task" />
              <Column field="status" header="Status">
                <template #body="{ data }">
                  <Tag :value="data.status" :severity="statusSeverity(data.status)" />
                </template>
              </Column>
              <Column field="insuredDisplayName" header="Insured" />
              <Column field="assignedTo" header="Assigned To">
                <template #body="{ data }">
                  {{ data.assignedTo ?? "Unassigned" }}
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>
            <div class="flex items-center gap-2">
              <i class="pi pi-clock text-muted" />
              Recent Reviews
            </div>
          </template>
          <template #content>
            <DataTable :value="dashboard.recentReviews" :rows="5" size="small" stripedRows>
              <Column field="insuredDisplayName" header="Insured" />
              <Column field="status" header="Status">
                <template #body="{ data }">
                  <Tag :value="data.status" :severity="statusSeverity(data.status)" />
                </template>
              </Column>
              <Column field="policyTypeName" header="Policy Type">
                <template #body="{ data }">
                  {{ data.policyTypeName ?? "General" }}
                </template>
              </Column>
              <Column field="summary" header="Summary">
                <template #body="{ data }">
                  <span class="text-sm text-muted truncate max-w-48 block">{{ data.summary ?? "—" }}</span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </template>
  </div>
</template>
