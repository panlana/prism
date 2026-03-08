<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Message from "primevue/message";

import { loadAgencySettings, type AgencySettings } from "../../agency";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const settings = ref<AgencySettings | null>(null);

async function loadPage() {
  const session = sessionState.session;

  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  try {
    settings.value = await loadAgencySettings(session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load settings.";
  }
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Settings</h1>
      <p class="text-muted text-sm mt-1">Agency configuration</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <template v-if="settings">
      <div class="grid grid-cols-2 gap-6">
        <!-- Plan & Features -->
        <Card>
          <template #title><div class="flex items-center gap-2"><i class="pi pi-box text-muted" /> Plan</div></template>
          <template #content>
            <div class="flex flex-col gap-4">
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted">Plan Tier</span>
                <Tag :value="settings.agency.planTier" severity="info" />
              </div>
              <div>
                <p class="text-sm font-medium mb-2">Feature Flags</p>
                <div class="flex flex-wrap gap-2">
                  <Tag
                    v-for="flag in settings.featureFlags"
                    :key="flag.key"
                    :value="flag.name"
                    :severity="flag.enabled ? 'success' : 'secondary'"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Email Templates -->
        <Card>
          <template #title><div class="flex items-center gap-2"><i class="pi pi-envelope text-muted" /> Email Templates</div></template>
          <template #content>
            <DataTable :value="settings.emailTemplates" stripedRows size="small">
              <Column field="name" header="Name" />
              <Column field="templateType" header="Type">
                <template #body="{ data }">
                  <Tag :value="data.templateType" severity="secondary" />
                </template>
              </Column>
              <Column field="subject" header="Subject">
                <template #body="{ data }">{{ data.subject ?? "—" }}</template>
              </Column>
              <Column header="Active" style="width: 80px">
                <template #body="{ data }">
                  <Tag :value="data.isActive ? 'Yes' : 'No'" :severity="data.isActive ? 'success' : 'secondary'" />
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </template>
  </div>
</template>
