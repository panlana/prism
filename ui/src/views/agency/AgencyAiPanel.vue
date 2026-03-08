<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRoute } from "vue-router";
import Textarea from "primevue/textarea";
import Button from "primevue/button";

import { marked } from "marked";

import { postWithToken } from "../../api";
import { sessionState } from "../../session";

marked.setOptions({ breaks: true });

type ChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type PendingAction = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  message: string;
};

type AiChatResponse = {
  type: "message" | "tool_call";
  message: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
};

type AiConfirmResponse = {
  type: "message";
  message: string;
  actionResult: { success: boolean; data?: Record<string, unknown>; error?: string };
};

const TOOL_LABELS: Record<string, string> = {
  create_insured: "Create Insured Account",
  add_contact: "Add Contact",
  update_contact: "Update Contact",
  update_insured: "Update Insured Account",
  create_policy: "Create Policy",
  update_policy: "Update Policy",
};

const ARG_LABELS: Record<string, string> = {
  accountCode: "Account Code",
  displayName: "Display Name",
  primaryEmail: "Email",
  primaryPhone: "Phone",
  primaryStateCode: "State",
  contactFirstName: "First Name",
  contactLastName: "Last Name",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  relationship: "Relationship",
  isPrimary: "Primary Contact",
  insuredAccountId: "Account",
  policyId: "Policy",
  contactId: "Contact",
  policyTypeCode: "Policy Type",
  policyNumber: "Policy #",
  carrierName: "Carrier",
  status: "Status",
  effectiveDate: "Effective Date",
  expirationDate: "Expiration Date",
  premium: "Premium",
  stateCode: "State",
};

// Fields that contain internal IDs — hide from confirmation card
const HIDDEN_ARG_KEYS = new Set(["insuredAccountId", "policyId", "contactId"]);

const route = useRoute();

const SCREEN_LABELS: Record<string, string> = {
  "agency-dashboard": "Agency Dashboard",
  "agency-insureds": "Insureds list",
  "agency-insured-detail": "Insured detail",
  "agency-policies": "Policies list",
  "agency-policy-detail": "Policy detail",
  "agency-recommendations": "Recommendations",
  "agency-tasks": "Tasks",
  "agency-settings": "Settings",
};

const screenContext = computed(() => {
  const params = route.params;
  const path = route.path;

  let screen = "";
  const insuredAccountId = params.insuredAccountId as string | undefined;
  const policyId = params.policyId as string | undefined;

  if (insuredAccountId) {
    screen = "Insured account detail page";
  } else if (policyId) {
    screen = "Policy detail page";
  } else if (path.includes("/insureds")) {
    screen = "Insureds list page";
  } else if (path.includes("/policies")) {
    screen = "Policies list page";
  } else if (path.includes("/recommendations")) {
    screen = "Recommendations page";
  } else if (path.includes("/tasks")) {
    screen = "Tasks page";
  } else if (path.includes("/settings")) {
    screen = "Agency settings page";
  } else if (path.includes("/dashboard")) {
    screen = "Agency dashboard";
  }

  return {
    ...(screen ? { screen } : {}),
    ...(insuredAccountId ? { insuredAccountId } : {}),
    ...(policyId ? { policyId } : {}),
  };
});

const input = ref("");
const loading = ref(false);
const confirming = ref(false);
const errorMessage = ref("");
const history = ref<ChatMessage[]>([]);
const pendingAction = ref<PendingAction | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

function buildHistory(): ChatMessage[] {
  return history.value.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
  }));
}

async function send() {
  const session = sessionState.session;
  const message = input.value.trim();
  if (!session || !message || loading.value || confirming.value) return;

  history.value.push({ role: "user", content: message });
  input.value = "";
  loading.value = true;
  errorMessage.value = "";
  scrollToBottom();

  try {
    const result = await postWithToken<AiChatResponse>(
      "/api/agency/ai/chat",
      session.token,
      { message, history: buildHistory().slice(0, -1), screenContext: screenContext.value }
    );

    if (result.type === "tool_call" && result.toolCallId && result.toolName && result.args) {
      if (result.message) {
        history.value.push({ role: "assistant", content: result.message });
      }
      pendingAction.value = {
        toolCallId: result.toolCallId,
        toolName: result.toolName,
        args: result.args,
        message: result.message || "",
      };
    } else {
      history.value.push({ role: "assistant", content: result.message });
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "AI request failed.";
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

async function confirmAction() {
  const session = sessionState.session;
  const action = pendingAction.value;
  if (!session || !action) return;

  confirming.value = true;
  errorMessage.value = "";

  try {
    const result = await postWithToken<AiConfirmResponse>(
      "/api/agency/ai/confirm",
      session.token,
      {
        toolCallId: action.toolCallId,
        toolName: action.toolName,
        args: action.args,
        history: buildHistory(),
        screenContext: screenContext.value,
      }
    );

    // Record the tool call exchange in history for context continuity
    history.value.push({
      role: "assistant",
      content: "",
      tool_calls: [{
        id: action.toolCallId,
        type: "function",
        function: { name: "execute_tool", arguments: JSON.stringify({ toolKey: action.toolName, payload: action.args }) },
      }],
    });
    history.value.push({
      role: "tool",
      content: JSON.stringify(result.actionResult),
      tool_call_id: action.toolCallId,
    });
    history.value.push({ role: "assistant", content: result.message });

    pendingAction.value = null;

    if (result.actionResult.success) {
      window.dispatchEvent(new CustomEvent("prism:data-changed"));
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Action failed.";
  } finally {
    confirming.value = false;
    scrollToBottom();
  }
}

function cancelAction() {
  if (pendingAction.value) {
    history.value.push({
      role: "assistant",
      content: "Action cancelled. Let me know if you'd like to try something else.",
    });
    pendingAction.value = null;
    scrollToBottom();
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function clearChat() {
  history.value = [];
  errorMessage.value = "";
  pendingAction.value = null;
}

function argLabel(key: string): string {
  return ARG_LABELS[key] || key;
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="p-3 border-b border-border flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <i class="pi pi-sparkles text-accent" />
        <span class="text-sm font-semibold">AI Assistant</span>
      </div>
      <Button v-if="history.length" icon="pi pi-trash" size="small" severity="secondary" text rounded @click="clearChat" />
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      <div v-if="!history.length && !pendingAction" class="flex-1 flex items-center justify-center">
        <div class="text-center text-muted">
          <i class="pi pi-sparkles text-3xl mb-2 block opacity-40" />
          <p class="text-sm">Ask me about policies, coverages, recommendations, or anything else.</p>
        </div>
      </div>

      <template v-for="(msg, i) in history" :key="i">
        <!-- Skip internal tool messages from display -->
        <div
          v-if="msg.role === 'user'"
          class="rounded-lg px-3 py-2 text-sm max-w-[90%] whitespace-pre-wrap bg-accent text-white self-end"
        >{{ msg.content }}</div>

        <div
          v-else-if="msg.role === 'assistant' && msg.content && !msg.tool_calls"
          class="ai-message rounded-lg px-3 py-2 text-sm max-w-[90%] bg-surface-alt self-start"
          v-html="marked.parse(msg.content)"
        />
      </template>

      <!-- Loading -->
      <div v-if="loading" class="self-start bg-surface-alt rounded-lg px-3 py-2 text-sm text-muted">
        <i class="pi pi-spin pi-spinner mr-1" /> Thinking...
      </div>

      <!-- Pending Action Confirmation Card -->
      <div v-if="pendingAction" class="self-start w-full max-w-[95%]">
        <div class="rounded-lg border border-amber-300 bg-amber-50 overflow-hidden">
          <div class="px-3 py-2 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-amber-600" />
            <span class="text-sm font-semibold text-amber-800">Confirm Action</span>
          </div>
          <div class="p-3">
            <div class="text-sm font-medium text-amber-900 mb-2">
              {{ TOOL_LABELS[pendingAction.toolName] || pendingAction.toolName }}
            </div>
            <div class="flex flex-col gap-1 mb-3">
              <template v-for="(value, key) in pendingAction.args" :key="String(key)">
                <div
                  v-if="!HIDDEN_ARG_KEYS.has(String(key))"
                  class="flex gap-2 text-xs"
                >
                  <span class="text-amber-700 font-medium min-w-[5.5rem]">{{ argLabel(String(key)) }}:</span>
                  <span class="text-amber-900">{{ value }}</span>
                </div>
              </template>
            </div>
            <div class="flex gap-2">
              <Button
                label="Confirm"
                icon="pi pi-check"
                size="small"
                severity="success"
                :loading="confirming"
                @click="confirmAction"
              />
              <Button
                label="Cancel"
                icon="pi pi-times"
                size="small"
                severity="secondary"
                outlined
                :disabled="confirming"
                @click="cancelAction"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Confirming -->
      <div v-if="confirming" class="self-start bg-surface-alt rounded-lg px-3 py-2 text-sm text-muted">
        <i class="pi pi-spin pi-spinner mr-1" /> Executing action...
      </div>

      <!-- Error -->
      <div v-if="errorMessage" class="self-start bg-red-50 text-danger rounded-lg px-3 py-2 text-sm">
        {{ errorMessage }}
      </div>
    </div>

    <!-- Input -->
    <form class="p-3 border-t border-border shrink-0 flex gap-2 items-end" @submit.prevent="send">
      <Textarea
        v-model="input"
        placeholder="Ask something..."
        class="flex-1"
        autoResize
        :rows="1"
        :maxRows="5"
        :disabled="loading || confirming || !!pendingAction"
        @keydown.enter.exact.prevent="send"
      />
      <Button
        type="submit"
        icon="pi pi-send"
        :loading="loading"
        :disabled="!input.trim() || confirming || !!pendingAction"
      />
    </form>
  </div>
</template>

<style scoped>
.ai-message :deep(p) {
  margin: 0 0 0.5rem;
}
.ai-message :deep(p:last-child) {
  margin-bottom: 0;
}
.ai-message :deep(ol),
.ai-message :deep(ul) {
  margin: 0.25rem 0 0.5rem;
  padding-left: 1.25rem;
}
.ai-message :deep(li) {
  margin-bottom: 0.25rem;
}
.ai-message :deep(strong) {
  font-weight: 600;
}
.ai-message :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85em;
}
</style>
