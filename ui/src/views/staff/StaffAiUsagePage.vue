<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Select from "primevue/select";
import Button from "primevue/button";
import Message from "primevue/message";
import Tag from "primevue/tag";

import {
  loadStaffAiUsage,
  type StaffAiUsageBreakdownItem,
  type StaffAiUsageReport,
  type StaffAiUsageSeriesPoint,
} from "../../staff";
import { hasPermission } from "../../permissions";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const loading = ref(false);
const report = ref<StaffAiUsageReport | null>(null);

const filters = reactive({
  days: 30,
  agencyId: "",
  provider: "",
  gateway: "",
  surface: "",
  status: "",
  model: "",
  userType: "",
});

const periodOptions = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Last 180 days", value: 180 },
];

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.ai_usage.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    report.value = await loadStaffAiUsage(session.token, {
      days: filters.days,
      ...(filters.agencyId ? { agencyId: filters.agencyId } : {}),
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.gateway ? { gateway: filters.gateway } : {}),
      ...(filters.surface ? { surface: filters.surface } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.model ? { model: filters.model } : {}),
      ...(filters.userType
        ? { userType: filters.userType as "STAFF" | "AGENCY" | "INSURED" }
        : {}),
    });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to load AI usage.";
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.days = 30;
  filters.agencyId = "";
  filters.provider = "";
  filters.gateway = "";
  filters.surface = "";
  filters.status = "";
  filters.model = "";
  filters.userType = "";
  loadPage();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusSeverity(status: string) {
  const map: Record<string, string> = {
    SUCCESS: "success",
    ERROR: "danger",
  };

  return (map[status] ?? "secondary") as
    | "success"
    | "danger"
    | "secondary"
    | "info"
    | "warn";
}

function maxSeriesValue(
  points: StaffAiUsageSeriesPoint[],
  key: keyof Pick<
    StaffAiUsageSeriesPoint,
    "requestCount" | "totalTokens" | "providerCost"
  >
): number {
  return points.reduce((max, point) => Math.max(max, point[key]), 0);
}

function seriesHeight(value: number, max: number): string {
  if (max <= 0) return "6%";
  return `${Math.max(6, (value / max) * 100)}%`;
}

function maxBreakdownValue(
  items: StaffAiUsageBreakdownItem[],
  key: keyof Pick<StaffAiUsageBreakdownItem, "totalTokens" | "providerCost" | "requestCount">
): number {
  return items.reduce((max, item) => Math.max(max, item[key]), 0);
}

function barWidth(value: number, max: number): string {
  if (max <= 0) return "0%";
  return `${(value / max) * 100}%`;
}

const requestSeriesMax = computed(() =>
  report.value ? maxSeriesValue(report.value.timeSeries, "requestCount") : 0
);
const tokenSeriesMax = computed(() =>
  report.value ? maxSeriesValue(report.value.timeSeries, "totalTokens") : 0
);
const costSeriesMax = computed(() =>
  report.value ? maxSeriesValue(report.value.timeSeries, "providerCost") : 0
);

const surfaceMax = computed(() =>
  report.value ? maxBreakdownValue(report.value.breakdowns.surfaces, "totalTokens") : 0
);
const providerMax = computed(() =>
  report.value ? maxBreakdownValue(report.value.breakdowns.providers, "totalTokens") : 0
);
const modelMax = computed(() =>
  report.value ? maxBreakdownValue(report.value.breakdowns.models, "totalTokens") : 0
);
const agencyMax = computed(() =>
  report.value ? maxBreakdownValue(report.value.breakdowns.agencies, "totalTokens") : 0
);

const summaryCards = computed(() => {
  if (!report.value) return [];

  return [
    {
      label: "Requests",
      value: formatNumber(report.value.summary.requestCount),
      help: `${formatNumber(report.value.summary.successCount)} succeeded`,
      icon: "pi pi-send",
      accent: "text-sky-700",
    },
    {
      label: "Total Tokens",
      value: formatCompact(report.value.summary.totalTokens),
      help: `${formatCompact(report.value.summary.inputCachedTokens)} cached input`,
      icon: "pi pi-database",
      accent: "text-emerald-700",
    },
    {
      label: "Output Tokens",
      value: formatCompact(report.value.summary.outputTokens),
      help: `${formatCompact(report.value.summary.reasoningTokens)} reasoning`,
      icon: "pi pi-file-edit",
      accent: "text-indigo-700",
    },
    {
      label: "Estimated Cost",
      value: formatCurrency(report.value.summary.providerCost),
      help: `${formatCurrency(report.value.summary.cacheDiscount)} cache discount`,
      icon: "pi pi-dollar",
      accent: "text-amber-700",
    },
    {
      label: "Error Rate",
      value: formatPercent(report.value.summary.errorRate),
      help: `${formatNumber(report.value.summary.errorCount)} failed calls`,
      icon: "pi pi-exclamation-triangle",
      accent: "text-rose-700",
    },
    {
      label: "Active Agencies",
      value: formatNumber(report.value.summary.activeAgencyCount),
      help: `${formatNumber(report.value.summary.activeUserCount)} active users`,
      icon: "pi pi-building-columns",
      accent: "text-violet-700",
    },
  ];
});

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold">AI Usage</h1>
        <p class="text-muted text-sm mt-1">
          Provider-level activity, token volume, cache behavior, and cost trends.
        </p>
      </div>
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        :loading="loading"
        @click="loadPage"
      />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">
      {{ errorMessage }}
    </Message>

    <template v-if="report">
      <Card class="mb-6">
        <template #content>
          <div class="flex items-center justify-between gap-4 mb-4">
            <div>
              <div class="text-sm font-medium">Filters</div>
              <div class="text-xs text-muted mt-1">
                {{ formatDateTime(report.range.start) }} to {{ formatDateTime(report.range.end) }}
              </div>
            </div>
            <div class="text-xs text-muted">
              {{ formatNumber(report.recentEvents.length) }} recent events shown
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Window</label>
              <Select v-model="filters.days" :options="periodOptions" optionLabel="label" optionValue="value" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Agency</label>
              <Select
                v-model="filters.agencyId"
                :options="[{ label: 'All agencies', value: '' }, ...report.filterOptions.agencies.map((agency) => ({ label: agency.name, value: agency.id }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Provider</label>
              <Select
                v-model="filters.provider"
                :options="[{ label: 'All providers', value: '' }, ...report.filterOptions.providers.map((value) => ({ label: value, value }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Gateway</label>
              <Select
                v-model="filters.gateway"
                :options="[{ label: 'All gateways', value: '' }, ...report.filterOptions.gateways.map((value) => ({ label: value, value }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Surface</label>
              <Select
                v-model="filters.surface"
                :options="[{ label: 'All surfaces', value: '' }, ...report.filterOptions.surfaces.map((value) => ({ label: value, value }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Status</label>
              <Select
                v-model="filters.status"
                :options="[{ label: 'All statuses', value: '' }, ...report.filterOptions.statuses.map((value) => ({ label: value, value }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Model</label>
              <Select
                v-model="filters.model"
                :options="[{ label: 'All models', value: '' }, ...report.filterOptions.models.map((value) => ({ label: value, value }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">User Type</label>
              <Select
                v-model="filters.userType"
                :options="[{ label: 'All user types', value: '' }, ...report.filterOptions.userTypes.map((value) => ({ label: value, value }))]"
                optionLabel="label"
                optionValue="value"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <Button label="Reset" severity="secondary" text @click="resetFilters" />
            <Button label="Apply Filters" icon="pi pi-filter" :loading="loading" @click="loadPage" />
          </div>
        </template>
      </Card>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Card v-for="card in summaryCards" :key="card.label">
          <template #content>
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-surface-alt flex items-center justify-center shrink-0">
                <i :class="[card.icon, card.accent]" class="text-xl" />
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-muted font-semibold">
                  {{ card.label }}
                </div>
                <div class="text-2xl font-bold mt-1">{{ card.value }}</div>
                <div class="text-xs text-muted mt-1">{{ card.help }}</div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <template #title>Requests By Day</template>
          <template #content>
            <div class="flex items-end gap-1 h-32">
              <div
                v-for="point in report.timeSeries"
                :key="`requests-${point.date}`"
                class="flex-1 rounded-t bg-sky-400/80 hover:bg-sky-500 transition-colors"
                :style="{ height: seriesHeight(point.requestCount, requestSeriesMax) }"
                :title="`${formatDateLabel(point.date)}: ${formatNumber(point.requestCount)} requests`"
              />
            </div>
            <div class="flex justify-between text-xs text-muted mt-3">
              <span>{{ formatDateLabel(report.timeSeries[0]?.date ?? '') }}</span>
              <span>{{ formatNumber(report.summary.requestCount) }} total</span>
              <span>{{ formatDateLabel(report.timeSeries[report.timeSeries.length - 1]?.date ?? '') }}</span>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>Tokens By Day</template>
          <template #content>
            <div class="flex items-end gap-1 h-32">
              <div
                v-for="point in report.timeSeries"
                :key="`tokens-${point.date}`"
                class="flex-1 rounded-t bg-emerald-400/80 hover:bg-emerald-500 transition-colors"
                :style="{ height: seriesHeight(point.totalTokens, tokenSeriesMax) }"
                :title="`${formatDateLabel(point.date)}: ${formatCompact(point.totalTokens)} tokens`"
              />
            </div>
            <div class="flex justify-between text-xs text-muted mt-3">
              <span>{{ formatCompact(report.summary.totalTokens) }} total</span>
              <span>{{ formatCompact(report.summary.inputCachedTokens) }} cached</span>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>Cost By Day</template>
          <template #content>
            <div class="flex items-end gap-1 h-32">
              <div
                v-for="point in report.timeSeries"
                :key="`cost-${point.date}`"
                class="flex-1 rounded-t bg-amber-400/80 hover:bg-amber-500 transition-colors"
                :style="{ height: seriesHeight(point.providerCost, costSeriesMax) }"
                :title="`${formatDateLabel(point.date)}: ${formatCurrency(point.providerCost)}`"
              />
            </div>
            <div class="flex justify-between text-xs text-muted mt-3">
              <span>{{ formatCurrency(report.summary.providerCost) }} total</span>
              <span>{{ formatCurrency(report.summary.cacheDiscount) }} discount</span>
            </div>
          </template>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <template #title>Usage By Surface</template>
          <template #content>
            <div class="flex flex-col gap-3">
              <div
                v-for="item in report.breakdowns.surfaces"
                :key="`surface-${item.key}`"
                class="rounded-xl border border-border p-3 bg-white/70"
              >
                <div class="flex items-center justify-between gap-3 mb-2">
                  <div class="font-medium">{{ item.label }}</div>
                  <div class="text-sm text-muted">{{ formatCompact(item.totalTokens) }} tokens</div>
                </div>
                <div class="h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div class="h-full rounded-full bg-sky-500" :style="{ width: barWidth(item.totalTokens, surfaceMax) }" />
                </div>
                <div class="flex justify-between text-xs text-muted mt-2">
                  <span>{{ formatNumber(item.requestCount) }} requests</span>
                  <span>{{ formatCurrency(item.providerCost) }}</span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>Top Agencies</template>
          <template #content>
            <div class="flex flex-col gap-3">
              <div
                v-for="item in report.breakdowns.agencies"
                :key="`agency-${item.key}`"
                class="rounded-xl border border-border p-3 bg-white/70"
              >
                <div class="flex items-center justify-between gap-3 mb-2">
                  <div class="font-medium truncate">{{ item.label }}</div>
                  <div class="text-sm text-muted">{{ formatCompact(item.totalTokens) }} tokens</div>
                </div>
                <div class="h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div class="h-full rounded-full bg-amber-500" :style="{ width: barWidth(item.totalTokens, agencyMax) }" />
                </div>
                <div class="flex justify-between text-xs text-muted mt-2">
                  <span>{{ formatNumber(item.requestCount) }} requests</span>
                  <span>{{ formatCurrency(item.providerCost) }}</span>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card class="mb-6">
        <template #title>Model Ranking</template>
        <template #content>
          <div class="flex flex-col gap-4">
            <div
              v-for="(item, index) in report.breakdowns.models"
              :key="`model-rank-${item.key}`"
              class="flex flex-col gap-2"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-6 text-sm font-bold text-muted shrink-0">#{{ index + 1 }}</div>
                  <div class="min-w-0">
                    <div class="font-semibold truncate text-sm">{{ item.label }}</div>
                    <div class="text-[10px] text-muted uppercase tracking-wider">{{ item.key.split('/')[0] }}</div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-mono">{{ formatCompact(item.totalTokens) }} tokens</div>
                  <div class="text-xs text-muted">{{ formatCurrency(item.providerCost) }}</div>
                </div>
              </div>
              <div class="h-3 rounded-full bg-surface-alt overflow-hidden flex">
                <div 
                  class="h-full bg-sky-500/80" 
                  :style="{ width: barWidth(item.inputTokens - item.inputCachedTokens, item.totalTokens) }" 
                  title="Input Tokens"
                />
                <div 
                  class="h-full bg-indigo-500/80" 
                  :style="{ width: barWidth(item.inputCachedTokens, item.totalTokens) }" 
                  title="Cached Tokens"
                />
                <div 
                  class="h-full bg-emerald-500/80" 
                  :style="{ width: barWidth(item.outputTokens, item.totalTokens) }" 
                  title="Output Tokens"
                />
              </div>
              <div class="flex justify-between text-[10px] text-muted font-mono">
                <div class="flex gap-2">
                  <span>In: {{ formatCompact(item.inputTokens - item.inputCachedTokens) }}</span>
                  <span v-if="item.inputCachedTokens > 0" class="text-indigo-600">Cache: {{ formatCompact(item.inputCachedTokens) }}</span>
                  <span>Out: {{ formatCompact(item.outputTokens) }}</span>
                </div>
                <span>{{ formatNumber(item.requestCount) }} calls</span>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>
          <div class="flex items-center justify-between gap-4">
            <span>Recent AI Calls</span>
            <div class="text-xs text-muted">Most recent matching provider requests</div>
          </div>
        </template>
        <template #content>
          <DataTable :value="report.recentEvents" stripedRows paginator :rows="20" size="small" class="text-xs">
            <Column field="createdAt" header="Created">
              <template #body="{ data }">{{ formatDateTime(data.createdAt) }}</template>
            </Column>
            <Column field="agencyName" header="Agency">
              <template #body="{ data }">{{ data.agencyName ?? "—" }}</template>
            </Column>
            <Column field="surface" header="Surface">
              <template #body="{ data }">
                <Tag :value="data.surface" severity="info" />
              </template>
            </Column>
            <Column field="status" header="Status">
              <template #body="{ data }">
                <Tag :value="data.status" :severity="statusSeverity(data.status)" />
              </template>
            </Column>
            <Column field="model" header="Model">
              <template #body="{ data }">
                <span class="text-sm">{{ data.model }}</span>
              </template>
            </Column>
            <Column header="Tokens">
              <template #body="{ data }">
                <div class="text-sm">{{ formatCompact(data.totalTokens) }}</div>
                <div class="text-xs text-muted">
                  in {{ formatCompact(data.inputTokens) }} / out {{ formatCompact(data.outputTokens) }}
                </div>
              </template>
            </Column>
            <Column header="Cache">
              <template #body="{ data }">{{ formatCompact(data.inputCachedTokens) }}</template>
            </Column>
            <Column header="Cost">
              <template #body="{ data }">{{ formatCurrency(data.providerCost) }}</template>
            </Column>
            <Column header="User">
              <template #body="{ data }">
                <div class="text-sm">{{ data.userDisplayName ?? data.userEmail ?? "—" }}</div>
                <div class="text-xs text-muted">{{ data.userType ?? "—" }}</div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>
