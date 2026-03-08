<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import Message from "primevue/message";

import {
  loadStaffCoverageDefinitions,
  loadStaffCoverageCategories,
  createStaffCoverageDefinition,
  updateStaffCoverageDefinition,
  deleteStaffCoverageDefinition,
  loadStaffPolicyTypes,
  type StaffCoverageDefinition,
  type StaffCoverageCategory,
  type StaffPolicyType,
  type CoverageKind,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const loading = ref(false);
const items = ref<StaffCoverageDefinition[]>([]);
const policyTypes = ref<StaffPolicyType[]>([]);
const categories = ref<StaffCoverageCategory[]>([]);
const filterPolicyTypeId = ref<string | null>(null);
const groupBy = ref<string | null>(null);
const expandedRowGroups = ref<any[]>([]);
const showDialog = ref(false);
const editingId = ref<string | null>(null);

const groupByOptions = [
  { label: "None", value: null },
  { label: "Kind", value: "kind" },
  { label: "Category", value: "categoryName" },
  { label: "Policy Type", value: "policyTypeName" },
];

const groupByField = computed(() => groupBy.value);

const sortedItems = computed(() => {
  if (!groupBy.value) return items.value;
  const field = groupBy.value as keyof StaffCoverageDefinition;
  return [...items.value].sort((a, b) => {
    const av = (a[field] ?? "—") as string;
    const bv = (b[field] ?? "—") as string;
    const cmp = av.localeCompare(bv);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });
});

function groupLabel(value: unknown): string {
  if (!value) return "—";
  if (groupBy.value === "kind") {
    const map: Record<string, string> = { COVERAGE: "Coverage", ENDORSEMENT: "Endorsement", EXCLUSION: "Exclusion" };
    return map[value as string] ?? String(value);
  }
  return String(value);
}

const kindOptions: Array<{ label: string; value: CoverageKind }> = [
  { label: "Coverage", value: "COVERAGE" },
  { label: "Endorsement", value: "ENDORSEMENT" },
  { label: "Exclusion", value: "EXCLUSION" },
];

const form = reactive({
  code: "",
  name: "",
  kind: "COVERAGE" as CoverageKind,
  categoryId: null as string | null,
  policyTypeId: null as string | null,
  aliasOne: "",
  aliasTwo: "",
  definition: "",
  claimExamples: "",
  additionalHelp: "",
  riskSummary: "",
  isCommonlyRecommended: false,
});

function resetForm() {
  form.code = "";
  form.name = "";
  form.kind = "COVERAGE";
  form.categoryId = null;
  form.policyTypeId = null;
  form.aliasOne = "";
  form.aliasTwo = "";
  form.definition = "";
  form.claimExamples = "";
  form.additionalHelp = "";
  form.riskSummary = "";
  form.isCommonlyRecommended = false;
  editingId.value = null;
}

async function loadPage() {
  const session = sessionState.session;
  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.coverage.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  try {
    const [defs, types, cats] = await Promise.all([
      loadStaffCoverageDefinitions(session.token, filterPolicyTypeId.value ?? undefined),
      loadStaffPolicyTypes(session.token),
      loadStaffCoverageCategories(session.token),
    ]);
    items.value = defs.items;
    policyTypes.value = types.items;
    categories.value = cats.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load coverage definitions.";
  }
}

function openCreate() {
  resetForm();
  showDialog.value = true;
}

function openEdit(item: StaffCoverageDefinition) {
  editingId.value = item.id;
  form.code = item.code ?? "";
  form.name = item.name;
  form.kind = item.kind;
  form.categoryId = item.categoryId;
  form.policyTypeId = item.policyTypeId;
  form.aliasOne = item.aliasOne ?? "";
  form.aliasTwo = item.aliasTwo ?? "";
  form.definition = item.definition ?? "";
  form.claimExamples = item.claimExamples ?? "";
  form.additionalHelp = item.additionalHelp ?? "";
  form.riskSummary = item.riskSummary ?? "";
  form.isCommonlyRecommended = item.isCommonlyRecommended;
  showDialog.value = true;
}

async function submit() {
  const session = sessionState.session;
  if (!session) return;

  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const body = {
      name: form.name,
      code: form.code || undefined,
      kind: form.kind,
      categoryId: form.categoryId || undefined,
      policyTypeId: form.policyTypeId || undefined,
      aliasOne: form.aliasOne || undefined,
      aliasTwo: form.aliasTwo || undefined,
      definition: form.definition || undefined,
      claimExamples: form.claimExamples || undefined,
      additionalHelp: form.additionalHelp || undefined,
      riskSummary: form.riskSummary || undefined,
      isCommonlyRecommended: form.isCommonlyRecommended,
    };

    if (editingId.value) {
      await updateStaffCoverageDefinition(session.token, editingId.value, body);
      successMessage.value = "Coverage definition updated.";
    } else {
      await createStaffCoverageDefinition(session.token, body);
      successMessage.value = "Coverage definition created.";
    }

    showDialog.value = false;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save.";
  } finally {
    loading.value = false;
  }
}

async function remove(id: string) {
  const session = sessionState.session;
  if (!session) return;

  try {
    await deleteStaffCoverageDefinition(session.token, id);
    successMessage.value = "Coverage definition deactivated.";
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to deactivate.";
  }
}

async function onFilterChange() {
  await loadPage();
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Coverage Library</h1>
        <p class="text-muted text-sm mt-1">Canonical coverage definitions across all carriers</p>
      </div>
      <Button v-if="hasPermission('staff.coverage.manage')" label="New Definition" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <Card>
      <template #content>
        <div class="flex gap-3 mb-4">
          <Select
            v-model="filterPolicyTypeId"
            :options="[{ id: null, name: 'All Policy Types' }, ...policyTypes]"
            optionLabel="name"
            optionValue="id"
            class="w-64"
            @update:modelValue="onFilterChange"
          />
          <Select
            v-model="groupBy"
            :options="groupByOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Group by…"
            class="w-48"
          />
        </div>

        <DataTable
          :value="sortedItems"
          :rows="25"
          :paginator="sortedItems.length > 25"
          scrollable
          scrollHeight="calc(100vh - 21rem)"
          :rowGroupMode="groupByField ? 'subheader' : undefined"
          :groupRowsBy="groupByField ?? undefined"
          class="p-datatable-sm"
        >
          <template v-if="groupByField" #groupheader="{ data }">
            <div class="flex items-baseline gap-2 py-2 px-3 bg-surface-alt rounded-sm">
              <span class="font-bold text-base text-primary">{{ groupLabel(data[groupByField]) }}</span>
              <span class="text-[10px] font-bold uppercase tracking-widest text-muted">{{ groupByOptions.find(o => o.value === groupByField)?.label }}</span>
            </div>
          </template>
          <Column field="code" header="Code" sortable style="width: 180px">
            <template #body="{ data }">
              <span v-if="data.code" class="font-mono text-sm">{{ data.code }}</span>
              <span v-else class="text-muted text-sm">—</span>
            </template>
          </Column>
          <Column field="name" header="Name" sortable />
          <Column field="kind" header="Kind" sortable style="width: 120px">
            <template #body="{ data }">
              <Tag v-if="data.kind === 'ENDORSEMENT'" value="Endorsement" severity="warn" />
              <Tag v-else-if="data.kind === 'EXCLUSION'" value="Exclusion" severity="danger" />
              <span v-else class="text-sm">Coverage</span>
            </template>
          </Column>
          <Column field="categoryName" header="Category" sortable style="width: 160px">
            <template #body="{ data }">
              <Tag v-if="data.categoryName" :value="data.categoryName" severity="info" />
              <span v-else class="text-muted text-sm">—</span>
            </template>
          </Column>
          <Column field="policyTypeName" header="Policy Type" sortable style="width: 140px">
            <template #body="{ data }">{{ data.policyTypeName ?? "Global" }}</template>
          </Column>
          <Column header="Mapped" style="width: 80px">
            <template #body="{ data }">
              <span class="font-medium">{{ data.formMappingCount }}</span>
            </template>
          </Column>
          <Column header="" style="width: 80px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Tag v-if="data.isCommonlyRecommended" value="rec" severity="success" />
                <Tag v-if="!data.isActive" value="inactive" severity="secondary" />
              </div>
            </template>
          </Column>
          <Column v-if="hasPermission('staff.coverage.manage')" header="" style="width: 100px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button icon="pi pi-pencil" size="small" severity="secondary" text @click="openEdit(data)" />
                <Button v-if="data.isActive" icon="pi pi-trash" size="small" severity="danger" text @click="remove(data.id)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog v-model:visible="showDialog" :header="editingId ? 'Edit Coverage Definition' : 'New Coverage Definition'" :modal="true" :dismissableMask="true" :style="{ width: '800px' }">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Code</label>
            <InputText v-model="form.code" class="w-full font-mono" placeholder="water_backup" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="form.name" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Kind</label>
            <Select v-model="form.kind" :options="kindOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Category</label>
            <Select v-model="form.categoryId" :options="categories" optionLabel="name" optionValue="id" placeholder="None" class="w-full" showClear />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Policy Type</label>
            <Select v-model="form.policyTypeId" :options="policyTypes" optionLabel="name" optionValue="id" placeholder="Global (none)" class="w-full" showClear />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Alias 1</label>
            <InputText v-model="form.aliasOne" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Alias 2</label>
            <InputText v-model="form.aliasTwo" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Definition</label>
          <Textarea v-model="form.definition" rows="2" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Risk Summary</label>
          <Textarea v-model="form.riskSummary" rows="2" class="w-full" placeholder="Plain-English explanation for the AI agent" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Claim Examples</label>
          <Textarea v-model="form.claimExamples" rows="2" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Additional Help</label>
          <Textarea v-model="form.additionalHelp" rows="2" class="w-full" />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="form.isCommonlyRecommended" :binary="true" inputId="isCommonlyRecommended" />
          <label for="isCommonlyRecommended" class="text-sm">Commonly recommended by agencies</label>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
          <Button type="submit" :label="editingId ? 'Update' : 'Create'" icon="pi pi-check" :loading="loading" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
