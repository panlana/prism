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
import Tag from "primevue/tag";
import ToggleSwitch from "primevue/toggleswitch";
import Message from "primevue/message";

import {
  loadStaffUsers,
  createStaffUser,
  updateStaffUser,
  loadStaffRoles,
  type StaffUser,
  type StaffRole,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const users = ref<StaffUser[]>([]);
const staffRoles = ref<StaffRole[]>([]);
const showDialog = ref(false);
const editingId = ref<string | null>(null);
const canManage = computed(() => hasPermission("staff.users.manage"));

const form = reactive({
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  isActive: true,
  roleIds: [] as string[],
});

function resetForm() {
  form.email = "";
  form.firstName = "";
  form.lastName = "";
  form.password = "";
  form.isActive = true;
  form.roleIds = [];
  editingId.value = null;
}

const availableRoles = computed(() =>
  staffRoles.value.filter((r) => r.scope === "STAFF")
);

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  try {
    const [usersResult, rolesResult] = await Promise.all([
      loadStaffUsers(session.token),
      loadStaffRoles(session.token),
    ]);
    users.value = usersResult.items;
    staffRoles.value = rolesResult.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load staff users.";
  }
}

function openCreate() {
  resetForm();
  showDialog.value = true;
}

function openEdit(user: StaffUser) {
  editingId.value = user.id;
  form.email = user.email;
  form.firstName = user.firstName ?? "";
  form.lastName = user.lastName ?? "";
  form.password = "";
  form.isActive = user.isActive;
  form.roleIds = user.roles.map((r) => r.id);
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    if (editingId.value) {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        isActive: form.isActive,
        roleIds: form.roleIds,
      };
      if (form.password) {
        body.password = form.password;
      }
      await updateStaffUser(session.token, editingId.value, body);
      successMessage.value = "Staff user updated.";
    } else {
      await createStaffUser(session.token, {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
        roleIds: form.roleIds,
      });
      successMessage.value = "Staff user created.";
    }

    showDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save.";
  } finally {
    loading.value = false;
  }
}

async function toggleActive(user: StaffUser) {
  const session = sessionState.session;
  if (!session) return;

  try {
    await updateStaffUser(session.token, user.id, { isActive: !user.isActive });
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update.";
  }
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Staff Users</h1>
        <p class="text-muted text-sm mt-1">Manage PRISM admin portal users and their role assignments</p>
      </div>
      <Button v-if="canManage" label="New Staff User" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <Card>
      <template #content>
        <DataTable :value="users" scrollable scrollHeight="calc(100vh - 18rem)" stripedRows>
          <Column field="email" header="Email" sortable>
            <template #body="{ data }">
              <span class="font-mono text-sm">{{ data.email }}</span>
            </template>
          </Column>
          <Column header="Name" sortable>
            <template #body="{ data }">
              {{ [data.firstName, data.lastName].filter(Boolean).join(" ") || "—" }}
            </template>
          </Column>
          <Column header="Roles">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag v-for="r in data.roles" :key="r.id" :value="r.name" severity="info" />
                <span v-if="!data.roles.length" class="text-sm text-muted">None</span>
              </div>
            </template>
          </Column>
          <Column field="isActive" header="Active" style="width: 80px">
            <template #body="{ data }">
              <ToggleSwitch v-if="canManage" :modelValue="data.isActive" @update:modelValue="toggleActive(data)" />
              <Tag v-else :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column v-if="canManage" header="" style="width: 60px">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" :header="editingId ? 'Edit Staff User' : 'New Staff User'" :modal="true" :style="{ width: '520px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Email</label>
          <InputText v-model="form.email" class="w-full" type="email" :disabled="!!editingId" placeholder="user@prism.dev" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">First Name</label>
            <InputText v-model="form.firstName" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Last Name</label>
            <InputText v-model="form.lastName" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ editingId ? "New Password (leave blank to keep)" : "Password" }}</label>
          <InputText v-model="form.password" class="w-full" type="password" :placeholder="editingId ? '••••••••' : 'Min 8 characters'" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Roles</label>
          <div v-if="availableRoles.length === 0" class="text-sm text-muted py-2">No staff roles defined.</div>
          <div v-else class="flex flex-col gap-2 py-1">
            <label v-for="role in availableRoles" :key="role.id" class="flex items-center gap-2 cursor-pointer">
              <Checkbox v-model="form.roleIds" :value="role.id" />
              <span class="text-sm font-medium">{{ role.name }}</span>
              <span class="text-xs text-muted">({{ role.permissions.length }} permissions)</span>
            </label>
          </div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div v-if="editingId" class="flex items-center gap-2">
            <ToggleSwitch v-model="form.isActive" />
            <span class="text-sm">Active</span>
          </div>
          <div v-else />
          <div class="flex gap-2">
            <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
            <Button type="submit" :label="editingId ? 'Update' : 'Create'" icon="pi pi-check" :loading="loading" />
          </div>
        </div>
      </form>
    </Dialog>
  </div>
</template>
