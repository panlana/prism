<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";
import Tag from "primevue/tag";
import Message from "primevue/message";

import {
  loadStaffPermissions,
  createStaffPermission,
  updateStaffPermission,
  type StaffPermission,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";
import { computed } from "vue";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const items = ref<StaffPermission[]>([]);
const showDialog = ref(false);
const editingId = ref<string | null>(null);

const scopeFilterOptions = [
  { label: "Staff", value: "STAFF" },
  { label: "Agency", value: "AGENCY" },
  { label: "Insured", value: "INSURED" },
];
const activeScopes = ref(["STAFF", "AGENCY"]);
const searchQuery = ref("");

const filteredItems = computed(() => {
  let result = items.value;
  
  if (activeScopes.value.length === 0) {
    result = [];
  } else {
    result = result.filter((p) => activeScopes.value.includes(p.scope));
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((p) => 
      p.key.toLowerCase().includes(q) || 
      p.name.toLowerCase().includes(q)
    );
  }

  return result;
});

const scopeOptions = [
  { label: "Staff", value: "STAFF" },
  { label: "Agency", value: "AGENCY" },
];

const form = reactive({
  key: "",
  name: "",
  description: "",
  scope: "AGENCY" as string,
});

function resetForm() {
  form.key = "";
  form.name = "";
  form.description = "";
  form.scope = "AGENCY";
  editingId.value = null;
}

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.rbac.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const result = await loadStaffPermissions(session.token);
    items.value = result.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load permissions.";
  }
}

function openCreate() {
  resetForm();
  showDialog.value = true;
}

function openEdit(item: StaffPermission) {
  editingId.value = item.id;
  form.key = item.key;
  form.name = item.name;
  form.description = item.description ?? "";
  form.scope = item.scope;
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    if (editingId.value) {
      await updateStaffPermission(session.token, editingId.value, {
        name: form.name,
        description: form.description || null,
      });
      successMessage.value = "Permission updated.";
    } else {
      await createStaffPermission(session.token, {
        key: form.key,
        name: form.name,
        description: form.description || undefined,
        scope: form.scope,
      });
      successMessage.value = "Permission created.";
    }

    showDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save.";
  } finally {
    loading.value = false;
  }
}

function scopeSeverity(scope: string) {
  return scope === "STAFF" ? "warn" : "info";
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Permissions</h1>
        <p class="text-muted text-sm mt-1">Permission keys used by roles and tool definitions</p>
      </div>
      <Button v-if="hasPermission('staff.rbac.manage')" label="New Permission" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <div class="mb-4 flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted">Scope Filter:</span>
        <SelectButton
          v-model="activeScopes"
          :options="scopeFilterOptions"
          optionLabel="label"
          optionValue="value"
          multiple
          aria-labelledby="multiple"
        />
      </div>
      <div class="flex items-center gap-2 flex-1 min-w-[300px]">
        <span class="text-sm font-medium text-muted">Search:</span>
        <InputText v-model="searchQuery" placeholder="Search permissions..." class="w-full" />
      </div>
    </div>

    <Card>
      <template #content>
        <DataTable :value="filteredItems" :rows="25" :paginator="filteredItems.length > 25" scrollable scrollHeight="calc(100vh - 21rem)" stripedRows>
          <Column field="key" header="Key" sortable>
            <template #body="{ data }">
              <span class="font-mono text-sm">{{ data.key }}</span>
            </template>
          </Column>
          <Column field="name" header="Name" sortable />
          <Column field="description" header="Description">
            <template #body="{ data }">
              <span class="text-sm text-muted">{{ data.description ?? "—" }}</span>
            </template>
          </Column>
          <Column field="scope" header="Scope" sortable style="width: 100px">
            <template #body="{ data }">
              <Tag :value="data.scope" :severity="scopeSeverity(data.scope)" />
            </template>
          </Column>
          <Column field="roleCount" header="Roles" sortable style="width: 80px">
            <template #body="{ data }">
              <span class="font-medium">{{ data.roleCount }}</span>
            </template>
          </Column>
          <Column v-if="hasPermission('staff.rbac.manage')" header="" style="width: 60px">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" :header="editingId ? 'Edit Permission' : 'New Permission'" :modal="true" :style="{ width: '480px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Key</label>
          <InputText v-model="form.key" class="w-full font-mono" :disabled="!!editingId" placeholder="insureds.manage" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="form.name" class="w-full" placeholder="Manage insureds and contacts" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Description</label>
          <InputText v-model="form.description" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Scope</label>
          <Select v-model="form.scope" :options="scopeOptions" optionLabel="label" optionValue="value" class="w-full" :disabled="!!editingId" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
          <Button type="submit" :label="editingId ? 'Update' : 'Create'" icon="pi pi-check" :loading="loading" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
