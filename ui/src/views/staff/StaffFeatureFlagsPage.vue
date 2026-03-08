<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Message from "primevue/message";

import { loadStaffFeatureFlags, type StaffFeatureFlag } from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const flags = ref<StaffFeatureFlag[]>([]);

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.flags.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const result = await loadStaffFeatureFlags(session.token);
    flags.value = result.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load feature flags.";
  }
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Feature Flags</h1>
      <p class="text-muted text-sm mt-1">Global feature flag definitions</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <Card>
      <template #content>
        <DataTable :value="flags" scrollable scrollHeight="calc(100vh - 18rem)" stripedRows>
          <Column field="key" header="Key" sortable />
          <Column field="name" header="Name" sortable />
          <Column field="description" header="Description">
            <template #body="{ data }">
              <span class="text-sm text-muted">{{ data.description ?? "—" }}</span>
            </template>
          </Column>
          <Column field="defaultEnabled" header="Default" style="width: 100px">
            <template #body="{ data }">
              <Tag :value="data.defaultEnabled ? 'Enabled' : 'Disabled'" :severity="data.defaultEnabled ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column field="enabledCount" header="Agencies Enabled" sortable style="width: 140px">
            <template #body="{ data }">
              <span class="font-medium">{{ data.enabledCount }}</span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
