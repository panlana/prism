<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import MultiSelect from "primevue/multiselect";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import ToggleSwitch from "primevue/toggleswitch";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";

import {
  loadStaffContextBlocks,
  createStaffContextBlock,
  updateStaffContextBlock,
  deleteStaffContextBlock,
  loadStaffFeatureFlags,
  type StaffContextBlock,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const items = ref<StaffContextBlock[]>([]);
const showDialog = ref(false);
const editingId = ref<string | null>(null);
const flagOptions = ref<Array<{ label: string; value: string }>>([]);
const agentFilter = ref<Set<string>>(new Set());

function toggleAgentFilter(agent: string) {
  const next = new Set(agentFilter.value);
  if (next.has(agent)) next.delete(agent);
  else next.add(agent);
  agentFilter.value = next;
}

const filteredItems = computed(() => {
  if (agentFilter.value.size === 0) return items.value;
  return items.value.filter((item) =>
    item.agents.some((a) => agentFilter.value.has(a))
  );
});

const typeOptions = [
  { label: "Static", value: "STATIC" },
  { label: "Template", value: "TEMPLATE" },
  { label: "Query Template", value: "QUERY_TEMPLATE" },
];

const scopeOptions = [
  { label: "Global", value: "GLOBAL" },
  { label: "Agency", value: "AGENCY" },
  { label: "Policy Type", value: "POLICY_TYPE" },
  { label: "Carrier Offering", value: "CARRIER_OFFERING" },
];

const agentOptions = [
  { label: "Insured Review", value: "insured_review" },
  { label: "Agency Assistant", value: "agency_assistant" },
];

const planTierOptions = [
  { label: "Standard", value: "STANDARD" },
  { label: "Standard + AI", value: "STANDARD_AI" },
];

const userTypeOptions = [
  { label: "Staff", value: "STAFF" },
  { label: "Agency", value: "AGENCY" },
  { label: "Insured", value: "INSURED" },
];

const form = reactive({
  key: "",
  name: "",
  type: "STATIC",
  scope: "GLOBAL",
  content: "",
  resolverKey: "",
  sortOrder: 100,
  isActive: true,
  agents: [] as string[],
  requiredFeatureFlag: null as string | null,
  allowedUserTypes: [] as string[],
  requiredPlanTier: null as string | null,
});

function resetForm() {
  form.key = "";
  form.name = "";
  form.type = "STATIC";
  form.scope = "GLOBAL";
  form.content = "";
  form.resolverKey = "";
  form.sortOrder = 100;
  form.isActive = true;
  form.agents = [];
  form.requiredFeatureFlag = null;
  form.allowedUserTypes = [];
  form.requiredPlanTier = null;
  editingId.value = null;
}

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.ai.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const [blocksResult, flagsResult] = await Promise.all([
      loadStaffContextBlocks(session.token),
      loadStaffFeatureFlags(session.token),
    ]);
    items.value = blocksResult.items;
    flagOptions.value = flagsResult.items.map((f) => ({ label: f.key, value: f.key }));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load context blocks.";
  }
}

function openCreate() {
  resetForm();
  showDialog.value = true;
}

function openEdit(item: StaffContextBlock) {
  editingId.value = item.id;
  form.key = item.key;
  form.name = item.name;
  form.type = item.type;
  form.scope = item.scope;
  form.content = item.content;
  form.resolverKey = item.resolverKey ?? "";
  form.sortOrder = item.sortOrder;
  form.isActive = item.isActive;
  form.agents = [...item.agents];
  form.requiredFeatureFlag = item.requiredFeatureFlag ?? null;
  form.allowedUserTypes = [...item.allowedUserTypes];
  form.requiredPlanTier = item.requiredPlanTier ?? null;
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    const body = {
      key: form.key,
      name: form.name,
      type: form.type,
      scope: form.scope,
      content: form.content,
      resolverKey: form.resolverKey || undefined,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
      agents: form.agents,
      requiredFeatureFlag: form.requiredFeatureFlag,
      allowedUserTypes: form.allowedUserTypes,
      requiredPlanTier: form.requiredPlanTier,
    };

    if (editingId.value) {
      await updateStaffContextBlock(session.token, editingId.value, body);
      successMessage.value = "Context block updated.";
    } else {
      await createStaffContextBlock(session.token, body);
      successMessage.value = "Context block created.";
    }

    showDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save.";
  } finally {
    loading.value = false;
  }
}

async function remove(id: string) {
  const session = sessionState.session;
  if (!session) return;

  try {
    await deleteStaffContextBlock(session.token, id);
    successMessage.value = "Context block deleted.";
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to delete.";
  }
}

function scopeSeverity(scope: string) {
  const map: Record<string, string> = {
    GLOBAL: "info",
    AGENCY: "warn",
    POLICY_TYPE: "success",
    CARRIER_OFFERING: "secondary",
  };
  return (map[scope] ?? "secondary") as "info" | "warn" | "success" | "secondary";
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Context Blocks</h1>
        <p class="text-muted text-sm mt-1">AI prompt assembly configuration</p>
      </div>
      <Button v-if="hasPermission('staff.ai.manage')" label="New Block" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <div class="mb-4 flex items-center gap-2">
      <span class="text-sm font-medium text-muted">Agent:</span>
      <button
        v-for="opt in agentOptions"
        :key="opt.value"
        :class="['px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-colors', agentFilter.has(opt.value) ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-transparent border-border text-muted hover:bg-surface-hover']"
        @click="toggleAgentFilter(opt.value)"
      >{{ opt.label }}</button>
    </div>

    <Card>
      <template #content>
        <DataTable
          :value="filteredItems"
          :rows="20"
          :paginator="filteredItems.length > 20"
          scrollable
          scrollHeight="calc(100vh - 22rem)"
          stripedRows
          class="text-sm"
        >
          <Column header="Block" sortable sortField="name">
            <template #body="{ data }">
              <div class="flex flex-col">
                <span class="font-bold">{{ data.name }}</span>
                <span class="text-xs text-muted font-mono leading-tight mt-0.5">{{ data.key }}</span>
              </div>
            </template>
          </Column>
          <Column field="type" header="Type" sortable style="width: 120px">
            <template #body="{ data }">
              <Tag :value="data.type" severity="secondary" />
            </template>
          </Column>
          <Column field="scope" header="Scope" sortable>
            <template #body="{ data }">
              <Tag :value="data.scope" :severity="scopeSeverity(data.scope)" />
            </template>
          </Column>
          <Column field="agents" header="Agents">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag v-for="a in data.agents" :key="a" :value="a" severity="info" />
              </div>
            </template>
          </Column>
          <Column field="sortOrder" header="Order" sortable style="width: 80px" />
          <Column field="isActive" header="Active" style="width: 80px">
            <template #body="{ data }">
              <Tag :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column header="Gating">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag v-if="data.requiredFeatureFlag" :value="data.requiredFeatureFlag" severity="warn" />
                <Tag v-if="data.requiredPlanTier" :value="data.requiredPlanTier" severity="info" />
                <Tag v-for="ut in data.allowedUserTypes" :key="ut" :value="ut" severity="secondary" />
              </div>
            </template>
          </Column>
          <Column v-if="hasPermission('staff.ai.manage')" header="Actions" style="width: 120px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
                <Button icon="pi pi-trash" size="small" severity="danger" text @click="remove(data.id)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" :header="editingId ? 'Edit Context Block' : 'New Context Block'" :modal="true" :style="{ width: '640px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Key</label>
            <InputText v-model="form.key" class="w-full" :disabled="!!editingId" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="form.name" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Type</label>
            <Select v-model="form.type" :options="typeOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Scope</label>
            <Select v-model="form.scope" :options="scopeOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Sort Order</label>
            <InputNumber v-model="form.sortOrder" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Content</label>
          <Textarea v-model="form.content" rows="6" class="w-full font-mono text-xs" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Resolver Key</label>
            <InputText v-model="form.resolverKey" class="w-full" placeholder="Only for QUERY_TEMPLATE type" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Agents</label>
            <MultiSelect v-model="form.agents" :options="agentOptions" optionLabel="label" optionValue="value" placeholder="All agents" display="chip" class="w-full" />
          </div>
        </div>
        <div class="text-xs font-semibold text-muted uppercase tracking-wider pt-2">Gating</div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Feature Flag</label>
            <Select v-model="form.requiredFeatureFlag" :options="flagOptions" optionLabel="label" optionValue="value" placeholder="None" showClear class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">User Types</label>
            <MultiSelect v-model="form.allowedUserTypes" :options="userTypeOptions" optionLabel="label" optionValue="value" placeholder="All" display="chip" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Plan Tier</label>
            <Select v-model="form.requiredPlanTier" :options="planTierOptions" optionLabel="label" optionValue="value" placeholder="None" showClear class="w-full" />
          </div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="form.isActive" />
            <span class="text-sm">Active</span>
          </div>
          <div class="flex gap-2">
            <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
            <Button type="submit" :label="editingId ? 'Update' : 'Create'" icon="pi pi-check" :loading="loading" />
          </div>
        </div>
      </form>
    </Dialog>
  </div>
</template>
