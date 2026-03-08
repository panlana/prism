<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Card from "primevue/card";
import Tag from "primevue/tag";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Select from "primevue/select";
import InputText from "primevue/inputtext";
import ToggleSwitch from "primevue/toggleswitch";
import Message from "primevue/message";
import Dialog from "primevue/dialog";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";

import {
  loadStaffAgencyDetail,
  updateStaffAgency,
  updateStaffAgencyFeatures,
  updateStaffAgencyMember,
  addStaffAgencyAppointment,
  deleteStaffAgencyAppointment,
  loadStaffCarriers,
  loadStaffStates,
  loadStaffRoles,
  type StaffAgencyDetail,
  type StaffAgencyMember,
  type StaffRole,
} from "../../staff";
import { sessionState } from "../../session";
import { hasPermission } from "../../permissions";

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const errorMessage = ref("");
const successMessage = ref("");
const detail = ref<StaffAgencyDetail | null>(null);
const saving = ref(false);
const activeTab = ref("settings");

// ── Settings ──
const planOptions = [
  { label: "Standard", value: "STANDARD" },
  { label: "Standard + AI", value: "STANDARD_AI" },
];
const statusOptions = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

// ── Users ──
const agencyRoles = ref<StaffRole[]>([]);
const showEditMember = ref(false);
const editingMember = ref<StaffAgencyMember | null>(null);
const memberEdit = reactive({ roleId: "", status: "" });
const memberSaving = ref(false);

// ── Appointments ──
const showAddAppointment = ref(false);
const carriers = ref<Array<{ id: string; name: string }>>([]);
const states = ref<Array<{ id: string; code: string; name: string }>>([]);
const newAppointment = reactive({ carrierId: "", stateId: "" });

// ── Computed ──
const canManage = computed(() => hasPermission("staff.agencies.manage"));

const memberStatusOptions = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

// ── Load ──
async function loadPage() {
  const session = sessionState.session;
  const agencyId = route.params.agencyId;

  if (!session || session.user.userType !== "STAFF") {
    await router.push("/");
    return;
  }
  if (!hasPermission("staff.agencies.view")) {
    await router.push("/staff/dashboard");
    return;
  }
  if (typeof agencyId !== "string") {
    await router.push("/staff/agencies");
    return;
  }

  try {
    detail.value = await loadStaffAgencyDetail(session.token, agencyId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load agency.";
  }
}

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

// ── Settings ──
async function saveAgency() {
  const session = sessionState.session;
  if (!session || !detail.value) return;
  saving.value = true;
  clearMessages();
  try {
    const a = detail.value.agency;
    await updateStaffAgency(session.token, a.id, {
      name: a.name,
      status: a.status,
      planTier: a.planTier,
      primaryEmail: a.primaryEmail,
      primaryPhone: a.primaryPhone,
      timezone: a.timezone,
    });
    successMessage.value = "Agency updated.";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update agency.";
  } finally {
    saving.value = false;
  }
}

// ── Feature Flags ──
async function saveFeatures() {
  const session = sessionState.session;
  if (!session || !detail.value) return;
  saving.value = true;
  clearMessages();
  try {
    const flags = detail.value.agency.featureFlags.map((f) => ({
      featureFlagId: f.featureFlagId,
      enabled: f.enabled,
    }));
    await updateStaffAgencyFeatures(session.token, detail.value.agency.id, flags);
    successMessage.value = "Feature flags updated.";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update features.";
  } finally {
    saving.value = false;
  }
}

// ── Users ──
async function openEditMember(member: StaffAgencyMember) {
  const session = sessionState.session;
  if (!session) return;

  // Load agency roles if not loaded yet
  if (agencyRoles.value.length === 0) {
    try {
      const result = await loadStaffRoles(session.token);
      agencyRoles.value = result.items.filter((r) => r.scope === "AGENCY");
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : "Failed to load roles.";
      return;
    }
  }

  editingMember.value = member;
  memberEdit.roleId = member.roleId;
  memberEdit.status = member.status;
  showEditMember.value = true;
}

async function saveMember() {
  const session = sessionState.session;
  if (!session || !detail.value || !editingMember.value) return;

  memberSaving.value = true;
  clearMessages();
  try {
    const updated = await updateStaffAgencyMember(
      session.token,
      detail.value.agency.id,
      editingMember.value.id,
      { roleId: memberEdit.roleId, status: memberEdit.status }
    );
    // Update local state
    const idx = detail.value.agency.members.findIndex((m) => m.id === updated.id);
    if (idx >= 0) detail.value.agency.members[idx] = updated;
    showEditMember.value = false;
    editingMember.value = null;
    successMessage.value = "User updated.";
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Failed to update user.";
  } finally {
    memberSaving.value = false;
  }
}

// ── Appointments ──
async function openAddAppointment() {
  const session = sessionState.session;
  if (!session) return;
  try {
    const [carrierResult, stateResult] = await Promise.all([
      loadStaffCarriers(session.token),
      loadStaffStates(session.token),
    ]);
    carriers.value = carrierResult.items;
    states.value = stateResult.items;
    newAppointment.carrierId = "";
    newAppointment.stateId = "";
    showAddAppointment.value = true;
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Failed to load reference data.";
  }
}

async function submitAppointment() {
  const session = sessionState.session;
  if (!session || !detail.value || !newAppointment.carrierId) return;
  try {
    const result = await addStaffAgencyAppointment(session.token, detail.value.agency.id, {
      carrierId: newAppointment.carrierId,
      stateId: newAppointment.stateId || undefined,
    });
    detail.value.agency.carrierAppointments.push(result);
    showAddAppointment.value = false;
    successMessage.value = "Appointment added.";
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "Failed to add appointment.";
  }
}

function confirmRemoveAppointment(appointmentId: string, carrierName: string) {
  confirm.require({
    message: `Remove appointment for "${carrierName}"?`,
    header: "Remove Appointment",
    icon: "pi pi-trash",
    rejectLabel: "Cancel",
    acceptLabel: "Remove",
    acceptClass: "p-button-danger",
    accept: async () => {
      const session = sessionState.session;
      if (!session || !detail.value) return;
      try {
        await deleteStaffAgencyAppointment(session.token, detail.value.agency.id, appointmentId);
        detail.value.agency.carrierAppointments = detail.value.agency.carrierAppointments.filter(
          (a) => a.id !== appointmentId
        );
        successMessage.value = "Appointment removed.";
      } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : "Failed to remove appointment.";
      }
    },
  });
}

function memberDisplayName(m: StaffAgencyMember) {
  return [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

onMounted(loadPage);
</script>

<template>
  <div v-if="detail">
    <!-- ── Header ── -->
    <div class="flex items-center gap-3 mb-5">
      <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="router.push('/staff/agencies')" />
      <div class="flex-1">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold">{{ detail.agency.name }}</h1>
          <Tag :value="detail.agency.status" :severity="detail.agency.status === 'ACTIVE' ? 'success' : 'secondary'" />
          <Tag :value="detail.agency.planTier === 'STANDARD_AI' ? 'Standard + AI' : 'Standard'" severity="info" />
        </div>
        <p class="text-muted text-sm mt-0.5">{{ detail.agency.slug }} &middot; Created {{ formatDate(detail.agency.createdAt) }}</p>
      </div>
    </div>

    <!-- ── Stat Cards ── -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <Card v-for="stat in [
        { label: 'Users', value: detail.agency.counts.memberships, icon: 'pi pi-users', color: 'text-indigo-600' },
        { label: 'Insureds', value: detail.agency.counts.insuredAccounts, icon: 'pi pi-id-card', color: 'text-green-600' },
        { label: 'Policies', value: detail.agency.counts.policies, icon: 'pi pi-file', color: 'text-amber-600' },
        { label: 'Reviews', value: detail.agency.counts.reviewSessions, icon: 'pi pi-comments', color: 'text-purple-600' },
      ]" :key="stat.label">
        <template #content>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-surface-alt flex items-center justify-center">
              <i :class="[stat.icon, stat.color]" class="text-lg" />
            </div>
            <div>
              <div class="text-xl font-bold">{{ stat.value }}</div>
              <div class="text-xs text-muted">{{ stat.label }}</div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false" class="mb-4">{{ successMessage }}</Message>

    <!-- ── Tab Selector ── -->
    <div class="flex gap-1 p-1 bg-surface-hover rounded-lg w-fit mb-5">
      <button
        v-for="tab in [
          { key: 'settings', icon: 'pi pi-cog', label: 'Settings' },
          { key: 'users', icon: 'pi pi-users', label: 'Users' },
          { key: 'features', icon: 'pi pi-flag', label: 'Feature Flags' },
          { key: 'appointments', icon: 'pi pi-building', label: 'Carrier Appointments' },
        ]"
        :key="tab.key"
        :class="['px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer border-0', activeTab === tab.key ? 'bg-white text-foreground shadow-sm' : 'bg-transparent text-muted hover:text-foreground']"
        @click="activeTab = tab.key"
      >
        <i :class="tab.icon" class="mr-1.5" />{{ tab.label }}
      </button>
    </div>

    <!-- ════════════ Settings ════════════ -->
    <div v-if="activeTab === 'settings'">
      <div class="grid grid-cols-2 gap-5">
        <!-- General Info -->
        <div class="border border-border rounded-xl bg-white p-5">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-4">General</h3>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Name</label>
              <InputText v-model="detail.agency.name" class="w-full" :disabled="!canManage" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Email</label>
              <InputText v-model="detail.agency.primaryEmail" class="w-full" :disabled="!canManage" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Phone</label>
              <InputText v-model="detail.agency.primaryPhone" class="w-full" :disabled="!canManage" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Timezone</label>
              <InputText v-model="detail.agency.timezone" class="w-full" :disabled="!canManage" />
            </div>
          </div>
        </div>

        <!-- Plan & Status -->
        <div class="border border-border rounded-xl bg-white p-5">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Plan &amp; Status</h3>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Status</label>
              <Select v-model="detail.agency.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" :disabled="!canManage" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Plan Tier</label>
              <Select v-model="detail.agency.planTier" :options="planOptions" optionLabel="label" optionValue="value" class="w-full" :disabled="!canManage" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="canManage" class="flex justify-end mt-4">
        <Button label="Save Settings" icon="pi pi-check" :loading="saving" @click="saveAgency" />
      </div>
    </div>

    <!-- ════════════ Users ════════════ -->
    <div v-if="activeTab === 'users'" class="border border-border rounded-xl bg-white overflow-hidden">
      <DataTable :value="detail.agency.members" stripedRows size="small">
        <Column header="Name">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <div>
                <div class="font-medium">{{ memberDisplayName(data) }}</div>
                <div class="text-xs text-muted">{{ data.email }}</div>
              </div>
              <i v-if="data.isPrimary" class="pi pi-star-fill text-yellow-500 text-xs" title="Primary contact" />
            </div>
          </template>
        </Column>
        <Column field="roleName" header="Role">
          <template #body="{ data }">
            <Tag :value="data.roleName" severity="info" />
          </template>
        </Column>
        <Column field="status" header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : data.status === 'INVITED' ? 'warn' : 'secondary'" />
          </template>
        </Column>
        <Column v-if="canManage" header="" style="width: 60px">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openEditMember(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ════════════ Feature Flags ════════════ -->
    <div v-if="activeTab === 'features'" class="border border-border rounded-xl bg-white p-5">
      <div class="flex flex-col">
        <div
          v-for="flag in detail.agency.featureFlags"
          :key="flag.featureFlagId"
          class="flex items-center justify-between py-3 border-b border-border last:border-0"
        >
          <div>
            <div class="text-sm font-medium">{{ flag.name }}</div>
            <div class="text-xs text-muted">{{ flag.key }}</div>
          </div>
          <ToggleSwitch v-if="canManage" v-model="flag.enabled" />
          <Tag v-else :value="flag.enabled ? 'Enabled' : 'Disabled'" :severity="flag.enabled ? 'success' : 'secondary'" />
        </div>
      </div>
      <div v-if="canManage" class="flex justify-end pt-4">
        <Button label="Save Flags" icon="pi pi-check" :loading="saving" @click="saveFeatures" />
      </div>
    </div>

    <!-- ════════════ Carrier Appointments ════════════ -->
    <div v-if="activeTab === 'appointments'">
      <div v-if="canManage" class="flex justify-end mb-3">
        <Button label="Add Appointment" icon="pi pi-plus" severity="secondary" size="small" @click="openAddAppointment" />
      </div>
      <div class="border border-border rounded-xl bg-white overflow-hidden">
        <DataTable :value="detail.agency.carrierAppointments" stripedRows size="small">
          <Column field="carrierName" header="Carrier" />
          <Column field="stateCode" header="State">
            <template #body="{ data }">{{ data.stateCode ?? "All" }}</template>
          </Column>
          <Column v-if="canManage" header="" style="width: 60px">
            <template #body="{ data }">
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmRemoveAppointment(data.id, data.carrierName)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else>
    <div class="flex items-center gap-3 mb-6">
      <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="router.push('/staff/agencies')" />
      <h1 class="text-2xl font-bold">Agency</h1>
    </div>
    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
  </div>

  <!-- ── Edit User Dialog ── -->
  <Dialog v-model:visible="showEditMember" header="Edit User" :modal="true" :style="{ width: '420px' }">
    <template v-if="editingMember">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3 pb-3 border-b border-border">
          <div class="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center">
            <i class="pi pi-user text-muted" />
          </div>
          <div>
            <div class="font-medium">{{ memberDisplayName(editingMember) }}</div>
            <div class="text-xs text-muted">{{ editingMember.email }}</div>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Role</label>
          <Select v-model="memberEdit.roleId" :options="agencyRoles" optionLabel="name" optionValue="id" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Status</label>
          <Select v-model="memberEdit.status" :options="memberStatusOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button label="Cancel" severity="secondary" text @click="showEditMember = false" />
          <Button label="Save" icon="pi pi-check" :loading="memberSaving" @click="saveMember" />
        </div>
      </div>
    </template>
  </Dialog>

  <!-- ── Add Appointment Dialog ── -->
  <Dialog v-model:visible="showAddAppointment" header="Add Carrier Appointment" :modal="true" :style="{ width: '420px' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Carrier</label>
        <Select v-model="newAppointment.carrierId" :options="carriers" optionLabel="name" optionValue="id" placeholder="Select carrier" class="w-full" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">State</label>
        <Select v-model="newAppointment.stateId" :options="states" optionLabel="name" optionValue="id" placeholder="All states" showClear class="w-full" />
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <Button label="Cancel" severity="secondary" text @click="showAddAppointment = false" />
        <Button label="Add" icon="pi pi-check" :disabled="!newAppointment.carrierId" @click="submitAppointment" />
      </div>
    </div>
  </Dialog>

  <ConfirmDialog />
</template>
