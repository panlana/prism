<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import InputText from "primevue/inputtext";
import Message from "primevue/message";

import {
  loadStaffOfferingDetail,
  loadStaffCoverageDefinitions,
  createStaffCoverageMapping,
  updateStaffCoverageMapping,
  deleteStaffCoverageMapping,
  updateStaffFormSection,
  type StaffOfferingDetail,
  type StaffOfferingCoverageMapping,
  type StaffOfferingFormSection,
  type StaffCoverageDefinition,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const route = useRoute();
const router = useRouter();
const errorMessage = ref("");
const successMessage = ref("");
const detail = ref<StaffOfferingDetail | null>(null);
const coverageDefinitions = ref<StaffCoverageDefinition[]>([]);
const saving = ref(false);

// Add mapping dialog
const showAddDialog = ref(false);
const addFormId = ref<string | null>(null);
const addCoverageId = ref<string | null>(null);

// Coverage detail dialog
const showCoverageDialog = ref(false);
const selectedMapping = ref<StaffOfferingCoverageMapping | null>(null);
const selectedFormSections = ref<StaffOfferingFormSection[]>([]);
const selectedFormTitle = ref("");

// Expanded sections per form
const expandedForms = ref<Set<string>>(new Set());

// Inline section editing
const editingSectionId = ref<string | null>(null);
const editTitle = ref("");
const editContent = ref("");
const editSectionType = ref("");
const editSaving = ref(false);

// Canonical section types — aliases collapse variants to a single value
const canonicalTypes: Record<string, string> = {
  coverage: "coverage",
  exclusion: "exclusion",
  condition: "condition",
  definition: "definition",
  definitions: "definition",
  deductible: "deductible",
  preamble: "preamble",
  general: "general",
  schedule: "schedule",
  agreement: "agreement",
};

function normalizeSectionType(t: string): string {
  return canonicalTypes[t.toLowerCase()] ?? t.toLowerCase();
}

const sectionTypeOptions = computed(() => {
  const seen = new Set<string>();
  // Always include the base set
  for (const v of ["coverage", "exclusion", "condition", "definition", "deductible", "preamble", "general", "schedule", "agreement"]) {
    seen.add(v);
  }
  // Add any new types from data that aren't aliases of existing ones
  if (detail.value) {
    for (const form of detail.value.forms) {
      for (const s of form.sections) {
        seen.add(normalizeSectionType(s.sectionType));
        for (const c of s.children) seen.add(normalizeSectionType(c.sectionType));
      }
    }
  }
  return [...seen]
    .sort()
    .map((v) => ({ label: sectionTypeLabel(v), value: v }));
});

const canManage = () => hasPermission("staff.carriers.manage");

function toggleFormSections(formId: string) {
  if (expandedForms.value.has(formId)) {
    expandedForms.value.delete(formId);
  } else {
    expandedForms.value.add(formId);
  }
}

function startEditSection(section: { id: string; title: string; content: string; sectionType: string }) {
  editingSectionId.value = section.id;
  editTitle.value = section.title;
  editContent.value = section.content;
  editSectionType.value = normalizeSectionType(section.sectionType);
}

function cancelEdit() {
  editingSectionId.value = null;
  editTitle.value = "";
  editContent.value = "";
  editSectionType.value = "";
}

async function saveSection() {
  const session = sessionState.session;
  if (!session || !editingSectionId.value) return;

  editSaving.value = true;
  errorMessage.value = "";
  try {
    await updateStaffFormSection(session.token, editingSectionId.value, {
      title: editTitle.value,
      content: editContent.value,
      sectionType: editSectionType.value,
    });
    successMessage.value = "Section updated.";
    editingSectionId.value = null;
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save section.";
  } finally {
    editSaving.value = false;
  }
}

async function loadPage() {
  const session = sessionState.session;
  const offeringId = route.params.offeringId;

  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }

  if (!hasPermission("staff.carriers.view")) {
    await router.push("/staff/dashboard");
    return;
  }

  if (typeof offeringId !== "string") {
    await router.push("/staff/carriers");
    return;
  }

  try {
    const [offeringData, defsData] = await Promise.all([
      loadStaffOfferingDetail(session.token, offeringId),
      loadStaffCoverageDefinitions(session.token),
    ]);
    detail.value = offeringData;
    coverageDefinitions.value = defsData.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load offering.";
  }
}

function openCoverageDetail(mapping: StaffOfferingCoverageMapping, form: { title: string; sections: StaffOfferingFormSection[] }) {
  selectedMapping.value = mapping;
  selectedFormTitle.value = form.title;
  selectedFormSections.value = form.sections;
  showCoverageDialog.value = true;
}

function openAddMapping(formId: string) {
  addFormId.value = formId;
  addCoverageId.value = null;
  showAddDialog.value = true;
}

async function submitAddMapping() {
  const session = sessionState.session;
  if (!session || !addFormId.value || !addCoverageId.value) return;

  saving.value = true;
  errorMessage.value = "";
  try {
    await createStaffCoverageMapping(session.token, {
      offeringFormId: addFormId.value,
      coverageDefinitionId: addCoverageId.value,
    });
    showAddDialog.value = false;
    successMessage.value = "Coverage mapping added.";
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to add mapping.";
  } finally {
    saving.value = false;
  }
}

async function toggleRemoved(mappingId: string, isRemoved: boolean) {
  const session = sessionState.session;
  if (!session) return;

  try {
    await updateStaffCoverageMapping(session.token, mappingId, { isRemoved: !isRemoved });
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update mapping.";
  }
}

async function removeMapping(mappingId: string) {
  const session = sessionState.session;
  if (!session) return;

  try {
    await deleteStaffCoverageMapping(session.token, mappingId);
    successMessage.value = "Coverage mapping deleted.";
    await loadPage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to delete mapping.";
  }
}

function availableCoverages(formId: string) {
  if (!detail.value) return coverageDefinitions.value;
  const form = detail.value.forms.find((f) => f.id === formId);
  if (!form) return coverageDefinitions.value;
  const mapped = new Set(form.coverageMappings.map((m) => m.coverageDefinitionId));
  return coverageDefinitions.value.filter((c) => !mapped.has(c.id));
}

function showRef(ref: string | null, title: string) {
  if (!ref) return false;
  return ref.toLowerCase() !== title.toLowerCase();
}

function showTypeTag(sectionType: string, title: string) {
  return sectionTypeLabel(sectionType).toLowerCase() !== title.toLowerCase();
}

function sectionTypeLabel(t: string) {
  const labels: Record<string, string> = {
    coverage: "Coverage",
    exclusion: "Exclusion",
    condition: "Condition",
    definition: "Definition",
    deductible: "Deductible",
    preamble: "Preamble",
    general: "General",
    schedule: "Schedule",
    agreement: "Agreement",
  };
  const normalized = normalizeSectionType(t);
  return labels[normalized] ?? (normalized.charAt(0).toUpperCase() + normalized.slice(1));
}

onMounted(loadPage);
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="router.back()" />
      <div v-if="detail">
        <h1 class="text-2xl font-bold">{{ detail.carrierName }} — {{ detail.policyTypeName }}</h1>
        <p class="text-muted text-sm mt-0.5">{{ detail.stateCode }}</p>
      </div>
      <div v-else>
        <h1 class="text-2xl font-bold">Offering</h1>
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <template v-if="detail">
      <div v-for="form in detail.forms" :key="form.id" class="mb-4">
        <div class="border border-border rounded-xl bg-white p-5">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <i class="pi pi-file text-muted" />
              <span class="text-base font-semibold">{{ form.title }}</span>
            </div>
            <div class="flex gap-2">
              <Tag :value="form.kind" severity="secondary" />
              <Tag v-if="form.isBasePolicy" value="Base Policy" severity="info" />
            </div>
          </div>
          <p class="text-sm text-muted mb-4">
            {{ form.formNumber ?? "No form number" }}
            {{ form.version ? `· v${form.version}` : "" }}
          </p>
            <!-- Coverage Mappings -->
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-medium">Coverage Mappings</p>
              <Button
                v-if="canManage()"
                label="Add"
                icon="pi pi-plus"
                size="small"
                severity="secondary"
                @click="openAddMapping(form.id)"
              />
            </div>
            <DataTable v-if="form.coverageMappings.length" :value="form.coverageMappings" stripedRows size="small">
              <Column field="coverageDefinitionName" header="Coverage">
                <template #body="{ data }">
                  <button
                    class="text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer text-sm font-medium text-left"
                    @click="openCoverageDetail(data, form)"
                  >
                    {{ data.coverageDefinitionName }}
                  </button>
                  <span v-if="data.coverageDefinitionCode" class="text-muted text-xs ml-2 font-mono">{{ data.coverageDefinitionCode }}</span>
                </template>
              </Column>
              <Column field="knownMaxLimit" header="Max Limit" style="width: 120px">
                <template #body="{ data }">
                  <span v-if="data.knownMaxLimit" class="text-sm">${{ Number(data.knownMaxLimit).toLocaleString() }}</span>
                  <span v-else class="text-muted text-sm">—</span>
                </template>
              </Column>
              <Column field="isManualOverride" header="Manual" style="width: 80px">
                <template #body="{ data }">
                  <Tag v-if="data.isManualOverride" value="Yes" severity="warn" />
                  <span v-else class="text-muted text-sm">No</span>
                </template>
              </Column>
              <Column field="isRemoved" header="Removed" style="width: 90px">
                <template #body="{ data }">
                  <Tag v-if="data.isRemoved" value="Yes" severity="danger" />
                  <span v-else class="text-muted text-sm">No</span>
                </template>
              </Column>
              <Column v-if="canManage()" header="" style="width: 80px">
                <template #body="{ data }">
                  <div class="flex gap-1">
                    <Button
                      :icon="data.isRemoved ? 'pi pi-undo' : 'pi pi-eye-slash'"
                      size="small"
                      :severity="data.isRemoved ? 'success' : 'warn'"
                      text
                      :title="data.isRemoved ? 'Restore' : 'Mark removed'"
                      @click="toggleRemoved(data.id, data.isRemoved)"
                    />
                    <Button
                      icon="pi pi-trash"
                      size="small"
                      severity="danger"
                      text
                      title="Delete permanently"
                      @click="removeMapping(data.id)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
            <p v-else class="text-muted text-sm">No coverage mappings.</p>

            <!-- Form Sections (extracted content) -->
            <div v-if="form.sections.length" class="mt-4">
              <button
                class="flex items-center gap-2 text-sm font-medium text-muted hover:text-slate-700 bg-transparent border-0 p-0 cursor-pointer"
                @click="toggleFormSections(form.id)"
              >
                <i :class="expandedForms.has(form.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-xs" />
                Extracted Sections ({{ form.sections.length }})
              </button>
              <div v-if="expandedForms.has(form.id)" class="mt-3 flex flex-col gap-3">
                <template v-for="section in form.sections" :key="section.id">
                  <!-- Top-level section -->
                  <div class="border border-border rounded-lg p-3">
                    <!-- View mode -->
                    <template v-if="editingSectionId !== section.id">
                      <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                          <span v-if="showRef(section.sectionRef, section.title)" class="font-mono text-xs text-muted">{{ section.sectionRef }}</span>
                          <span class="text-sm font-medium">{{ section.title }}</span>
                          <Tag v-if="showTypeTag(section.sectionType, section.title)" :value="sectionTypeLabel(section.sectionType)" severity="secondary" class="text-xs" />
                        </div>
                        <Button
                          v-if="canManage()"
                          icon="pi pi-pencil"
                          size="small"
                          severity="secondary"
                          text
                          title="Edit section"
                          @click="startEditSection(section)"
                        />
                      </div>
                      <p class="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{{ section.content }}</p>
                    </template>
                    <!-- Edit mode -->
                    <template v-else>
                      <div class="flex flex-col gap-3">
                        <div class="flex items-center gap-2">
                          <span v-if="showRef(section.sectionRef, section.title)" class="font-mono text-xs text-muted">{{ section.sectionRef }}</span>
                          <InputText v-model="editTitle" class="flex-1 text-sm" />
                          <Select v-model="editSectionType" :options="sectionTypeOptions" optionLabel="label" optionValue="value" class="w-36 text-xs" />
                        </div>
                        <Textarea v-model="editContent" :autoResize="true" rows="6" class="w-full text-sm" />
                        <div class="flex justify-end gap-2">
                          <Button label="Cancel" size="small" severity="secondary" text @click="cancelEdit" />
                          <Button label="Save" size="small" icon="pi pi-check" :loading="editSaving" @click="saveSection" />
                        </div>
                      </div>
                    </template>

                    <!-- Children -->
                    <div v-if="section.children.length" class="mt-2 ml-4 flex flex-col gap-2">
                      <template v-for="child in section.children" :key="child.id">
                        <div class="border-l-2 border-border pl-3">
                          <!-- Child view mode -->
                          <template v-if="editingSectionId !== child.id">
                            <div class="flex items-center justify-between mb-1">
                              <div class="flex items-center gap-2">
                                <span v-if="showRef(child.sectionRef, child.title)" class="font-mono text-xs text-muted">{{ child.sectionRef }}</span>
                                <span class="text-sm font-medium">{{ child.title }}</span>
                                <Tag v-if="showTypeTag(child.sectionType, child.title)" :value="sectionTypeLabel(child.sectionType)" severity="secondary" class="text-xs" />
                              </div>
                              <Button
                                v-if="canManage()"
                                icon="pi pi-pencil"
                                size="small"
                                severity="secondary"
                                text
                                title="Edit section"
                                @click="startEditSection(child)"
                              />
                            </div>
                            <p class="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{{ child.content }}</p>
                          </template>
                          <!-- Child edit mode -->
                          <template v-else>
                            <div class="flex flex-col gap-3">
                              <div class="flex items-center gap-2">
                                <span v-if="showRef(child.sectionRef, child.title)" class="font-mono text-xs text-muted">{{ child.sectionRef }}</span>
                                <InputText v-model="editTitle" class="flex-1 text-sm" />
                                <Select v-model="editSectionType" :options="sectionTypeOptions" optionLabel="label" optionValue="value" class="w-36 text-xs" />
                              </div>
                              <Textarea v-model="editContent" :autoResize="true" rows="6" class="w-full text-sm" />
                              <div class="flex justify-end gap-2">
                                <Button label="Cancel" size="small" severity="secondary" text @click="cancelEdit" />
                                <Button label="Save" size="small" icon="pi pi-check" :loading="editSaving" @click="saveSection" />
                              </div>
                            </div>
                          </template>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </div>
        </div>
      </div>

      <p v-if="!detail.forms.length" class="text-muted text-sm">No forms configured for this offering.</p>
    </template>

    <!-- Add Mapping Dialog -->
    <Dialog v-model:visible="showAddDialog" header="Add Coverage Mapping" :modal="true" :style="{ width: '450px' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Coverage Definition</label>
          <Select
            v-model="addCoverageId"
            :options="availableCoverages(addFormId!)"
            optionLabel="name"
            optionValue="id"
            placeholder="Select coverage…"
            class="w-full"
            filter
          />
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" text @click="showAddDialog = false" />
          <Button label="Add" icon="pi pi-plus" :loading="saving" :disabled="!addCoverageId" @click="submitAddMapping" />
        </div>
      </div>
    </Dialog>

    <!-- Coverage Detail Dialog -->
    <Dialog
      v-model:visible="showCoverageDialog"
      :header="selectedMapping?.coverageDefinitionName ?? 'Coverage Detail'"
      :modal="true"
      :style="{ width: '700px' }"
    >
      <div v-if="selectedMapping" class="flex flex-col gap-5">
        <!-- Canonical definition -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <Tag :value="selectedMapping.coverageKind" :severity="selectedMapping.coverageKind === 'EXCLUSION' ? 'danger' : selectedMapping.coverageKind === 'ENDORSEMENT' ? 'warn' : 'info'" />
            <Tag v-if="selectedMapping.categoryName" :value="selectedMapping.categoryName" severity="secondary" />
            <span v-if="selectedMapping.coverageDefinitionCode" class="font-mono text-xs text-muted">{{ selectedMapping.coverageDefinitionCode }}</span>
          </div>
          <div v-if="selectedMapping.definition" class="mb-3">
            <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Canonical Definition</p>
            <p class="text-sm leading-relaxed">{{ selectedMapping.definition }}</p>
          </div>
          <div v-if="selectedMapping.riskSummary" class="mb-3">
            <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Risk Summary (AI Guidance)</p>
            <p class="text-sm leading-relaxed">{{ selectedMapping.riskSummary }}</p>
          </div>
          <div v-if="selectedMapping.claimExamples">
            <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Claim Examples</p>
            <p class="text-sm leading-relaxed">{{ selectedMapping.claimExamples }}</p>
          </div>
          <p v-if="!selectedMapping.definition && !selectedMapping.riskSummary && !selectedMapping.claimExamples" class="text-muted text-sm">
            No canonical definition content yet.
          </p>
        </div>

        <!-- Carrier-specific form content -->
        <div v-if="selectedFormSections.length">
          <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Carrier Content — {{ selectedFormTitle }}
          </p>
          <div class="flex flex-col gap-2 max-h-80 overflow-y-auto">
            <div v-for="section in selectedFormSections" :key="section.id" class="border border-border rounded p-3">
              <div class="flex items-center gap-2 mb-1">
                <span v-if="showRef(section.sectionRef, section.title)" class="font-mono text-xs text-muted">{{ section.sectionRef }}</span>
                <span class="text-sm font-medium">{{ section.title }}</span>
                <Tag v-if="showTypeTag(section.sectionType, section.title)" :value="sectionTypeLabel(section.sectionType)" severity="secondary" class="text-xs" />
              </div>
              <p class="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{{ section.content }}</p>
              <div v-if="section.children.length" class="mt-2 ml-3 flex flex-col gap-2">
                <div v-for="child in section.children" :key="child.id" class="border-l-2 border-border pl-3">
                  <div class="flex items-center gap-2 mb-1">
                    <span v-if="showRef(child.sectionRef, child.title)" class="font-mono text-xs text-muted">{{ child.sectionRef }}</span>
                    <span class="text-sm font-medium">{{ child.title }}</span>
                  </div>
                  <p class="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{{ child.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-muted text-sm">No extracted sections for this form.</p>
      </div>
    </Dialog>
  </div>
</template>
