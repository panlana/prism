<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";
import Tag from "primevue/tag";
import Message from "primevue/message";

import {
  loadStaffRoles,
  createStaffRole,
  updateStaffRole,
  loadStaffPermissions,
  type StaffRole,
  type StaffPermission,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const roles = ref<StaffRole[]>([]);
const allPermissions = ref<StaffPermission[]>([]);
const showDialog = ref(false);
const editingId = ref<string | null>(null);

const scopeFilterOptions = [
  { label: "Staff", value: "STAFF" },
  { label: "Agency", value: "AGENCY" },
  { label: "Insured", value: "INSURED" },
];
const activeScopes = ref(["STAFF", "AGENCY"]);
const searchQuery = ref("");

const filteredRoles = computed(() => {
  let result = roles.value;

  if (activeScopes.value.length === 0) {
    result = [];
  } else {
    result = result.filter((r) => activeScopes.value.includes(r.scope));
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((r) =>
      r.key.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
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
  scope: "AGENCY" as string,
  permissionIds: [] as string[],
});

function resetForm() {
  form.key = "";
  form.name = "";
  form.scope = "AGENCY";
  form.permissionIds = [];
  editingId.value = null;
}

const scopePermissions = computed(() =>
  allPermissions.value.filter((p) => p.scope === form.scope)
);

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
    const [rolesResult, permissionsResult] = await Promise.all([
      loadStaffRoles(session.token),
      loadStaffPermissions(session.token),
    ]);
    roles.value = rolesResult.items;
    allPermissions.value = permissionsResult.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load roles.";
  }
}

function openCreate() {
  resetForm();
  showDialog.value = true;
}

function openEdit(role: StaffRole) {
  editingId.value = role.id;
  form.key = role.key;
  form.name = role.name;
  form.scope = role.scope;
  form.permissionIds = role.permissions.map((p) => p.id);
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    if (editingId.value) {
      await updateStaffRole(session.token, editingId.value, {
        name: form.name,
        permissionIds: form.permissionIds,
      });
      successMessage.value = "Role updated.";
    } else {
      await createStaffRole(session.token, {
        key: form.key,
        name: form.name,
        scope: form.scope,
        permissionIds: form.permissionIds,
      });
      successMessage.value = "Role created.";
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
        <h1 class="text-2xl font-bold">Roles</h1>
        <p class="text-muted text-sm mt-1">Manage roles and their permission assignments</p>
      </div>
      <Button v-if="hasPermission('staff.rbac.manage')" label="New Role" icon="pi pi-plus" @click="openCreate" />
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
        <InputText v-model="searchQuery" placeholder="Search roles..." class="w-full" />
      </div>
    </div>

    <Card>
      <template #content>
        <DataTable :value="filteredRoles" scrollable scrollHeight="calc(100vh - 21rem)" stripedRows>
          <Column field="key" header="Key" sortable>
            <template #body="{ data }">
              <span class="font-mono text-sm">{{ data.key }}</span>
            </template>
          </Column>
          <Column field="name" header="Name" sortable />
          <Column field="scope" header="Scope" sortable style="width: 100px">
            <template #body="{ data }">
              <Tag :value="data.scope" :severity="scopeSeverity(data.scope)" />
            </template>
          </Column>
          <Column header="Permissions" style="width: 120px; text-align: center" headerStyle="justify-content: center">
            <template #body="{ data }">
              <span class="font-medium">{{ data.permissions.length }}</span>
            </template>
          </Column>
          <Column field="assignmentCount" header="Users" sortable style="width: 80px; text-align: center" headerStyle="justify-content: center">
            <template #body="{ data }">
              <span class="font-medium">{{ data.assignmentCount }}</span>
            </template>
          </Column>
          <Column header="" style="width: 100px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button v-if="hasPermission('staff.rbac.manage')" icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
                <Tag v-if="data.isSystem" value="system" severity="warn" class="ml-1" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" :header="editingId ? 'Edit Role' : 'New Role'" :modal="true" :style="{ width: '560px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Key</label>
            <InputText v-model="form.key" class="w-full font-mono" :disabled="!!editingId" placeholder="producer" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="form.name" class="w-full" placeholder="Producer" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Scope</label>
          <Select v-model="form.scope" :options="scopeOptions" optionLabel="label" optionValue="value" class="w-full" :disabled="!!editingId" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Permissions</label>
          <div v-if="scopePermissions.length === 0" class="text-sm text-muted py-2">
            No permissions defined for scope {{ form.scope }}.
          </div>
          <div v-else class="flex flex-col gap-2 py-1 max-h-64 overflow-y-auto">
            <label v-for="perm in scopePermissions" :key="perm.id" class="flex items-center gap-2 cursor-pointer">
              <Checkbox v-model="form.permissionIds" :value="perm.id" />
              <span class="font-mono text-sm">{{ perm.key }}</span>
              <span class="text-muted text-xs">{{ perm.name }}</span>
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
          <Button type="submit" :label="editingId ? 'Update' : 'Create'" icon="pi pi-check" :loading="loading" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
