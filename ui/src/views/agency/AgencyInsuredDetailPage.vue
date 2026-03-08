<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Message from "primevue/message";
import Dialog from "primevue/dialog";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";

import {
  loadAgencyInsuredDetail,
  updateAgencyInsured,
  deleteAgencyInsured,
  deleteAgencyContact,
  createAgencyPolicy,
  loadAgencyReferenceData,
  type AgencyInsuredDetail,
  type AgencyReferenceData,
} from "../../agency";
import { sessionState } from "../../session";

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const errorMessage = ref("");
const successMessage = ref("");
const detail = ref<AgencyInsuredDetail | null>(null);
const activeTab = ref("overview");
const saving = ref(false);
const refData = ref<AgencyReferenceData | null>(null);

// ── Profile editing ──
const editingProfile = ref(false);
const profileForm = reactive({
  displayName: "",
  primaryEmail: "",
  primaryPhone: "",
  primaryStateCode: "",
  streetLineOne: "",
  streetLineTwo: "",
  city: "",
  postalCode: "",
});

// ── Contact dialogs ──
const showContactDialog = ref(false);
const editingContactId = ref<string | null>(null);
const contactForm = reactive({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  relationship: "",
  isPrimary: false,
});

// ── Add policy dialog ──
const showAddPolicy = ref(false);
const policyForm = reactive({
  policyTypeCode: "",
  carrierSlug: "",
  policyNumber: "",
  status: "DRAFT",
});

const policyStatusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
];

// ── Load ──
async function loadPage() {
  const session = sessionState.session;
  const insuredAccountId = route.params.insuredAccountId;

  if (!session || session.user.userType !== "AGENCY") {
    await router.push("/");
    return;
  }

  if (typeof insuredAccountId !== "string") {
    await router.push("/agency/insureds");
    return;
  }

  try {
    detail.value = await loadAgencyInsuredDetail(session.token, insuredAccountId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load insured profile.";
  }
}

async function ensureRefData() {
  if (refData.value) return;
  const session = sessionState.session;
  if (!session) return;
  refData.value = await loadAgencyReferenceData(session.token);
}

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

// ── Profile ──
function startEditProfile() {
  if (!detail.value) return;
  const d = detail.value.insured;
  profileForm.displayName = d.displayName;
  profileForm.primaryEmail = d.primaryEmail ?? "";
  profileForm.primaryPhone = d.primaryPhone ?? "";
  profileForm.primaryStateCode = d.primaryState?.code ?? "";
  profileForm.streetLineOne = d.address.streetLineOne ?? "";
  profileForm.streetLineTwo = d.address.streetLineTwo ?? "";
  profileForm.city = d.address.city ?? "";
  profileForm.postalCode = d.address.postalCode ?? "";
  ensureRefData();
  editingProfile.value = true;
}

async function saveProfile() {
  const session = sessionState.session;
  if (!session || !detail.value) return;

  saving.value = true;
  clearMessages();
  try {
    await updateAgencyInsured(session.token, detail.value.insured.id, {
      displayName: profileForm.displayName,
      primaryEmail: profileForm.primaryEmail || null,
      primaryPhone: profileForm.primaryPhone || null,
      primaryStateCode: profileForm.primaryStateCode || null,
      streetLineOne: profileForm.streetLineOne || null,
      streetLineTwo: profileForm.streetLineTwo || null,
      city: profileForm.city || null,
      postalCode: profileForm.postalCode || null,
    });
    editingProfile.value = false;
    successMessage.value = "Profile updated.";
    await loadPage();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Failed to update profile.";
  } finally {
    saving.value = false;
  }
}

// ── Contacts ──
function openAddContact() {
  editingContactId.value = null;
  contactForm.firstName = "";
  contactForm.lastName = "";
  contactForm.email = "";
  contactForm.phone = "";
  contactForm.relationship = "";
  contactForm.isPrimary = false;
  showContactDialog.value = true;
}

function openEditContact(contact: AgencyInsuredDetail["insured"]["contacts"][number]) {
  editingContactId.value = contact.id;
  contactForm.firstName = contact.firstName ?? "";
  contactForm.lastName = contact.lastName ?? "";
  contactForm.email = contact.email ?? "";
  contactForm.phone = contact.phone ?? "";
  contactForm.relationship = contact.relationship ?? "";
  contactForm.isPrimary = contact.isPrimary;
  showContactDialog.value = true;
}

async function saveContact() {
  const session = sessionState.session;
  if (!session || !detail.value) return;

  saving.value = true;
  clearMessages();
  try {
    // Build contacts array for batch upsert
    const existingContacts = detail.value.insured.contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      relationship: c.relationship,
      isPrimary: c.isPrimary,
    }));

    if (editingContactId.value) {
      // Update existing
      const idx = existingContacts.findIndex((c) => c.id === editingContactId.value);
      if (idx >= 0) {
        existingContacts[idx] = {
          id: editingContactId.value,
          firstName: contactForm.firstName || null,
          lastName: contactForm.lastName || null,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          relationship: contactForm.relationship || null,
          isPrimary: contactForm.isPrimary,
        };
      }
    } else {
      // Add new
      existingContacts.push({
        id: undefined as unknown as string, // No id = create new
        firstName: contactForm.firstName || null,
        lastName: contactForm.lastName || null,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        relationship: contactForm.relationship || null,
        isPrimary: contactForm.isPrimary,
      });
    }

    await updateAgencyInsured(session.token, detail.value.insured.id, {
      contacts: existingContacts,
    });
    showContactDialog.value = false;
    successMessage.value = editingContactId.value ? "Contact updated." : "Contact added.";
    await loadPage();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Failed to save contact.";
  } finally {
    saving.value = false;
  }
}

function confirmDeleteContact(contactId: string, contactName: string) {
  confirm.require({
    message: `Remove contact "${contactName}"?`,
    header: "Remove Contact",
    icon: "pi pi-trash",
    rejectLabel: "Cancel",
    acceptLabel: "Remove",
    acceptClass: "p-button-danger",
    accept: async () => {
      const session = sessionState.session;
      if (!session || !detail.value) return;
      clearMessages();
      try {
        await deleteAgencyContact(session.token, detail.value.insured.id, contactId);
        successMessage.value = "Contact removed.";
        await loadPage();
      } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : "Failed to remove contact.";
      }
    },
  });
}

// ── Policies ──
async function openAddPolicy() {
  await ensureRefData();
  policyForm.policyTypeCode = "";
  policyForm.carrierSlug = "";
  policyForm.policyNumber = "";
  policyForm.status = "DRAFT";
  showAddPolicy.value = true;
}

async function submitAddPolicy() {
  const session = sessionState.session;
  if (!session || !detail.value || !policyForm.policyTypeCode) return;

  saving.value = true;
  clearMessages();
  try {
    await createAgencyPolicy(session.token, {
      insuredAccountId: detail.value.insured.id,
      policyTypeCode: policyForm.policyTypeCode,
      carrierSlug: policyForm.carrierSlug || undefined,
      policyNumber: policyForm.policyNumber || undefined,
      status: policyForm.status,
    });
    showAddPolicy.value = false;
    successMessage.value = "Policy created.";
    await loadPage();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Failed to create policy.";
  } finally {
    saving.value = false;
  }
}

// ── Delete insured ──
function confirmDeleteInsured() {
  const name = detail.value?.insured.displayName ?? "this insured";
  const policyCount = detail.value?.insured.policies.length ?? 0;
  const message = policyCount > 0
    ? `Delete "${name}" and ${policyCount} associated ${policyCount === 1 ? "policy" : "policies"}? This cannot be undone.`
    : `Delete "${name}"? This cannot be undone.`;

  confirm.require({
    message,
    header: "Delete Insured",
    icon: "pi pi-trash",
    rejectLabel: "Cancel",
    acceptLabel: "Delete",
    acceptClass: "p-button-danger",
    accept: async () => {
      const session = sessionState.session;
      if (!session || !detail.value) return;
      try {
        await deleteAgencyInsured(session.token, detail.value.insured.id);
        router.push("/agency/insureds");
      } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : "Failed to delete insured.";
      }
    },
  });
}

function contactDisplayName(c: { firstName: string | null; lastName: string | null; email: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Contact";
}

function formatCurrency(value: string | null) {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function onDataChanged() {
  loadPage();
}

onMounted(() => {
  loadPage();
  window.addEventListener("prism:data-changed", onDataChanged);
});

onUnmounted(() => {
  window.removeEventListener("prism:data-changed", onDataChanged);
});
</script>

<template>
  <div>
    <!-- ── Header ── -->
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="router.back()" />
        <div>
          <h1 class="text-2xl font-bold">{{ detail?.insured.displayName ?? "Insured" }}</h1>
          <p class="text-muted text-sm mt-0.5">{{ detail?.insured.accountCode }}</p>
        </div>
      </div>
      <Button v-if="detail" label="Delete" icon="pi pi-trash" severity="danger" text @click="confirmDeleteInsured" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <template v-if="detail">
      <!-- ── Tab Selector ── -->
      <div class="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit mb-5">
        <button
          v-for="tab in [
            { key: 'overview', icon: 'pi pi-user', label: 'Overview' },
            { key: 'contacts', icon: 'pi pi-users', label: `Contacts (${detail.insured.contacts.length})` },
            { key: 'policies', icon: 'pi pi-file', label: `Policies (${detail.insured.policies.length})` },
          ]"
          :key="tab.key"
          :class="['px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer border-0', activeTab === tab.key ? 'bg-white text-foreground shadow-sm' : 'bg-transparent text-muted hover:text-foreground']"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon" class="mr-1.5" />{{ tab.label }}
        </button>
      </div>

      <!-- ════════ Overview ════════ -->
      <div v-if="activeTab === 'overview'" class="border border-border rounded-xl bg-white p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Profile</h3>
          <Button v-if="!editingProfile" label="Edit" icon="pi pi-pencil" severity="secondary" text size="small" @click="startEditProfile" />
          <div v-else class="flex gap-2">
            <Button label="Cancel" severity="secondary" text size="small" @click="editingProfile = false" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="saving" @click="saveProfile" />
          </div>
        </div>

        <!-- View mode -->
        <div v-if="!editingProfile" class="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-muted">Name</span>
            <span>{{ detail.insured.displayName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Email</span>
            <span>{{ detail.insured.primaryEmail ?? "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Phone</span>
            <span>{{ detail.insured.primaryPhone ?? "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">State</span>
            <span>{{ detail.insured.primaryState ? `${detail.insured.primaryState.code} — ${detail.insured.primaryState.name}` : "—" }}</span>
          </div>
          <div v-if="detail.insured.address.streetLineOne" class="flex justify-between col-span-2">
            <span class="text-muted">Address</span>
            <span class="text-right">
              {{ detail.insured.address.streetLineOne }}
              <template v-if="detail.insured.address.streetLineTwo"><br />{{ detail.insured.address.streetLineTwo }}</template>
              <template v-if="detail.insured.address.city || detail.insured.address.postalCode">
                <br />{{ [detail.insured.address.city, detail.insured.address.postalCode].filter(Boolean).join(", ") }}
              </template>
            </span>
          </div>
        </div>

        <!-- Edit mode -->
        <div v-else class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Display Name</label>
            <InputText v-model="profileForm.displayName" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">State</label>
            <Select
              v-model="profileForm.primaryStateCode"
              :options="refData?.states ?? []"
              optionLabel="name"
              optionValue="code"
              placeholder="Select state"
              showClear
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Email</label>
            <InputText v-model="profileForm.primaryEmail" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Phone</label>
            <InputText v-model="profileForm.primaryPhone" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Street</label>
            <InputText v-model="profileForm.streetLineOne" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Street Line 2</label>
            <InputText v-model="profileForm.streetLineTwo" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">City</label>
            <InputText v-model="profileForm.city" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Postal Code</label>
            <InputText v-model="profileForm.postalCode" class="w-full" />
          </div>
        </div>
      </div>

      <!-- ════════ Contacts ════════ -->
      <div v-if="activeTab === 'contacts'">
        <div class="flex justify-end mb-3">
          <Button label="Add Contact" icon="pi pi-plus" severity="secondary" size="small" @click="openAddContact" />
        </div>
        <div class="border border-border rounded-xl bg-white overflow-hidden">
          <DataTable :value="detail.insured.contacts" stripedRows size="small">
            <Column header="Name">
              <template #body="{ data }">
                <div>
                  <div class="font-medium">{{ contactDisplayName(data) }}</div>
                  <div v-if="data.relationship" class="text-xs text-muted">{{ data.relationship }}</div>
                </div>
              </template>
            </Column>
            <Column header="Email">
              <template #body="{ data }">{{ data.email ?? "—" }}</template>
            </Column>
            <Column header="Phone">
              <template #body="{ data }">{{ data.phone ?? "—" }}</template>
            </Column>
            <Column header="Role" style="width: 100px">
              <template #body="{ data }">
                <Tag :value="data.isPrimary ? 'Primary' : 'Additional'" :severity="data.isPrimary ? 'success' : 'secondary'" />
              </template>
            </Column>
            <Column header="" style="width: 80px">
              <template #body="{ data }">
                <div class="flex gap-1">
                  <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openEditContact(data)" />
                  <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteContact(data.id, contactDisplayName(data))" />
                </div>
              </template>
            </Column>
          </DataTable>
          <div v-if="!detail.insured.contacts.length" class="p-5 text-center text-muted text-sm">
            No contacts. Click "Add Contact" to create one.
          </div>
        </div>
      </div>

      <!-- ════════ Policies ════════ -->
      <div v-if="activeTab === 'policies'">
        <div class="flex justify-end mb-3">
          <Button label="Add Policy" icon="pi pi-plus" severity="secondary" size="small" @click="openAddPolicy" />
        </div>
        <div class="border border-border rounded-xl bg-white overflow-hidden">
          <DataTable
            :value="detail.insured.policies"
            stripedRows
            size="small"
            selectionMode="single"
            @rowSelect="(e: any) => router.push(`/agency/policies/${e.data.id}`)"
            class="cursor-pointer"
          >
            <Column field="policyTypeName" header="Type" sortable />
            <Column field="carrierName" header="Carrier">
              <template #body="{ data }">{{ data.carrierName ?? "—" }}</template>
            </Column>
            <Column field="policyNumber" header="Policy #">
              <template #body="{ data }">{{ data.policyNumber ?? "—" }}</template>
            </Column>
            <Column field="status" header="Status">
              <template #body="{ data }">
                <Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : data.status === 'DRAFT' ? 'warn' : 'secondary'" />
              </template>
            </Column>
            <Column header="Review Ready">
              <template #body="{ data }">
                <Tag :value="data.isReviewReady ? 'Ready' : 'Not Ready'" :severity="data.isReviewReady ? 'success' : 'warn'" />
              </template>
            </Column>
            <Column field="premium" header="Premium">
              <template #body="{ data }">{{ formatCurrency(data.premium) }}</template>
            </Column>
          </DataTable>
          <div v-if="!detail.insured.policies.length" class="p-5 text-center text-muted text-sm">
            No policies. Click "Add Policy" to create one.
          </div>
        </div>
      </div>
    </template>

    <!-- ── Contact Dialog ── -->
    <Dialog v-model:visible="showContactDialog" :header="editingContactId ? 'Edit Contact' : 'Add Contact'" :modal="true" :style="{ width: '480px' }">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">First Name</label>
            <InputText v-model="contactForm.firstName" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Last Name</label>
            <InputText v-model="contactForm.lastName" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Email</label>
            <InputText v-model="contactForm.email" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Phone</label>
            <InputText v-model="contactForm.phone" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Relationship</label>
            <InputText v-model="contactForm.relationship" placeholder="e.g. Spouse, Co-owner" class="w-full" />
          </div>
          <div class="flex items-end gap-2 pb-1">
            <input type="checkbox" :id="'isPrimary'" v-model="contactForm.isPrimary" class="cursor-pointer" />
            <label :for="'isPrimary'" class="text-sm font-medium cursor-pointer">Primary contact</label>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showContactDialog = false" />
          <Button :label="editingContactId ? 'Save' : 'Add'" icon="pi pi-check" :loading="saving" @click="saveContact" />
        </div>
      </div>
    </Dialog>

    <!-- ── Add Policy Dialog ── -->
    <Dialog v-model:visible="showAddPolicy" header="Add Policy" :modal="true" :style="{ width: '480px' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Policy Type</label>
          <Select
            v-model="policyForm.policyTypeCode"
            :options="refData?.policyTypes ?? []"
            optionLabel="name"
            optionValue="code"
            placeholder="Select type"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Carrier</label>
          <Select
            v-model="policyForm.carrierSlug"
            :options="refData?.carriers ?? []"
            optionLabel="name"
            optionValue="slug"
            placeholder="Select carrier (optional)"
            showClear
            class="w-full"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Policy Number</label>
            <InputText v-model="policyForm.policyNumber" placeholder="Optional" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Status</label>
            <Select v-model="policyForm.status" :options="policyStatusOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showAddPolicy = false" />
          <Button label="Create" icon="pi pi-check" :loading="saving" :disabled="!policyForm.policyTypeCode" @click="submitAddPolicy" />
        </div>
      </div>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>
