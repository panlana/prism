<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Message from "primevue/message";

import { loadAgencyPolicyDetail, deleteAgencyPolicy, type AgencyPolicyDetail } from "../../agency";
import { sessionState } from "../../session";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const errorMessage = ref("");
const detail = ref<AgencyPolicyDetail | null>(null);
const activeTab = ref("summary");

function formatCurrency(value: string | null) {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPropertyAddress(p: AgencyPolicyDetail["policy"]) {
  const parts = [p.propertyStreet, p.propertyCity, p.propertyStateCode, p.propertyPostalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

const propertyCoverages = computed(() =>
  detail.value?.policy.coverages.filter((c) => c.section === "PROPERTY") ?? []
);
const liabilityCoverages = computed(() =>
  detail.value?.policy.coverages.filter((c) => c.section === "LIABILITY") ?? []
);
const optionalCoverages = computed(() =>
  detail.value?.policy.coverages.filter((c) => c.section === "OPTIONAL") ?? []
);
const credits = computed(() =>
  detail.value?.policy.coverages.filter((c) => c.section === "CREDIT") ?? []
);

function premiumDisplay(cov: { premiumAmount: string | null; premiumText: string | null }) {
  if (cov.premiumText) return cov.premiumText;
  if (cov.premiumAmount) {
    const num = parseFloat(cov.premiumAmount);
    if (num < 0) return `-$${Math.abs(num).toFixed(0)}`;
    if (num === 0) return "$0";
    return `$${num.toFixed(0)}`;
  }
  return "—";
}

const hasCoverages = computed(() => (detail.value?.policy.coverages.length ?? 0) > 0);
const hasDocuments = computed(() =>
  (detail.value?.policy.declarationPages.length ?? 0) > 0 ||
  (detail.value?.policy.decForms?.length ?? 0) > 0 ||
  (detail.value?.policy.forms.length ?? 0) > 0
);

async function loadPage() {
  const session = sessionState.session;
  const policyId = route.params.policyId;

  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  if (typeof policyId !== "string") {
    await router.push("/agency/policies");
    return;
  }

  try {
    detail.value = await loadAgencyPolicyDetail(session.token, policyId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load policy detail.";
  }
}

function confirmDeletePolicy() {
  const num = detail.value?.policy.policyNumber ?? "this policy";
  confirm.require({
    message: `Delete policy "${num}"? Associated coverages and form selections will also be removed. This cannot be undone.`,
    header: "Delete Policy",
    icon: "pi pi-trash",
    rejectLabel: "Cancel",
    acceptLabel: "Delete",
    acceptClass: "p-button-danger",
    accept: async () => {
      const session = sessionState.session;
      if (!session || !detail.value) return;
      try {
        await deleteAgencyPolicy(session.token, detail.value.policy.id);
        router.push("/agency/policies");
      } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : "Failed to delete policy.";
      }
    },
  });
}

function onDataChanged() {
  loadPage();
}

onMounted(() => {
  loadPage();
  window.addEventListener("prism:data-changed", onDataChanged);
});

onUnmounted(() => {
  window.removeEventListener("prism:data-changed", onDataChanged);
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="router.back()" />
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold">{{ detail?.policy.policyTypeName ?? "Policy" }}</h1>
            <Tag v-if="detail" :value="detail.policy.status" :severity="detail.policy.status === 'ACTIVE' ? 'success' : 'secondary'" />
          </div>
          <p class="text-muted text-sm mt-0.5">{{ detail?.policy.policyNumber ?? "No policy number" }}</p>
        </div>
      </div>
      <Button v-if="detail" label="Delete" icon="pi pi-trash" severity="danger" text @click="confirmDeletePolicy" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <template v-if="detail">
      <!-- Tab Selector -->
      <div class="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit mb-5">
        <button
          v-for="tab in [
            { key: 'summary', icon: 'pi pi-info-circle', label: 'Summary' },
            { key: 'coverages', icon: 'pi pi-shield', label: `Coverages (${detail.policy.coverages.length})` },
            { key: 'documents', icon: 'pi pi-file', label: 'Documents' },
          ]"
          :key="tab.key"
          :class="['px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer border-0', activeTab === tab.key ? 'bg-white text-foreground shadow-sm' : 'bg-transparent text-muted hover:text-foreground']"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon" class="mr-1.5" />{{ tab.label }}
        </button>
      </div>

      <!-- ══ Summary Tab ══ -->
      <div v-if="activeTab === 'summary'" class="grid grid-cols-2 gap-5">
        <!-- Policy Details -->
        <div class="border border-border rounded-xl bg-white p-5">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Policy Details</h3>
          <div class="flex flex-col gap-3 text-sm">
            <div class="flex justify-between">
              <span class="text-muted">Insured</span>
              <span>{{ detail.policy.insuredDisplayName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Carrier</span>
              <span>{{ detail.policy.carrierName ?? "Unknown" }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Policy Form</span>
              <span>{{ detail.policy.policyFormCode ?? "—" }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Term</span>
              <span>{{ formatDate(detail.policy.effectiveDate) }} – {{ formatDate(detail.policy.expirationDate) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Premium</span>
              <span class="font-medium">{{ formatCurrency(detail.policy.premium) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Deductible</span>
              <span>{{ formatCurrency(detail.policy.deductible) }}</span>
            </div>
            <div v-if="formatPropertyAddress(detail.policy)" class="flex justify-between">
              <span class="text-muted">Property</span>
              <span class="text-right max-w-64">{{ formatPropertyAddress(detail.policy) }}</span>
            </div>
            <div v-if="detail.policy.mortgagee" class="flex justify-between">
              <span class="text-muted">Mortgagee</span>
              <span class="text-right max-w-64">{{ detail.policy.mortgagee }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Readiness</span>
              <Tag :value="detail.policy.readinessSource" :severity="detail.policy.readinessSource === 'NONE' ? 'warn' : 'info'" />
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div class="border border-border rounded-xl bg-white p-5">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
            Recommendations
            <Tag :value="String(detail.policy.recommendations.length)" severity="info" rounded class="ml-2" />
          </h3>
          <div class="flex flex-col gap-3">
            <div v-for="rec in detail.policy.recommendations" :key="rec.id" class="border-b border-border pb-3 last:border-0 last:pb-0">
              <div class="flex items-center justify-between mb-1">
                <span class="font-medium text-sm">{{ rec.title }}</span>
                <Tag :value="rec.type" severity="secondary" />
              </div>
              <p class="text-muted text-xs">{{ rec.coverageName ?? "General rule" }}</p>
              <p class="text-sm mt-1">{{ rec.description ?? "No description provided." }}</p>
            </div>
            <p v-if="!detail.policy.recommendations.length" class="text-muted text-sm">No recommendations configured.</p>
          </div>
        </div>
      </div>

      <!-- ══ Coverages Tab ══ -->
      <div v-if="activeTab === 'coverages'">
        <div v-if="hasCoverages" class="border border-border rounded-xl bg-white p-5">
          <div class="grid grid-cols-2 gap-6">
            <!-- Property -->
            <div v-if="propertyCoverages.length > 0">
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Section I — Property</h4>
              <div class="flex flex-col gap-2">
                <div v-for="cov in propertyCoverages" :key="cov.id" class="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span>{{ cov.label }}</span>
                  <div class="flex items-center gap-4 text-right">
                    <span v-if="cov.limitAmount" class="font-medium">{{ formatCurrency(cov.limitAmount) }}</span>
                    <span class="text-muted w-16 text-right">{{ premiumDisplay(cov) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Liability -->
            <div v-if="liabilityCoverages.length > 0">
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Section II — Liability</h4>
              <div class="flex flex-col gap-2">
                <div v-for="cov in liabilityCoverages" :key="cov.id" class="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span>{{ cov.label }}</span>
                  <div class="flex items-center gap-4 text-right">
                    <span v-if="cov.limitAmount" class="font-medium">{{ formatCurrency(cov.limitAmount) }}</span>
                    <span class="text-muted w-16 text-right">{{ premiumDisplay(cov) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Optional -->
            <div v-if="optionalCoverages.length > 0">
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Optional Coverages</h4>
              <div class="flex flex-col gap-2">
                <div v-for="cov in optionalCoverages" :key="cov.id" class="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span>{{ cov.label }}</span>
                  <span class="text-muted">{{ premiumDisplay(cov) }}</span>
                </div>
              </div>
            </div>

            <!-- Credits -->
            <div v-if="credits.length > 0">
              <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Credits & Discounts</h4>
              <div class="flex flex-col gap-2">
                <div v-for="cov in credits" :key="cov.id" class="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span>{{ cov.label }}</span>
                  <span class="text-green-600 font-medium">{{ premiumDisplay(cov) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-muted text-sm">No coverages recorded.</p>
      </div>

      <!-- ══ Documents Tab ══ -->
      <div v-if="activeTab === 'documents'" class="grid grid-cols-2 gap-5">
        <!-- Declaration Pages -->
        <div class="border border-border rounded-xl bg-white p-5">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Declaration Pages</h3>
          <DataTable v-if="detail.policy.declarationPages.length > 0" :value="detail.policy.declarationPages" stripedRows size="small">
            <Column header="Status">
              <template #body="{ data }">
                <Tag :value="data.isActive ? 'Active' : 'Inactive'" :severity="data.isActive ? 'success' : 'secondary'" />
              </template>
            </Column>
            <Column header="Extraction">
              <template #body="{ data }">
                <Tag :value="data.extractionStatus" severity="info" />
              </template>
            </Column>
            <Column field="documentPath" header="Document">
              <template #body="{ data }">
                <span class="text-sm truncate max-w-48 block">{{ data.documentPath }}</span>
              </template>
            </Column>
          </DataTable>
          <p v-else class="text-muted text-sm">No declaration pages uploaded.</p>
        </div>

        <!-- Forms -->
        <div class="border border-border rounded-xl bg-white p-5">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
            Forms & Endorsements
            <Tag v-if="detail.policy.decForms?.length" :value="String(detail.policy.decForms.length)" severity="secondary" rounded class="ml-2" />
          </h3>
          <div v-if="detail.policy.decForms?.length" class="flex flex-wrap gap-2">
            <Tag
              v-for="(form, idx) in detail.policy.decForms"
              :key="idx"
              :value="form"
              severity="secondary"
            />
          </div>
          <DataTable v-if="detail.policy.forms.length > 0" :value="detail.policy.forms" stripedRows size="small" :class="{ 'mt-4': detail.policy.decForms?.length }">
            <Column field="title" header="Title" />
            <Column field="formNumber" header="Form #">
              <template #body="{ data }">{{ data.formNumber ?? "—" }}</template>
            </Column>
            <Column field="source" header="Source">
              <template #body="{ data }">
                <Tag :value="data.source" severity="secondary" />
              </template>
            </Column>
          </DataTable>
          <p v-if="!detail.policy.decForms?.length && !detail.policy.forms.length" class="text-muted text-sm">No forms listed.</p>
        </div>
      </div>
    </template>

    <ConfirmDialog />
  </div>
</template>
