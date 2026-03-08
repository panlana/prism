<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Select from "primevue/select";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Message from "primevue/message";

import {
  loadStaffContextPreview,
  loadStaffAgencies,
  loadStaffAgencyInsureds,
  loadStaffAgencyPolicies,
  type StaffContextPreview,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";
import StaffContextChatPanel from "./StaffContextChatPanel.vue";

const router = useRouter();
const errorMessage = ref("");
const loading = ref(false);
const preview = ref<StaffContextPreview | null>(null);

const agentOptions = [
  { label: "Insured Review Agent", value: "insured_review" },
  { label: "Agency In-App Assistant", value: "agency_assistant" },
];

const selectedAgent = ref("insured_review");
const agencies = ref<Array<{ id: string; name: string }>>([]);
const selectedAgencyId = ref("");

const insureds = ref<Array<{ id: string; displayName: string; accountCode: string }>>([]);
const selectedInsuredId = ref("");

const policies = ref<Array<{ id: string; label: string }>>([]);
const selectedPolicyId = ref("");

const expandedBlocks = ref<Set<string>>(new Set());
const showChat = ref(false);

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.ai.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const result = await loadStaffAgencies(session.token);
    agencies.value = (result.items ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }));
    if (agencies.value.length > 0 && !selectedAgencyId.value && agencies.value[0]) {
      selectedAgencyId.value = agencies.value[0].id;
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load agencies.";
  }
}

// When agency changes, load its insureds
watch(selectedAgencyId, async (agencyId) => {
  selectedInsuredId.value = "";
  selectedPolicyId.value = "";
  insureds.value = [];
  policies.value = [];

  if (!agencyId) return;
  const session = sessionState.session;
  if (!session) return;

  try {
    const result = await loadStaffAgencyInsureds(session.token, agencyId);
    insureds.value = result.items;
  } catch {
    // Silently fail — user can still type an ID manually
  }
});

// When insured changes, load its policies
watch(selectedInsuredId, async (insuredId) => {
  selectedPolicyId.value = "";
  policies.value = [];

  if (!insuredId || !selectedAgencyId.value) return;
  const session = sessionState.session;
  if (!session) return;

  try {
    const result = await loadStaffAgencyPolicies(session.token, selectedAgencyId.value, insuredId);
    policies.value = result.items;
  } catch {
    // Silently fail
  }
});

async function loadPreview() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";
  preview.value = null;
  expandedBlocks.value = new Set();

  try {
    const params: { agent: string; agencyId?: string; insuredAccountId?: string; policyId?: string } = {
      agent: selectedAgent.value,
    };
    if (selectedAgencyId.value) params.agencyId = selectedAgencyId.value;
    if (selectedInsuredId.value) params.insuredAccountId = selectedInsuredId.value;
    if (selectedPolicyId.value) params.policyId = selectedPolicyId.value;
    preview.value = await loadStaffContextPreview(session.token, params);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load preview.";
  } finally {
    loading.value = false;
  }
}

function toggleBlock(key: string) {
  if (expandedBlocks.value.has(key)) {
    expandedBlocks.value.delete(key);
  } else {
    expandedBlocks.value.add(key);
  }
  expandedBlocks.value = new Set(expandedBlocks.value);
}

function expandAll() {
  if (!preview.value) return;
  expandedBlocks.value = new Set(preview.value.blocks.map((b) => b.key));
}

function collapseAll() {
  expandedBlocks.value = new Set();
}

function formatBytes(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

const copiedKey = ref("");
async function copyToClipboard(text: string, key: string) {
  await navigator.clipboard.writeText(text);
  copiedKey.value = key;
  setTimeout(() => { if (copiedKey.value === key) copiedKey.value = ""; }, 1500);
}

onMounted(loadPage);
</script>

<template>
  <div class="flex gap-0 min-h-0">
    <!-- Main content -->
    <div class="flex-1 min-w-0" :class="showChat ? 'pr-4' : ''">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Context Preview</h1>
          <p class="text-muted text-sm mt-1">Visualize the assembled system prompt for each AI agent surface</p>
        </div>
      </div>

      <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

      <div class="border border-border rounded-xl bg-white p-5 mb-6">
        <div class="grid grid-cols-4 gap-4 mb-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Agent Surface</label>
            <Select v-model="selectedAgent" :options="agentOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Agency</label>
            <Select v-model="selectedAgencyId" :options="agencies" optionLabel="name" optionValue="id" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Insured Account</label>
            <Select
              v-model="selectedInsuredId"
              :options="insureds"
              optionLabel="displayName"
              optionValue="id"
              placeholder="Optional"
              showClear
              filter
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Policy</label>
            <Select
              v-model="selectedPolicyId"
              :options="policies"
              optionLabel="label"
              optionValue="id"
              placeholder="Optional"
              showClear
              filter
              class="w-full"
              :disabled="!selectedInsuredId"
            />
          </div>
        </div>
        <div class="flex justify-end">
          <Button label="Assemble Context" icon="pi pi-play" :loading="loading" @click="loadPreview" />
        </div>
      </div>

      <template v-if="preview">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <Tag :value="preview.agent" severity="info" />
            <span class="text-sm text-muted">{{ preview.blockCount }} blocks</span>
            <span class="text-sm text-muted">{{ formatBytes(preview.systemPrompt.length) }} total</span>
          </div>
          <div class="flex gap-2">
            <Button label="Expand All" size="small" severity="secondary" text @click="expandAll" />
            <Button label="Collapse All" size="small" severity="secondary" text @click="collapseAll" />
            <Button
              :label="showChat ? 'Hide Chat' : 'Test Chat'"
              :icon="showChat ? 'pi pi-times' : 'pi pi-comments'"
              size="small"
              :severity="showChat ? 'secondary' : 'info'"
              :outlined="showChat"
              @click="showChat = !showChat"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-for="block in preview.blocks"
            :key="block.key"
            class="rounded-lg border border-border overflow-hidden"
          >
            <button
              class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface hover:bg-surface-hover transition-colors cursor-pointer border-0 text-left"
              @click="toggleBlock(block.key)"
            >
              <div class="flex items-center gap-3">
                <i :class="expandedBlocks.has(block.key) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-xs text-muted" />
                <span class="font-mono text-sm font-medium">{{ block.key }}</span>
                <span class="text-xs text-muted">order {{ block.sortOrder }}</span>
              </div>
              <span class="text-xs text-muted">{{ formatBytes(block.contentLength) }}</span>
            </button>
            <div v-if="expandedBlocks.has(block.key)" class="px-4 py-3 border-t border-border bg-white relative group/block">
              <Button
                :icon="copiedKey === block.key ? 'pi pi-check' : 'pi pi-copy'"
                size="small"
                severity="secondary"
                text
                rounded
                class="!absolute top-2 right-2 opacity-0 group-hover/block:opacity-100 transition-opacity"
                :class="copiedKey === block.key ? '!text-green-600' : ''"
                @click="copyToClipboard(block.content, block.key)"
                v-tooltip.left="'Copy block'"
              />
              <pre class="text-xs leading-relaxed whitespace-pre-wrap font-mono text-slate-700 max-h-96 overflow-y-auto">{{ block.content }}</pre>
            </div>
          </div>
        </div>

        <div class="border border-border rounded-xl bg-white p-5 mt-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-base font-semibold">Full System Prompt</span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted">{{ formatBytes(preview.systemPrompt.length) }}</span>
              <Button
                :icon="copiedKey === '__full__' ? 'pi pi-check' : 'pi pi-copy'"
                :label="copiedKey === '__full__' ? 'Copied' : 'Copy'"
                size="small"
                severity="secondary"
                text
                :class="copiedKey === '__full__' ? '!text-green-600' : ''"
                @click="copyToClipboard(preview.systemPrompt, '__full__')"
              />
            </div>
          </div>
          <pre class="text-xs leading-relaxed whitespace-pre-wrap font-mono text-slate-700 max-h-[60vh] overflow-y-auto">{{ preview.systemPrompt }}</pre>
        </div>
      </template>
    </div>

    <!-- Chat sidebar -->
    <Transition name="slide">
      <div
        v-if="showChat && preview"
        class="w-[420px] shrink-0 border-l border-border bg-white fixed right-0 top-[60px] bottom-0 z-50 flex flex-col"
      >
        <StaffContextChatPanel
          :agent="selectedAgent"
          :agency-id="selectedAgencyId"
          :insured-account-id="selectedInsuredId"
          :policy-id="selectedPolicyId"
          @close="showChat = false"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
