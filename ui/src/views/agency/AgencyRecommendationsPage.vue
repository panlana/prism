<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";
import Message from "primevue/message";

import { loadAgencyRecommendations } from "../../agency";
import { sessionState } from "../../session";

type RecommendationResponse = Awaited<ReturnType<typeof loadAgencyRecommendations>>;

const router = useRouter();
const errorMessage = ref("");
const recommendations = ref<RecommendationResponse | null>(null);
const search = ref("");

async function loadPage() {
  const session = sessionState.session;

  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  try {
    recommendations.value = await loadAgencyRecommendations(session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load recommendations.";
  }
}

const filteredItems = computed(() => {
  const items = recommendations.value?.items ?? [];
  const query = search.value.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) =>
    [item.title, item.policyTypeName, item.coverageName ?? "", item.description ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
});

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Recommendations</h1>
      <p class="text-muted text-sm mt-1">Coverage guidance library</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

    <Card>
      <template #content>
        <div class="mb-4">
          <InputText v-model="search" placeholder="Search recommendations..." class="w-full" />
        </div>

        <DataTable
          :value="filteredItems"
          :rows="20"
          :paginator="filteredItems.length > 20"
          stripedRows
          class="text-sm"
          scrollable
          scrollHeight="calc(100vh - 22rem)"
        >
          <Column field="title" header="Title" sortable />
          <Column field="type" header="Type" sortable>
            <template #body="{ data }">
              <Tag :value="data.type" severity="info" />
            </template>
          </Column>
          <Column field="policyTypeName" header="Policy Type" sortable />
          <Column field="coverageName" header="Coverage">
            <template #body="{ data }">{{ data.coverageName ?? "General rule" }}</template>
          </Column>
          <Column field="description" header="Description">
            <template #body="{ data }">
              <span class="text-sm text-muted truncate max-w-64 block">{{ data.description ?? "—" }}</span>
            </template>
          </Column>
          <Column field="minimumLimitText" header="Minimum">
            <template #body="{ data }">{{ data.minimumLimitText ?? "—" }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
