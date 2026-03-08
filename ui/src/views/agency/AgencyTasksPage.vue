<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Message from "primevue/message";

import { loadAgencyDashboard, updateAgencyTaskStatus, type AgencyDashboard } from "../../agency";
import { sessionState } from "../../session";

const router = useRouter();
const errorMessage = ref("");
const workflowMessage = ref("");
const dashboard = ref<AgencyDashboard | null>(null);

async function loadPage() {
  const session = sessionState.session;

  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  try {
    dashboard.value = await loadAgencyDashboard(session.token);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load tasks.";
  }
}

async function updateTask(taskId: string, status: "IN_PROGRESS" | "CLOSED") {
  const session = sessionState.session;
  if (!session) return;

  try {
    await updateAgencyTaskStatus(session.token, taskId, status);
    workflowMessage.value = status === "CLOSED" ? "Task closed." : "Task moved to in progress.";
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update task.";
  }
}

function statusSeverity(status: string) {
  const map: Record<string, string> = {
    OPEN: "warn",
    IN_PROGRESS: "info",
    BLOCKED: "danger",
    CLOSED: "success",
  };
  return (map[status] ?? "secondary") as "warn" | "info" | "danger" | "success" | "secondary";
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Tasks</h1>
      <p class="text-muted text-sm mt-1">Follow-up queue</p>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="workflowMessage" severity="success" :closable="false" class="mb-4">{{ workflowMessage }}</Message>

    <Card>
      <template #content>
        <DataTable
          :value="dashboard?.recentTasks ?? []"
          stripedRows
          class="text-sm"
          scrollable
          scrollHeight="calc(100vh - 22rem)"
        >
          <Column field="title" header="Task" sortable />
          <Column field="status" header="Status" sortable>
            <template #body="{ data }">
              <Tag :value="data.status" :severity="statusSeverity(data.status)" />
            </template>
          </Column>
          <Column field="insuredDisplayName" header="Insured" sortable />
          <Column field="policyTypeName" header="Policy Type">
            <template #body="{ data }">{{ data.policyTypeName ?? "—" }}</template>
          </Column>
          <Column field="assignedTo" header="Assigned To">
            <template #body="{ data }">{{ data.assignedTo ?? "Unassigned" }}</template>
          </Column>
          <Column header="Actions" style="width: 160px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button v-if="data.status !== 'IN_PROGRESS'" label="Start" size="small" severity="info" text @click="updateTask(data.id, 'IN_PROGRESS')" />
                <Button v-if="data.status !== 'CLOSED'" label="Close" size="small" severity="success" text @click="updateTask(data.id, 'CLOSED')" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
