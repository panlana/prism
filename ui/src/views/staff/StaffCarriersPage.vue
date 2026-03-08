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

import { loadStaffCarriers, createStaffCarrier, type StaffCarrier } from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const carriers = ref<StaffCarrier[]>([]);
const showDialog = ref(false);

const form = reactive({
  name: "",
  slug: "",
  naicCode: "",
});

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.carriers.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const result = await loadStaffCarriers(session.token);
    carriers.value = result.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load carriers.";
  }
}

function openCarrier(carrierId: string) {
  router.push(`/staff/carriers/${carrierId}`);
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    await createStaffCarrier(session.token, {
      name: form.name,
      slug: form.slug,
      naicCode: form.naicCode || undefined,
    });
    successMessage.value = `Created carrier ${form.name}.`;
    showDialog.value = false;
    form.name = "";
    form.slug = "";
    form.naicCode = "";
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to create carrier.";
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
        <h1 class="text-2xl font-bold">Carriers</h1>
        <p class="text-muted text-sm mt-1">Insurance carrier library</p>
      </div>
      <Button v-if="hasPermission('staff.carriers.manage')" label="New Carrier" icon="pi pi-plus" @click="showDialog = true" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <Card>
      <template #content>
        <DataTable
          :value="carriers"
          scrollable
          scrollHeight="calc(100vh - 18rem)"
          stripedRows
          selectionMode="single"
          @rowSelect="(e: any) => openCarrier(e.data.id)"
          class="cursor-pointer"
        >
          <Column field="name" header="Name" sortable />
          <Column field="slug" header="Slug" sortable />
          <Column field="naicCode" header="NAIC Code">
            <template #body="{ data }">{{ data.naicCode ?? "—" }}</template>
          </Column>
          <Column header="Offerings" style="width: 100px">
            <template #body="{ data }">{{ data.offeringCount }}</template>
          </Column>
          <Column field="isActive" header="Active" style="width: 80px">
            <template #body="{ data }">
              <Tag :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" header="New Carrier" :modal="true" :style="{ width: '420px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="form.name" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Slug</label>
          <InputText v-model="form.slug" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">NAIC Code</label>
          <InputText v-model="form.naicCode" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
          <Button type="submit" label="Create" icon="pi pi-check" :loading="loading" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
