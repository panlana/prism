/**
 * Socket.io client singleton.
 *
 * Connects when a session exists, disconnects on logout.
 * Provides `useStreamingChat()` composable for streaming AI responses.
 */

import { watch } from "vue";
import { io, type Socket } from "socket.io-client";

import { apiBaseUrl } from "./api";
import { sessionState } from "./session";

let socket: Socket | null = null;

function getSocketUrl(): string {
  // Connect to the same host as the API (strip any path prefix)
  try {
    const url = new URL(apiBaseUrl);
    return url.origin;
  } catch {
    return apiBaseUrl;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected");
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] Connection error:", err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Auto-connect/disconnect based on session state
watch(
  () => sessionState.session,
  (session) => {
    if (session?.token) {
      connectSocket(session.token);
    } else {
      disconnectSocket();
    }
  },
  { immediate: true },
);

// ---------------------------------------------------------------------------
// Streaming chat composable
// ---------------------------------------------------------------------------

export interface StreamingChatCallbacks {
  onDelta: (delta: string) => void;
  onDone: (result: { message: string; model: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }) => void;
  onError: (error: string) => void;
}

let requestCounter = 0;

/**
 * Send a chat message and receive streaming deltas via socket.io.
 *
 * Returns a requestId that can be used to match responses,
 * and a cleanup function to remove listeners.
 */
export function sendStreamingChat(
  event: string,
  payload: Record<string, unknown>,
  callbacks: StreamingChatCallbacks,
): { requestId: string; cleanup: () => void } {
  if (!socket?.connected) {
    callbacks.onError("Not connected");
    return { requestId: "", cleanup: () => {} };
  }
  const s = socket;

  const requestId = `req_${++requestCounter}_${Date.now()}`;

  const onDelta = (data: { requestId: string; delta: string }) => {
    if (data.requestId === requestId) callbacks.onDelta(data.delta);
  };

  const onDone = (data: { requestId: string; message: string; model: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }) => {
    if (data.requestId === requestId) {
      cleanup();
      callbacks.onDone(data);
    }
  };

  const onError = (data: { requestId: string; error: string }) => {
    if (data.requestId === requestId) {
      cleanup();
      callbacks.onError(data.error);
    }
  };

  s.on("chat:delta", onDelta);
  s.on("chat:done", onDone);
  s.on("chat:error", onError);

  function cleanup() {
    s.off("chat:delta", onDelta);
    s.off("chat:done", onDone);
    s.off("chat:error", onError);
  }

  s.emit(event, { ...payload, requestId });

  return { requestId, cleanup };
}
