<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";
import SelectButton from "primevue/selectbutton";
import Message from "primevue/message";

import { sessionState, signIn } from "../session";
import type { LoginMode } from "../types";

type LoginPreset = {
  label: string;
  mode: LoginMode;
  description: string;
  icon: string;
  email: string;
  password?: string;
};

const router = useRouter();
const loading = ref(false);
const errorMessage = ref("");

const presets: LoginPreset[] = [
  {
    label: "Agency",
    mode: "agency",
    description: "Daily operations for insureds, policies, reviews, and follow-up tasks.",
    icon: "pi pi-building",
    email: "jane@blueridge.test",
    password: "dev-password",
  },
  {
    label: "Admin",
    mode: "staff",
    description: "PRISM staff access for agency oversight, subscriptions, and reference data.",
    icon: "pi pi-shield",
    email: "owner@prism.dev",
    password: "dev-password",
  },
  {
    label: "Insured",
    mode: "insured",
    description: "Customer self-service for active policies, review readiness, and open follow-up items.",
    icon: "pi pi-user",
    email: "taylor@customer.test",
  },
];

const modeOptions = presets.map((p) => ({ label: p.label, value: p.mode }));
const activeMode = ref<LoginMode>("agency");

const defaultPreset = presets[0]!;

const form = reactive({
  email: defaultPreset.email,
  password: defaultPreset.password ?? "",
  token: "",
});

const activePreset = computed(() => presets.find((p) => p.mode === activeMode.value)!);

function onModeChange(mode: LoginMode) {
  if (!mode) return;
  const preset = presets.find((p) => p.mode === mode)!;
  form.email = preset.email;
  form.password = preset.password ?? "";
  form.token = "";
  errorMessage.value = "";
}

async function submit() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const session = await signIn({
      mode: activeMode.value,
      email: form.email,
      password: form.password,
      token: form.token,
    });

    const dest =
      session.user.userType === "AGENCY"
        ? "/agency/dashboard"
        : session.user.userType === "STAFF"
          ? "/staff/dashboard"
          : "/insured";

    await router.push(dest);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to sign in.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[calc(100vh-60px)] p-6">
    <Card class="w-full max-w-md shadow-lg">
      <template #title>
        <div class="text-center">
          <div class="text-3xl font-bold text-accent mb-1">PRISM</div>
          <div class="text-sm text-muted font-normal">Insurance Review Platform</div>
        </div>
      </template>
      <template #content>
        <div class="flex flex-col gap-5">
          <SelectButton
            v-model="activeMode"
            :options="modeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            @update:modelValue="onModeChange"
          />

          <p class="text-sm text-muted text-center -mt-2">{{ activePreset.description }}</p>

          <form class="flex flex-col gap-4" @submit.prevent="submit">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Email</label>
              <InputText v-model="form.email" type="email" autocomplete="username" class="w-full" />
            </div>

            <div v-if="activeMode !== 'insured'" class="flex flex-col gap-1">
              <label class="text-sm font-medium">Password</label>
              <Password v-model="form.password" :feedback="false" toggleMask autocomplete="current-password" inputClass="w-full" class="w-full" />
            </div>

            <div v-else class="flex flex-col gap-1">
              <label class="text-sm font-medium">Magic link token</label>
              <InputText v-model="form.token" placeholder="Leave blank for local dev" class="w-full" />
            </div>

            <Button
              type="submit"
              :label="loading ? 'Signing in...' : `Sign in to ${activePreset.label}`"
              :icon="loading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'"
              :disabled="loading"
              class="w-full"
            />
          </form>

          <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

          <div class="bg-surface-alt rounded-lg p-3 text-xs text-muted">
            <div class="font-semibold mb-1">Dev credentials</div>
            <div>{{ activePreset.email }}</div>
            <div v-if="activeMode === 'insured'">Leave token blank for a local dev magic link.</div>
            <div v-else>Password: <code class="bg-surface-hover px-1 rounded">dev-password</code></div>
          </div>

          <div v-if="sessionState.session" class="text-xs text-center text-muted">
            Signed in as {{ sessionState.session.user.email }}
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
