<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Message from "primevue/message";

import { getWithToken } from "../api";
import { sessionState } from "../session";

type InsuredOverview = {
  items: Array<{
    contact: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      isPrimary: boolean;
    };
    account: {
      id: string;
      accountCode: string;
      displayName: string;
      agencyName: string;
      agencySlug: string;
      policies: Array<{
        id: string;
        policyNumber: string | null;
        policyTypeName: string;
        carrierName: string | null;
        status: string;
        readinessSource: string;
        isReviewReady: boolean;
      }>;
      openTasks: Array<{
        id: string;
        title: string;
        status: string;
        type: string;
      }>;
      recentReviews: Array<{
        id: string;
        status: string;
        summary: string | null;
      }>;
    };
  }>;
};

const router = useRouter();
const errorMessage = ref("");
const overview = ref<InsuredOverview | null>(null);

async function loadPage() {
  if (sessionState.session?.user.userType !== "INSURED") {
    await router.push("/");
    return;
  }

  try {
    overview.value = await getWithToken<InsuredOverview>("/api/insured/overview", sessionState.session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load your account.";
  }
}

onMounted(loadPage);
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Your Policies</h1>
      <p class="text-muted text-sm mt-1">View your coverage and review status</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <template v-if="overview">
      <div v-for="item in overview.items" :key="item.account.id" class="mb-6">
        <Card>
          <template #title>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="pi pi-shield text-muted" />
                {{ item.account.displayName }}
              </div>
              <span class="text-sm font-normal text-muted">{{ item.account.agencyName }}</span>
            </div>
          </template>
          <template #content>
            <!-- Policies table -->
            <DataTable :value="item.account.policies" stripedRows size="small" class="mb-4">
              <Column field="policyTypeName" header="Type" sortable />
              <Column field="carrierName" header="Carrier">
                <template #body="{ data }">{{ data.carrierName ?? "—" }}</template>
              </Column>
              <Column field="policyNumber" header="Policy #">
                <template #body="{ data }">{{ data.policyNumber ?? "—" }}</template>
              </Column>
              <Column field="status" header="Status">
                <template #body="{ data }">
                  <Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" />
                </template>
              </Column>
              <Column header="Review Ready">
                <template #body="{ data }">
                  <Tag :value="data.isReviewReady ? 'Ready' : 'Not Ready'" :severity="data.isReviewReady ? 'success' : 'warn'" />
                </template>
              </Column>
            </DataTable>

            <!-- Open tasks -->
            <div v-if="item.account.openTasks.length" class="mb-3">
              <p class="text-sm font-medium mb-2">Open Tasks</p>
              <div class="flex flex-wrap gap-2">
                <Tag v-for="task in item.account.openTasks" :key="task.id" :value="task.title" severity="warn" />
              </div>
            </div>

            <!-- Recent reviews -->
            <div v-if="item.account.recentReviews.length">
              <p class="text-sm font-medium mb-2">Recent Reviews</p>
              <div class="flex flex-col gap-1">
                <div v-for="review in item.account.recentReviews" :key="review.id" class="flex items-center gap-2 text-sm">
                  <Tag :value="review.status" severity="info" />
                  <span class="text-muted">{{ review.summary ?? "Completed review" }}</span>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </template>
  </div>
</template>
