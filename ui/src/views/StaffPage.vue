<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Message from "primevue/message";

import { getWithToken } from "../api";
import { sessionState } from "../session";

type StaffAgencies = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    planTier: string;
    hasInAppAi: boolean;
    counts: {
      insuredAccounts: number;
      policies: number;
      memberships: number;
    };
    featureFlags: Array<{
      key: string;
      enabled: boolean;
    }>;
  }>;
};

const router = useRouter();
const errorMessage = ref("");
const agencies = ref<StaffAgencies | null>(null);

async function loadPage() {
  if (sessionState.session?.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  try {
    agencies.value = await getWithToken<StaffAgencies>("/api/staff/agencies", sessionState.session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load admin data.";
  }
}

onMounted(loadPage);
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Agency Oversight</h1>
      <p class="text-muted text-sm mt-1">Subscribed agencies, counts, and feature entitlements</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <Card v-if="agencies">
      <template #content>
        <DataTable :value="agencies.items" :rows="20" :paginator="agencies.items.length > 20" stripedRows>
          <Column field="name" header="Agency" sortable />
          <Column field="slug" header="Slug" sortable />
          <Column field="status" header="Status">
            <template #body="{ data }">
              <Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column field="planTier" header="Plan" sortable>
            <template #body="{ data }">
              <Tag :value="data.planTier" severity="info" />
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
          <Column header="Features">
            <template #body="{ data }">
              <div class="flex gap-1 flex-wrap">
                <Tag
                  v-for="flag in data.featureFlags"
                  :key="flag.key"
                  :value="flag.key"
                  :severity="flag.enabled ? 'success' : 'secondary'"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
