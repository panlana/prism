<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
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
  createAgencyInsured,
  loadAgencyInsureds,
  loadAgencyReferenceData,
  type AgencyInsureds,
  type AgencyReferenceData,
} from "../../agency";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const workflowMessage = ref("");
const insureds = ref<AgencyInsureds | null>(null);
const referenceData = ref<AgencyReferenceData | null>(null);
const loading = ref(false);
const search = ref("");
const showCreateDialog = ref(false);

const form = reactive({
  accountCode: "",
  displayName: "",
  primaryStateCode: "VA",
  primaryEmail: "",
  primaryPhone: "",
});

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  try {
    const [insuredList, refData] = await Promise.all([
      loadAgencyInsureds(session.token),
      loadAgencyReferenceData(session.token),
    ]);
    insureds.value = insuredList;
    referenceData.value = refData;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load insureds.";
  }
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";
  workflowMessage.value = "";

  try {
    await createAgencyInsured(session.token, {
      accountCode: form.accountCode,
      displayName: form.displayName,
      primaryStateCode: form.primaryStateCode,
      primaryEmail: form.primaryEmail,
      primaryPhone: form.primaryPhone,
      contacts: [
        {
          firstName: form.displayName.split(" ")[0],
          lastName: form.displayName.split(" ").slice(1).join(" ") || "Contact",
          email: form.primaryEmail,
          phone: form.primaryPhone,
          isPrimary: true,
        },
      ],
    });
    workflowMessage.value = `Created insured ${form.accountCode}.`;
    showCreateDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to create insured.";
  } finally {
    loading.value = false;
  }
}

const filteredInsureds = computed(() => {
  const items = insureds.value?.items ?? [];
  const query = search.value.trim().toLowerCase();
  if (!query) return items;
  return items.filter((insured) =>
    [insured.accountCode, insured.displayName, insured.primaryEmail ?? "", insured.primaryPhone ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
});

function openInsured(insuredId: string) {
  router.push(`/agency/insureds/${insuredId}`);
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
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Insureds</h1>
        <p class="text-muted text-sm mt-1">Customer accounts</p>
      </div>
      <Button label="New Insured" icon="pi pi-plus" @click="showCreateDialog = true" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="workflowMessage" severity="success" :closable="false" class="mb-4">{{ workflowMessage }}</Message>

    <Card>
      <template #content>
        <div class="flex items-center gap-3 mb-4">
          <span class="p-input-icon-left flex-1">
            <InputText v-model="search" placeholder="Search by name, code, email, or phone..." class="w-full" />
          </span>
        </div>

        <DataTable
          :value="filteredInsureds"
          :rows="20"
          :paginator="filteredInsureds.length > 20"
          stripedRows
          selectionMode="single"
          @rowSelect="(e: any) => openInsured(e.data.id)"
          scrollable
          scrollHeight="calc(100vh - 22rem)"
          class="cursor-pointer text-sm"
        >
          <Column field="accountCode" header="Code" sortable style="width: 120px" />
          <Column field="displayName" header="Name" sortable />
          <Column field="primaryEmail" header="Email">
            <template #body="{ data }">{{ data.primaryEmail ?? "—" }}</template>
          </Column>
          <Column field="primaryPhone" header="Phone">
            <template #body="{ data }">{{ data.primaryPhone ?? "—" }}</template>
          </Column>
          <Column header="Policies">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag v-for="policy in data.policies" :key="policy.id" :value="`${policy.policyTypeName}`" severity="info" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreateDialog" header="New Insured" :modal="true" :style="{ width: '480px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Account Code</label>
          <InputText v-model="form.accountCode" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Display Name</label>
          <InputText v-model="form.displayName" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Email</label>
          <InputText v-model="form.primaryEmail" type="email" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Phone</label>
          <InputText v-model="form.primaryPhone" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">State</label>
          <Select
            v-model="form.primaryStateCode"
            :options="referenceData?.states ?? []"
            optionLabel="name"
            optionValue="code"
            placeholder="Select state"
            class="w-full"
          />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showCreateDialog = false" />
          <Button type="submit" label="Create" icon="pi pi-check" :loading="loading" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
