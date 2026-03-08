<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Tag from "primevue/tag";
import Select from "primevue/select";
import Message from "primevue/message";

import {
  createAgencyPolicy,
  loadAgencyInsureds,
  loadAgencyPolicies,
  loadAgencyReferenceData,
  type AgencyInsureds,
  type AgencyPolicies,
  type AgencyReferenceData,
} from "../../agency";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const workflowMessage = ref("");
const loading = ref(false);
const insureds = ref<AgencyInsureds | null>(null);
const policies = ref<AgencyPolicies | null>(null);
const referenceData = ref<AgencyReferenceData | null>(null);
const search = ref("");
const showCreateDialog = ref(false);

function formatCurrency(value: string | number | null) {
  if (!value) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(num);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

const form = reactive({
  insuredAccountId: "",
  policyTypeCode: "HOMEOWNERS",
  stateCode: "VA",
  carrierSlug: "nationwide",
  policyNumber: "",
  status: "ACTIVE",
  readinessSource: "MANUAL",
  premium: "",
});

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  try {
    const [insuredList, policyList, refData] = await Promise.all([
      loadAgencyInsureds(session.token),
      loadAgencyPolicies(session.token),
      loadAgencyReferenceData(session.token),
    ]);
    insureds.value = insuredList;
    policies.value = policyList;
    referenceData.value = refData;
    form.insuredAccountId = insuredList.items[0]?.id ?? form.insuredAccountId;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load policies.";
  }
}

async function submit() {
  const session = sessionState.session;
  if (!session || !form.insuredAccountId) return;

  loading.value = true;
  errorMessage.value = "";
  workflowMessage.value = "";

  try {
    await createAgencyPolicy(session.token, form);
    workflowMessage.value = `Created policy ${form.policyNumber}.`;
    showCreateDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to create policy.";
  } finally {
    loading.value = false;
  }
}

const filteredPolicies = computed(() => {
  const items = policies.value?.items ?? [];
  const query = search.value.trim().toLowerCase();
  if (!query) return items;
  return items.filter((policy) =>
    [policy.insuredDisplayName, policy.policyNumber ?? "", policy.policyTypeName, policy.carrierName ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
});

function openPolicy(policyId: string) {
  router.push(`/agency/policies/${policyId}`);
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Policies</h1>
        <p class="text-muted text-sm mt-1">Policy management</p>
      </div>
      <Button label="New Policy" icon="pi pi-plus" @click="showCreateDialog = true" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="workflowMessage" severity="success" :closable="false" class="mb-4">{{ workflowMessage }}</Message>

    <Card>
      <template #content>
        <div class="mb-4">
          <InputText v-model="search" placeholder="Search policies..." class="w-full" />
        </div>

        <DataTable
          :value="filteredPolicies"
          :rows="20"
          :paginator="filteredPolicies.length > 20"
          stripedRows
          selectionMode="single"
          @rowSelect="(e: any) => openPolicy(e.data.id)"
          scrollable
          scrollHeight="calc(100vh - 22rem)"
          class="cursor-pointer text-sm"
        >
          <Column field="policyTypeName" header="Type" sortable />
          <Column field="insuredDisplayName" header="Insured" sortable />
          <Column field="carrierName" header="Carrier" sortable>
            <template #body="{ data }">{{ data.carrierName ?? "—" }}</template>
          </Column>
          <Column field="policyNumber" header="Policy #" sortable>
            <template #body="{ data }">{{ data.policyNumber ?? "—" }}</template>
          </Column>
          <Column field="premium" header="Premium" sortable>
            <template #body="{ data }">{{ formatCurrency(data.premium) }}</template>
          </Column>
          <Column field="expirationDate" header="Expires" sortable>
            <template #body="{ data }">{{ formatDate(data.expirationDate) }}</template>
          </Column>
          <Column field="status" header="Status" sortable>
            <template #body="{ data }">
              <Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreateDialog" header="New Policy" :modal="true" :style="{ width: '480px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Insured</label>
          <Select v-model="form.insuredAccountId" :options="insureds?.items ?? []" optionLabel="displayName" optionValue="id" placeholder="Select insured" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Policy Type</label>
          <Select v-model="form.policyTypeCode" :options="referenceData?.policyTypes ?? []" optionLabel="name" optionValue="code" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Carrier</label>
          <Select v-model="form.carrierSlug" :options="referenceData?.carriers ?? []" optionLabel="name" optionValue="slug" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Policy Number</label>
          <InputText v-model="form.policyNumber" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Premium</label>
          <InputText v-model="form.premium" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showCreateDialog = false" />
          <Button type="submit" label="Create" icon="pi pi-check" :loading="loading" :disabled="!form.insuredAccountId" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
