import { reactive } from "vue";

import { login } from "./api";
import type { LoginMode, SessionResponse } from "./types";

const storageKey = "prism-v4-session";

function readStoredSession() {
  const raw = window.localStorage.getItem(storageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionResponse;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export const sessionState = reactive<{
  session: SessionResponse | null;
  isSidebarOpen: boolean;
}>({
  session: readStoredSession(),
  isSidebarOpen: true
});

export function toggleSidebar() {
  sessionState.isSidebarOpen = !sessionState.isSidebarOpen;
}

export function setSession(session: SessionResponse) {
  sessionState.session = session;
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession() {
  sessionState.session = null;
  window.localStorage.removeItem(storageKey);
}

export async function signIn(input: {
  mode: LoginMode;
  email: string;
  password?: string;
  token?: string;
}) {
  const session = await login(input);
  setSession(session);
  return session;
}

