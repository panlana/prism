<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Message from "primevue/message";

import { loadStaffCarrierDetail, type StaffCarrierDetail } from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const route = useRoute();
const router = useRouter();
const errorMessage = ref("");
const detail = ref<StaffCarrierDetail | null>(null);

async function loadPage() {
  const session = sessionState.session;
  const carrierId = route.params.carrierId;

  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.carriers.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  if (typeof carrierId !== "string") {
    await router.push("/staff/carriers");
    return;
  }

  try {
    detail.value = await loadStaffCarrierDetail(session.token, carrierId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load carrier.";
  }
}

function openOffering(offeringId: string) {
  router.push(`/staff/offerings/${offeringId}`);
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="router.push('/staff/carriers')" />
      <div>
        <h1 class="text-2xl font-bold">{{ detail?.name ?? "Carrier" }}</h1>
        <p class="text-muted text-sm mt-0.5">{{ detail?.slug }} {{ detail?.naicCode ? `· NAIC ${detail.naicCode}` : '' }}</p>
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <div v-if="detail" class="border border-border rounded-xl bg-white overflow-hidden">
      <DataTable
        :value="detail.offerings"
        stripedRows
        selectionMode="single"
        @rowSelect="(e: any) => openOffering(e.data.id)"
        class="cursor-pointer"
      >
        <Column field="policyTypeName" header="Policy Type" sortable />
        <Column field="stateCode" header="State" sortable>
          <template #body="{ data }">{{ data.stateCode }} — {{ data.stateName }}</template>
        </Column>
        <Column header="Forms" style="width: 80px">
          <template #body="{ data }">{{ data.formCount }}</template>
        </Column>
        <Column field="isActive" header="Active" style="width: 80px">
          <template #body="{ data }">
            <Tag :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
