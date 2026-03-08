<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { lintGutter, linter, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches } from "@codemirror/search";

const props = defineProps<{
  modelValue: string;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const container = ref<HTMLDivElement>();
let view: EditorView | null = null;

const jsonLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc.toString();
  if (!doc.trim()) return diagnostics;
  try {
    JSON.parse(doc);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    // Try to extract position from error message
    const posMatch = msg.match(/position (\d+)/);
    const pos = posMatch ? Number(posMatch[1]) : 0;
    diagnostics.push({
      from: Math.min(pos, doc.length),
      to: Math.min(pos + 1, doc.length),
      severity: "error",
      message: msg,
    });
  }
  return diagnostics;
});

const theme = EditorView.theme({
  "&": {
    fontSize: "13px",
    border: "1px solid var(--p-surface-300, #d1d5db)",
    borderRadius: "6px",
    overflow: "hidden",
  },
  "&.cm-focused": {
    outline: "2px solid var(--p-primary-500, #6366f1)",
    outlineOffset: "-1px",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
    maxHeight: "400px",
    overflow: "auto",
  },
  ".cm-gutters": {
    backgroundColor: "var(--p-surface-50, #f8fafc)",
    borderRight: "1px solid var(--p-surface-200, #e2e8f0)",
    color: "var(--p-surface-400, #94a3b8)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--p-surface-100, #f1f5f9)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--p-surface-50, #f8fafc)",
  },
});

function createState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      bracketMatching(),
      foldGutter(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      highlightSelectionMatches(),
      json(),
      jsonLinter,
      lintGutter(),
      keymap.of([...defaultKeymap, indentWithTab]),
      theme,
      EditorView.lineWrapping,
      ...(props.readonly ? [EditorState.readOnly.of(true)] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit("update:modelValue", update.state.doc.toString());
        }
      }),
    ],
  });
}

onMounted(() => {
  if (!container.value) return;
  view = new EditorView({
    state: createState(props.modelValue),
    parent: container.value,
  });
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (newVal !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: newVal },
      });
    }
  },
);

function formatJson() {
  if (!view) return;
  const doc = view.state.doc.toString();
  try {
    const formatted = JSON.stringify(JSON.parse(doc), null, 2);
    emit("update:modelValue", formatted);
  } catch {
    // invalid JSON — do nothing
  }
}

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<template>
  <div>
    <div class="flex justify-end mb-1">
      <button
        type="button"
        class="text-xs text-muted hover:text-slate-700 flex items-center gap-1 cursor-pointer bg-transparent border-0 px-1 py-0.5 rounded hover:bg-surface-hover transition-colors"
        @click="formatJson"
      >
        <i class="pi pi-align-left text-xs" />
        Format
      </button>
    </div>
    <div ref="container" />
  </div>
</template>
