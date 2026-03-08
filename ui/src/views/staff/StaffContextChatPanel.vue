<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import Textarea from "primevue/textarea";
import Button from "primevue/button";
import { marked } from "marked";

import { sendStreamingChat } from "../../socket";

marked.setOptions({ breaks: true });

const props = defineProps<{
  agent: string;
  agencyId: string;
  insuredAccountId: string;
  policyId: string;
}>();

const emit = defineEmits<{ close: [] }>();

type HistoryMessage = { role: "user" | "assistant"; content: string };

const input = ref("");
const loading = ref(false);
const errorMessage = ref("");
const history = ref<HistoryMessage[]>([]);
const streamingContent = ref("");
const lastUsage = ref<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>(null);
const lastModel = ref("");
const messagesContainer = ref<HTMLElement | null>(null);

let activeCleanup: (() => void) | null = null;

// Clear chat when context params change
watch(
  () => [props.agent, props.agencyId, props.insuredAccountId, props.policyId],
  () => {
    if (history.value.length > 0) {
      history.value = [];
      streamingContent.value = "";
      lastUsage.value = null;
      lastModel.value = "";
      errorMessage.value = "";
    }
  },
);

function send() {
  const message = input.value.trim();
  if (!message || loading.value) return;

  history.value.push({ role: "user", content: message });
  input.value = "";
  loading.value = true;
  errorMessage.value = "";
  streamingContent.value = "";
  scrollToBottom();

  const { cleanup } = sendStreamingChat(
    "chat:context-preview",
    {
      message,
      history: history.value.slice(0, -1),
      agent: props.agent,
      agencyId: props.agencyId || undefined,
      insuredAccountId: props.insuredAccountId || undefined,
      policyId: props.policyId || undefined,
    },
    {
      onDelta: (delta) => {
        streamingContent.value += delta;
        scrollToBottom();
      },
      onDone: (result) => {
        history.value.push({ role: "assistant", content: result.message });
        streamingContent.value = "";
        lastUsage.value = result.usage;
        lastModel.value = result.model;
        loading.value = false;
        activeCleanup = null;
        scrollToBottom();
      },
      onError: (error) => {
        streamingContent.value = "";
        errorMessage.value = error;
        loading.value = false;
        activeCleanup = null;
        scrollToBottom();
      },
    },
  );

  activeCleanup = cleanup;
}

function clearChat() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  history.value = [];
  streamingContent.value = "";
  errorMessage.value = "";
  lastUsage.value = null;
  lastModel.value = "";
  loading.value = false;
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="p-3 border-b border-border flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <i class="pi pi-sparkles text-accent" />
        <span class="text-sm font-semibold">Context Test Chat</span>
      </div>
      <div class="flex items-center gap-1">
        <Button v-if="history.length" icon="pi pi-trash" size="small" severity="secondary" text rounded @click="clearChat" v-tooltip.left="'Clear conversation'" />
        <Button icon="pi pi-times" size="small" severity="secondary" text rounded @click="emit('close')" />
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      <div v-if="!history.length && !streamingContent" class="flex-1 flex items-center justify-center">
        <div class="text-center text-muted">
          <i class="pi pi-sparkles text-3xl mb-2 block opacity-40" />
          <p class="text-sm">Test the assembled context by chatting as the selected agent.</p>
          <p class="text-xs text-muted mt-1">Context changes will reset the conversation.</p>
        </div>
      </div>

      <template v-for="(msg, i) in history" :key="i">
        <div
          v-if="msg.role === 'user'"
          class="rounded-lg px-3 py-2 text-sm max-w-[90%] whitespace-pre-wrap bg-accent text-white self-end"
        >{{ msg.content }}</div>

        <div
          v-else-if="msg.role === 'assistant'"
          class="ai-message rounded-lg px-3 py-2 text-sm max-w-[90%] bg-surface-alt self-start"
          v-html="marked.parse(msg.content)"
        />
      </template>

      <!-- Streaming response -->
      <div
        v-if="streamingContent"
        class="ai-message rounded-lg px-3 py-2 text-sm max-w-[90%] bg-surface-alt self-start"
        v-html="marked.parse(streamingContent)"
      />

      <!-- Loading (before first delta arrives) -->
      <div v-if="loading && !streamingContent" class="self-start bg-surface-alt rounded-lg px-3 py-2 text-sm text-muted">
        <i class="pi pi-spin pi-spinner mr-1" /> Thinking...
      </div>

      <!-- Error -->
      <div v-if="errorMessage" class="self-start bg-red-50 text-danger rounded-lg px-3 py-2 text-sm">
        {{ errorMessage }}
      </div>
    </div>

    <!-- Token usage footer -->
    <div v-if="lastUsage" class="px-3 py-1 border-t border-border text-xs text-muted flex items-center gap-3 shrink-0">
      <span>{{ lastModel }}</span>
      <span>{{ formatTokens(lastUsage.promptTokens) }} in / {{ formatTokens(lastUsage.completionTokens) }} out</span>
    </div>

    <!-- Input -->
    <form class="p-3 border-t border-border shrink-0 flex gap-2 items-end" @submit.prevent="send">
      <Textarea
        v-model="input"
        placeholder="Test a message..."
        class="flex-1"
        autoResize
        :rows="1"
        :maxRows="5"
        :disabled="loading"
        @keydown.enter.exact.prevent="send"
      />
      <Button
        type="submit"
        icon="pi pi-send"
        :loading="loading"
        :disabled="!input.trim()"
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
