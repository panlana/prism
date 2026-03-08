<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { clearSession, sessionState } from "../../session";
import AgencyAiPanel from "./AgencyAiPanel.vue";

const router = useRouter();
const route = useRoute();

function isNavActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + "/");
}

const agencyName = computed(() => sessionState.session?.activeAgency?.name ?? "Agency");
const hasAi = computed(() => sessionState.session?.activeAgency?.hasInAppAi ?? false);
const showAiPanel = ref(false);

if (sessionState.session?.user.userType !== "AGENCY") {
  router.replace("/");
}

function signOut() {
  clearSession();
  router.push("/");
}

const navItems = [
  { label: "Dashboard", icon: "pi pi-objects-column", to: "/agency/dashboard" },
  { label: "Insureds", icon: "pi pi-users", to: "/agency/insureds" },
  { label: "Policies", icon: "pi pi-file", to: "/agency/policies" },
  { label: "Recommendations", icon: "pi pi-star", to: "/agency/recommendations" },
  { label: "Tasks", icon: "pi pi-check-square", to: "/agency/tasks" },
  { label: "Settings", icon: "pi pi-cog", to: "/agency/settings" },
];

function closeSidebarOnMobile() {
  if (window.innerWidth < 768) {
    sessionState.isSidebarOpen = false;
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-60px)] relative">
    <!-- Mobile Sidebar Overlay -->
    <div
      v-if="sessionState.isSidebarOpen"
      class="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
      @click="sessionState.isSidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <Transition name="sidebar">
      <aside
        v-if="sessionState.isSidebarOpen"
        class="bg-surface border-r border-border flex flex-col shrink-0 overflow-hidden z-50
               fixed inset-y-0 left-0 w-64 md:relative md:w-60 h-full md:h-auto"
      >
        <div class="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div class="text-xs font-semibold text-muted uppercase tracking-wider">Agency Portal</div>
            <div class="text-lg font-bold mt-1 truncate max-w-[160px]">{{ agencyName }}</div>
          </div>
          <button class="md:hidden text-muted hover:text-accent p-1" @click="sessionState.isSidebarOpen = false">
            <i class="pi pi-times text-lg" />
          </button>
        </div>

        <nav class="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="['sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm no-underline text-slate-700 hover:bg-surface-hover transition-colors', { 'sidebar-link-active': isNavActive(item.to) }]"
            @click="closeSidebarOnMobile"
          >
            <i :class="item.icon" class="text-base w-5 text-center text-muted" />
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="p-3 border-t border-border">
          <button
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-surface-hover transition-colors cursor-pointer bg-transparent border-0"
            type="button"
            @click="signOut"
          >
            <i class="pi pi-sign-out text-base w-5 text-center" />
            Sign out
          </button>
        </div>
      </aside>
    </Transition>

    <!-- Main content -->
    <main class="flex-1 overflow-x-hidden relative min-w-0">
      <div class="p-4 md:p-6 max-w-7xl mx-auto">
        <RouterView />
      </div>

      <!-- FAB toggle -->
      <button
        v-if="hasAi"
        class="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer border-0 transition-all duration-200 z-50"
        :class="showAiPanel
          ? 'bg-slate-600 text-white hover:bg-slate-700 md:right-[calc(24rem+1.5rem)] right-6'
          : 'bg-accent text-white hover:bg-accent/90'"
        type="button"
        @click="showAiPanel = !showAiPanel"
      >
        <i :class="showAiPanel ? 'pi pi-times' : 'pi pi-sparkles'" class="text-xl" />
      </button>
    </main>

    <!-- AI Panel -->
    <Transition name="ai-panel">
      <aside
        v-if="hasAi && showAiPanel"
        class="bg-surface border-l border-border flex flex-col shrink-0 h-[calc(100vh-60px)]
               fixed inset-y-0 right-0 w-full sm:w-96 z-[55] md:relative md:z-auto"
      >
        <div class="flex items-center justify-between p-4 border-b border-border md:hidden">
          <span class="font-bold">AI Assistant</span>
          <button class="text-muted p-1" @click="showAiPanel = false">
            <i class="pi pi-times" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <AgencyAiPanel />
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 0.3s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

@media (min-width: 768px) {
  .sidebar-enter-from,
  .sidebar-leave-to {
    transform: none;
    width: 0;
    opacity: 0;
  }
}

.ai-panel-enter-active,
.ai-panel-leave-active {
  transition: width 0.25s ease, opacity 0.25s ease;
  overflow: hidden;
}

.ai-panel-enter-from,
.ai-panel-leave-to {
  width: 0;
  opacity: 0;
}

.ai-panel-enter-to,
.ai-panel-leave-from {
  width: 24rem;
  opacity: 1;
}
</style>
