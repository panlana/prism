<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Tag from "primevue/tag";
import Message from "primevue/message";

import {
  loadStaffPolicyTypes,
  createStaffPolicyType,
  updateStaffPolicyType,
  type StaffPolicyType,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const items = ref<StaffPolicyType[]>([]);
const showDialog = ref(false);
const editingId = ref<string | null>(null);

const form = reactive({
  code: "",
  name: "",
  lineOfBusiness: "",
  isActive: true,
});

function resetForm() {
  form.code = "";
  form.name = "";
  form.lineOfBusiness = "";
  form.isActive = true;
  editingId.value = null;
}

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.coverage.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const result = await loadStaffPolicyTypes(session.token);
    items.value = result.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load policy types.";
  }
}

function openCreate() {
  resetForm();
  showDialog.value = true;
}

function openEdit(item: StaffPolicyType) {
  editingId.value = item.id;
  form.code = item.code;
  form.name = item.name;
  form.lineOfBusiness = item.lineOfBusiness ?? "";
  form.isActive = item.isActive;
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    if (editingId.value) {
      await updateStaffPolicyType(session.token, editingId.value, {
        name: form.name,
        lineOfBusiness: form.lineOfBusiness || undefined,
        isActive: form.isActive,
      });
      successMessage.value = "Policy type updated.";
    } else {
      await createStaffPolicyType(session.token, {
        code: form.code,
        name: form.name,
        lineOfBusiness: form.lineOfBusiness || undefined,
      });
      successMessage.value = `Created policy type ${form.code}.`;
    }

    showDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Policy Types</h1>
        <p class="text-muted text-sm mt-1">Lines of business catalog</p>
      </div>
      <Button v-if="hasPermission('staff.coverage.manage')" label="New Policy Type" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <Card>
      <template #content>
        <DataTable :value="items" scrollable scrollHeight="calc(100vh - 18rem)" stripedRows>
          <Column field="code" header="Code" sortable />
          <Column field="name" header="Name" sortable />
          <Column field="lineOfBusiness" header="Line of Business">
            <template #body="{ data }">{{ data.lineOfBusiness ?? "—" }}</template>
          </Column>
          <Column header="Coverages" style="width: 100px">
            <template #body="{ data }">{{ data.coverageDefinitionCount }}</template>
          </Column>
          <Column header="Offerings" style="width: 100px">
            <template #body="{ data }">{{ data.offeringCount }}</template>
          </Column>
          <Column field="isActive" header="Active" style="width: 80px">
            <template #body="{ data }">
              <Tag :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column v-if="hasPermission('staff.coverage.manage')" header="Actions" style="width: 80px">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" :header="editingId ? 'Edit Policy Type' : 'New Policy Type'" :modal="true" :style="{ width: '420px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Code</label>
          <InputText v-model="form.code" class="w-full" :disabled="!!editingId" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="form.name" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Line of Business</label>
          <InputText v-model="form.lineOfBusiness" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
          <Button type="submit" :label="editingId ? 'Update' : 'Create'" icon="pi pi-check" :loading="loading" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
