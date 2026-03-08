<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { clearSession, sessionState } from "../../session";
import { hasAnyPermission } from "../../permissions";

const router = useRouter();
const route = useRoute();

const childPrefixes: Record<string, string[]> = {
  "/staff/carriers": ["/staff/offerings"],
};

function isNavActive(to: string): boolean {
  if (route.path === to || route.path.startsWith(to + "/")) return true;
  const extras = childPrefixes[to];
  return extras ? extras.some((p) => route.path.startsWith(p + "/") || route.path === p) : false;
}

if (sessionState.session?.user.userType !== "STAFF") {
  router.replace("/");
}

function signOut() {
  clearSession();
  router.push("/");
}

type NavItem = { label: string; icon: string; to: string; perms: string[] };
type NavSection = { title: string; items: NavItem[] };

const allSections: NavSection[] = [
  {
    title: "",
    items: [
      { label: "Dashboard", icon: "pi pi-objects-column", to: "/staff/dashboard", perms: ["staff.dashboard.view"] },
      { label: "Agencies", icon: "pi pi-building", to: "/staff/agencies", perms: ["staff.agencies.view"] },
    ],
  },
  {
    title: "Policies",
    items: [
      { label: "Coverage Library", icon: "pi pi-book", to: "/staff/coverage", perms: ["staff.coverage.view"] },
      { label: "Carriers", icon: "pi pi-truck", to: "/staff/carriers", perms: ["staff.carriers.view"] },
      { label: "Policy Types", icon: "pi pi-file", to: "/staff/policy-types", perms: ["staff.coverage.view"] },
    ],
  },
  {
    title: "AI",
    items: [
      { label: "AI Usage", icon: "pi pi-chart-bar", to: "/staff/ai-usage", perms: ["staff.ai_usage.view"] },
      { label: "Context Blocks", icon: "pi pi-code", to: "/staff/context-blocks", perms: ["staff.ai.view"] },
      { label: "Context Preview", icon: "pi pi-eye", to: "/staff/context-preview", perms: ["staff.ai.view"] },
      { label: "AI Tools", icon: "pi pi-wrench", to: "/staff/tools", perms: ["staff.ai.view"] },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Feature Flags", icon: "pi pi-flag", to: "/staff/feature-flags", perms: ["staff.flags.view"] },
      { label: "Permissions", icon: "pi pi-key", to: "/staff/permissions", perms: ["staff.rbac.view"] },
      { label: "Roles", icon: "pi pi-users", to: "/staff/roles", perms: ["staff.rbac.view"] },
      { label: "Staff Users", icon: "pi pi-id-card", to: "/staff/users", perms: ["staff.users.view"] },
    ],
  },
];

const navSections = computed(() =>
  allSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasAnyPermission(...item.perms)),
    }))
    .filter((section) => section.items.length > 0)
);

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

    <Transition name="sidebar">
      <aside
        v-if="sessionState.isSidebarOpen"
        class="bg-surface border-r border-border flex flex-col shrink-0 overflow-hidden z-50
               fixed inset-y-0 left-0 w-64 md:relative md:w-60 h-full md:h-auto"
      >
        <div class="p-5 border-b border-border flex items-center justify-between">
          <div>
            <div class="text-xs font-semibold text-muted uppercase tracking-wider">Admin Portal</div>
            <div class="text-lg font-bold mt-1">PRISM Staff</div>
          </div>
          <button class="md:hidden text-muted hover:text-accent p-1" @click="sessionState.isSidebarOpen = false">
            <i class="pi pi-times text-lg" />
          </button>
        </div>

        <nav class="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
          <template v-for="(section, idx) in navSections" :key="section.title || idx">
            <div v-if="section.title" class="text-[11px] font-semibold text-muted uppercase tracking-wider px-3 mt-4 mb-1">
              {{ section.title }}
            </div>
            <RouterLink
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              :class="['sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm no-underline text-slate-700 hover:bg-surface-hover transition-colors', { 'sidebar-link-active': isNavActive(item.to) }]"
              @click="closeSidebarOnMobile"
            >
              <i :class="item.icon" class="text-base w-5 text-center text-muted" />
              {{ item.label }}
            </RouterLink>
          </template>
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

    <main class="flex-1 overflow-x-hidden relative min-w-0">
      <div class="p-4 md:p-6 max-w-7xl mx-auto">
        <RouterView />
      </div>
    </main>
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
</style>
