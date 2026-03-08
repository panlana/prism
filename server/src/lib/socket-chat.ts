/**
 * Socket.io chat event handlers.
 *
 * Handles streaming AI chat for the context preview panel (staff)
 * and will be extended for insured review and agency assistant flows.
 */

import type { Socket } from "socket.io";
import { z } from "zod";

import { prisma } from "./db.js";
import { assembleContext } from "../ai/context/assembler.js";
import { chatCompletion, type ChatMessage } from "../ai/gateway.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const contextChatSchema = z.object({
  requestId: z.string().min(1),
  message: z.string().trim().min(1).max(10000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).default([]),
  agent: z.string().min(1),
  agencyId: z.string().optional(),
  insuredAccountId: z.string().optional(),
  policyId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Context resolution (mirrors staff.ts resolvePreviewContext)
// ---------------------------------------------------------------------------

async function resolvePreviewContext(input: {
  agent: string;
  agencyId?: string | undefined;
  insuredAccountId?: string | undefined;
  policyId?: string | undefined;
}) {
  let agencyId = input.agencyId;
  if (!agencyId) {
    const first = await prisma.agency.findFirst({ select: { id: true } });
    agencyId = first?.id;
  }

  let policyTypeId: string | undefined;
  let carrierId: string | undefined;
  let stateId: string | undefined;
  let offeringId: string | undefined;

  if (input.policyId) {
    const policy = await prisma.policy.findUnique({
      where: { id: input.policyId },
      select: { policyTypeId: true, carrierId: true, stateId: true },
    });
    if (policy) {
      policyTypeId = policy.policyTypeId;
      carrierId = policy.carrierId ?? undefined;
      stateId = policy.stateId ?? undefined;
      if (carrierId && stateId) {
        const offering = await prisma.carrierPolicyOffering.findUnique({
          where: {
            carrierId_stateId_policyTypeId: {
              carrierId,
              stateId,
              policyTypeId,
            },
          },
          select: { id: true },
        });
        offeringId = offering?.id;
      }
    }
  }

  return { agencyId, policyTypeId, carrierId, stateId, offeringId };
}

// ---------------------------------------------------------------------------
// Event handler registration
// ---------------------------------------------------------------------------

export function registerChatHandlers(socket: Socket): void {
  const auth = socket.data.auth as { userId: string; userType: string };

  socket.on("chat:context-preview", async (payload: unknown) => {
    const parsed = contextChatSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("chat:error", {
        requestId: (payload as Record<string, unknown>)?.requestId ?? "",
        error: "Invalid request",
      });
      return;
    }

    const input = parsed.data;
    const { requestId } = input;

    try {
      // Staff-only check
      if (auth.userType !== "STAFF") {
        socket.emit("chat:error", { requestId, error: "Unauthorized" });
        return;
      }

      const resolved = await resolvePreviewContext(input);

      if (!resolved.agencyId) {
        socket.emit("chat:error", { requestId, error: "No agency found" });
        return;
      }

      const assembled = await assembleContext({
        userId: "preview",
        userType: input.agent === "insured_review" ? "INSURED" : "AGENCY",
        agencyId: resolved.agencyId,
        agent: input.agent,
        insuredAccountId: input.insuredAccountId,
        policyId: input.policyId,
        policyTypeId: resolved.policyTypeId,
        carrierId: resolved.carrierId,
        stateId: resolved.stateId,
        offeringId: resolved.offeringId,
      });

      const messages: ChatMessage[] = [
        { role: "system", content: assembled.systemPrompt },
        ...input.history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: input.message },
      ];

      const result = await chatCompletion({
        messages,
        usageContext: {
          operation: "chat_completion",
          surface: "context_preview_chat",
          userType: "STAFF",
          userId: auth.userId,
          agencyId: resolved.agencyId,
          route: "socket:chat:context-preview",
          meta: {
            agent: input.agent,
            contextBlockCount: assembled.blocks.length,
            historyLength: input.history.length,
          },
        },
        onDelta: (delta) => {
          socket.emit("chat:delta", { requestId, delta });
        },
      });

      socket.emit("chat:done", {
        requestId,
        message: result.content,
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      console.error("[Socket] chat:context-preview error:", error);
      socket.emit("chat:error", {
        requestId,
        error: error instanceof Error ? error.message : "AI request failed",
      });
    }
  });
}
