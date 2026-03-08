<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";
import Message from "primevue/message";
import Button from "primevue/button";
import Dialog from "primevue/dialog";

import Select from "primevue/select";

import { loadStaffAgencies, createStaffAgency, type StaffAgencyList } from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const agencies = ref<StaffAgencyList | null>(null);
const search = ref("");

const showAddDialog = ref(false);
const submitting = ref(false);
const newAgency = ref({
  name: "",
  slug: "",
  adminEmail: "",
  adminFirstName: "",
  adminLastName: "",
  planTier: "STANDARD",
});

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.agencies.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    agencies.value = await loadStaffAgencies(session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load agencies.";
  }
}

async function handleCreateAgency() {
  const session = sessionState.session;
  if (!session) return;

  submitting.value = true;
  errorMessage.value = "";
  try {
    await createStaffAgency(session.token, newAgency.value);
    showAddDialog.value = false;
    await loadPage();
    // Reset form
    newAgency.value = {
      name: "",
      slug: "",
      adminEmail: "",
      adminFirstName: "",
      adminLastName: "",
      planTier: "STANDARD",
    };
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Failed to create agency.";
  } finally {
    submitting.value = false;
  }
}

function updateSlug() {
  if (!newAgency.value.slug && newAgency.value.name) {
    newAgency.value.slug = newAgency.value.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

function openAgency(agencyId: string) {
  router.push(`/staff/agencies/${agencyId}`);
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Agencies</h1>
        <p class="text-muted text-sm mt-1">Subscribed agency accounts</p>
      </div>
      <Button v-if="hasPermission('staff.agencies.manage')" label="Add Agency" icon="pi pi-plus" @click="showAddDialog = true" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <Card>
      <template #content>
        <div class="mb-4">
          <InputText v-model="search" placeholder="Search agencies..." class="w-full" />
        </div>

        <DataTable
          :value="agencies?.items ?? []"
          :rows="20"
          :paginator="(agencies?.items ?? []).length > 20"
          scrollable
          scrollHeight="calc(100vh - 21rem)"
          stripedRows
          selectionMode="single"
          @rowSelect="(e: any) => openAgency(e.data.id)"
          class="cursor-pointer"
          :globalFilterFields="['name', 'slug', 'primaryEmail']"
          :globalFilter="search"
          filterDisplay="menu"
        >
          <Column field="name" header="Agency" sortable />
          <Column field="slug" header="Slug" sortable />
          <Column field="status" header="Status" sortable>
            <template #body="{ data }">
              <Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column field="planTier" header="Plan" sortable>
            <template #body="{ data }">
              <Tag :value="data.planTier" :severity="data.planTier === 'STANDARD_AI' ? 'info' : 'secondary'" />
            </template>
          </Column>
          <Column header="Insureds" style="width: 90px">
            <template #body="{ data }">{{ data.counts.insuredAccounts }}</template>
          </Column>
          <Column header="Policies" style="width: 90px">
            <template #body="{ data }">{{ data.counts.policies }}</template>
          </Column>
          <Column header="Users" style="width: 80px">
            <template #body="{ data }">{{ data.counts.memberships }}</template>
          </Column>
          <Column header="Features" style="width: 100px">
            <template #body="{ data }">
              {{ data.featureFlags.filter((f: any) => f.enabled).length }} / {{ data.featureFlags.length }}
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showAddDialog" modal header="Add New Agency" :style="{ width: '500px' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="name" class="text-sm font-medium">Agency Name</label>
          <InputText id="name" v-model="newAgency.name" @blur="updateSlug" placeholder="e.g. Blue Ridge Insurance" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="slug" class="text-sm font-medium">Agency Slug</label>
          <InputText id="slug" v-model="newAgency.slug" placeholder="e.g. blue-ridge-insurance" />
        </div>
        
        <hr class="border-surface-border my-2" />
        
        <div class="font-medium text-sm">Initial Admin User</div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label for="firstName" class="text-xs text-muted">First Name</label>
            <InputText id="firstName" v-model="newAgency.adminFirstName" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="lastName" class="text-xs text-muted">Last Name</label>
            <InputText id="lastName" v-model="newAgency.adminLastName" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label for="email" class="text-xs text-muted">Email Address</label>
          <InputText id="email" v-model="newAgency.adminEmail" />
        </div>

        <hr class="border-surface-border my-2" />

        <div class="flex flex-col gap-1">
          <label for="planTier" class="text-sm font-medium">Plan Tier</label>
          <Select
            id="planTier"
            v-model="newAgency.planTier"
            :options="[
              { label: 'Standard', value: 'STANDARD' },
              { label: 'Standard + AI', value: 'STANDARD_AI' }
            ]"
            optionLabel="label"
            optionValue="value"
          />
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <Button label="Cancel" severity="secondary" @click="showAddDialog = false" />
          <Button label="Create Agency" :loading="submitting" @click="handleCreateAgency" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
