/**
 * Socket.io server setup and event handling.
 *
 * Provides real-time streaming for AI chat responses.
 * Auth is handled via the JWT token passed during connection.
 */

import { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "./db.js";
import { registerChatHandlers } from "./socket-chat.js";

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// ---------------------------------------------------------------------------
// Auth middleware — verify JWT on connection
// ---------------------------------------------------------------------------

interface SocketAuth {
  userId: string;
  userType: string;
}

async function authenticateSocket(socket: Socket): Promise<SocketAuth | null> {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      type: string;
    };

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, userType: true },
    });

    if (!user) return null;

    return { userId: user.id, userType: user.userType };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initSocketIO(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: "*" },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    const auth = await authenticateSocket(socket);
    if (!auth) {
      next(new Error("Authentication failed"));
      return;
    }
    socket.data.auth = auth;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.data.auth.userId} (${socket.data.auth.userType})`);

    registerChatHandlers(socket);

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.data.auth.userId}`);
    });
  });

  return io;
}
