<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRouter } from "vue-router";
import Menubar from "primevue/menubar";
import Button from "primevue/button";
import Toast from "primevue/toast";

import { clearSession, sessionState, toggleSidebar } from "./session";

const router = useRouter();

const logoLink = computed(() => {
  const type = sessionState.session?.user.userType;
  if (type === "AGENCY") return "/agency/dashboard";
  if (type === "STAFF") return "/staff/dashboard";
  if (type === "INSURED") return "/insured";
  return "/";
});

const userLabel = computed(() => {
  const user = sessionState.session?.user;
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
});

const menuItems = computed(() => {
  const items: Array<{ label: string; icon: string; command: () => void }> = [];
  const type = sessionState.session?.user.userType;

  if (type === "AGENCY") {
    items.push({ label: "Agency", icon: "pi pi-building", command: () => router.push("/agency/dashboard") });
  }
  if (type === "STAFF") {
    items.push({ label: "Admin", icon: "pi pi-shield", command: () => router.push("/staff") });
  }
  if (type === "INSURED") {
    items.push({ label: "My Policies", icon: "pi pi-file", command: () => router.push("/insured") });
  }

  return items;
});

async function signOut() {
  clearSession();
  await router.push("/");
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Menubar :model="menuItems" class="rounded-none border-x-0 border-t-0">
      <template #button>
        <Button
          v-if="sessionState.session"
          icon="pi pi-bars"
          text
          severity="secondary"
          @click="toggleSidebar"
        />
      </template>
      <template #start>
        <div class="flex items-center">
          <router-link :to="logoLink" class="text-xl font-bold text-accent no-underline mr-4">PRISM</router-link>
        </div>
      </template>
      <template #end>
        <div class="flex items-center gap-3">
          <span v-if="userLabel" class="text-sm text-muted">{{ userLabel }}</span>
          <Button
            v-if="sessionState.session"
            label="Sign out"
            icon="pi pi-sign-out"
            severity="secondary"
            text
            size="small"
            @click="signOut"
          />
        </div>
      </template>
    </Menubar>

    <Toast position="top-right" />

    <div class="flex-1">
      <RouterView />
    </div>
  </div>
</template>
