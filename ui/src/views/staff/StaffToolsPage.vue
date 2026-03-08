<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
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
import { computed } from "vue";

import JsonEditor from "../../components/JsonEditor.vue";
import {
  loadStaffTools,
  updateStaffTool,
  loadStaffPermissions,
  loadStaffFeatureFlags,
  type StaffToolDefinition,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const agentOptions = [
  { label: "Insured Review", value: "insured_review" },
  { label: "Agency Assistant", value: "agency_assistant" },
];

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const items = ref<StaffToolDefinition[]>([]);
const permissionOptions = ref<Array<{ label: string; value: string }>>([]);
const flagOptions = ref<Array<{ label: string; value: string }>>([]);
const searchQuery = ref("");
const agentFilter = ref<Set<string>>(new Set());
const showDialog = ref(false);
const editingId = ref<string | null>(null);
const editingKey = ref("");

function toggleAgentFilter(agent: string) {
  const next = new Set(agentFilter.value);
  if (next.has(agent)) next.delete(agent);
  else next.add(agent);
  agentFilter.value = next;
}

const filteredItems = computed(() => {
  let result = items.value;
  if (agentFilter.value.size > 0) {
    result = result.filter((item) =>
      item.agents.some((a) => agentFilter.value.has(a))
    );
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }
  return result;
});

const form = reactive({
  name: "",
  description: "",
  parameters: "",
  agents: [] as string[],
  screens: "",
  requiredFlags: [] as string[],
  requiredPermission: null as string | null,
  sortOrder: 0,
  isActive: true,
});

function resetForm() {
  form.name = "";
  form.description = "";
  form.parameters = "";
  form.agents = [];
  form.screens = "";
  form.requiredFlags = [];
  form.requiredPermission = null;
  form.sortOrder = 0;
  form.isActive = true;
  editingId.value = null;
  editingKey.value = "";
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
    const [toolsResult, permsResult, flagsResult] = await Promise.all([
      loadStaffTools(session.token),
      loadStaffPermissions(session.token),
      loadStaffFeatureFlags(session.token),
    ]);
    items.value = toolsResult.items;
    permissionOptions.value = permsResult.items.map((p) => ({ label: p.key, value: p.key }));
    flagOptions.value = flagsResult.items.map((f) => ({ label: f.key, value: f.key }));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load tools.";
  }
}

function openEdit(item: StaffToolDefinition) {
  editingId.value = item.id;
  editingKey.value = item.key;
  form.name = item.name;
  form.description = item.description;
  form.parameters = JSON.stringify(item.parameters, null, 2);
  form.agents = [...item.agents];
  form.screens = item.screens.join(", ");
  form.requiredFlags = [...item.requiredFlags];
  form.requiredPermission = item.requiredPermission ?? null;
  form.sortOrder = item.sortOrder;
  form.isActive = item.isActive;
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session || !editingId.value) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    let parameters: Record<string, unknown>;
    try {
      parameters = JSON.parse(form.parameters);
    } catch {
      errorMessage.value = "Parameters must be valid JSON.";
      loading.value = false;
      return;
    }

    const body = {
      name: form.name,
      description: form.description,
      parameters,
      agents: form.agents,
      screens: form.screens ? form.screens.split(",").map((s) => s.trim()).filter(Boolean) : [],
      requiredFlags: form.requiredFlags,
      requiredPermission: form.requiredPermission,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };

    await updateStaffTool(session.token, editingId.value, body);
    successMessage.value = "Tool definition updated.";
    showDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save.";
  } finally {
    loading.value = false;
  }
}

async function toggleActive(item: StaffToolDefinition) {
  const session = sessionState.session;
  if (!session) return;

  try {
    await updateStaffTool(session.token, item.id, { isActive: !item.isActive });
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update.";
  }
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">AI Tools</h1>
      <p class="text-muted text-sm mt-1">Manage tool definitions available to AI agents</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <div class="mb-4 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted">Agent:</span>
        <button
          v-for="opt in agentOptions"
          :key="opt.value"
          :class="['px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-colors', agentFilter.has(opt.value) ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-transparent border-border text-muted hover:bg-surface-hover']"
          @click="toggleAgentFilter(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted">Search:</span>
        <InputText v-model="searchQuery" placeholder="Search tools..." class="w-full max-w-md" />
      </div>
    </div>

    <Card>
      <template #content>
        <DataTable :value="filteredItems" :rows="20" :paginator="filteredItems.length > 20" scrollable scrollHeight="calc(100vh - 21rem)" stripedRows>
          <Column field="key" header="Key" sortable style="width: 180px">
            <template #body="{ data }">
              <span class="font-mono text-sm font-semibold">{{ data.key }}</span>
            </template>
          </Column>
          <Column header="Tool" sortable sortField="name">
            <template #body="{ data }">
              <div class="flex flex-col">
                <span class="font-bold text-sm">{{ data.name }}</span>
                <span class="text-xs text-muted leading-tight mt-0.5">{{ data.description }}</span>
              </div>
            </template>
          </Column>
          <Column header="Agents" style="width: 140px">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag v-for="a in data.agents" :key="a" :value="a" severity="info" />
              </div>
            </template>
          </Column>
          <Column header="Gating">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag v-if="data.requiredPermission" :value="data.requiredPermission" severity="success" />
                <Tag v-for="s in data.screens" :key="s" :value="s" severity="secondary" />
                <Tag v-for="f in data.requiredFlags" :key="f" :value="f" severity="warn" />
              </div>
            </template>
          </Column>
          <Column field="sortOrder" header="Order" sortable style="width: 80px" />
          <Column field="isActive" header="Active" style="width: 80px">
            <template #body="{ data }">
              <ToggleSwitch v-if="hasPermission('staff.ai.manage')" :modelValue="data.isActive" @update:modelValue="toggleActive(data)" />
              <Tag v-else :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column v-if="hasPermission('staff.ai.manage')" header="" style="width: 60px">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" header="Edit Tool Definition" :modal="true" :style="{ width: '720px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Key</label>
          <InputText :modelValue="editingKey" class="w-full font-mono" disabled />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="form.name" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Description</label>
          <Textarea v-model="form.description" rows="3" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Parameters (JSON Schema)</label>
          <JsonEditor v-model="form.parameters" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Agents</label>
          <MultiSelect v-model="form.agents" :options="agentOptions" optionLabel="label" optionValue="value" placeholder="All agents" display="chip" class="w-full" />
        </div>
        <div class="text-xs font-semibold text-muted uppercase tracking-wider pt-2">Gating</div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Permission</label>
            <Select v-model="form.requiredPermission" :options="permissionOptions" optionLabel="label" optionValue="value" placeholder="None" showClear class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Feature Flags</label>
            <MultiSelect v-model="form.requiredFlags" :options="flagOptions" optionLabel="label" optionValue="value" placeholder="None" display="chip" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Screens</label>
            <InputText v-model="form.screens" class="w-full" placeholder="Leave empty for all" />
          </div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <ToggleSwitch v-model="form.isActive" />
              <span class="text-sm">Active</span>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium">Order</label>
              <InputNumber v-model="form.sortOrder" class="w-24" />
            </div>
          </div>
          <div class="flex gap-2">
            <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
            <Button type="submit" label="Update" icon="pi pi-check" :loading="loading" />
          </div>
        </div>
      </form>
    </Dialog>
  </div>
</template>
