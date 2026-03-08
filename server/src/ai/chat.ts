import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { assembleContext } from "./context/assembler.js";
import { chatCompletion, type ChatMessage } from "./gateway.js";
import type { ConversationContext } from "./context/types.js";

export interface StartReviewParams {
  ctx: ConversationContext;
  reviewSessionId: string;
  model?: string | undefined;
  reviewType?: string | undefined;
}

export interface SendMessageParams {
  reviewSessionId: string;
  userMessage: string;
  model?: string | undefined;
  userId?: string | undefined;
  userType?: ConversationContext["userType"] | undefined;
  agencyId?: string | undefined;
  insuredAccountId?: string | undefined;
  policyId?: string | undefined;
  meta?: Record<string, unknown> | undefined;
}

export interface ChatResponse {
  message: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function startReviewChat(
  params: StartReviewParams
): Promise<ChatResponse> {
  const { ctx, reviewSessionId } = params;
  const model = params.model;

  const assembled = await assembleContext(ctx);

  const messages: ChatMessage[] = [
    { role: "system", content: assembled.systemPrompt },
  ];

  const result = await chatCompletion({
    messages,
    ...(model ? { model } : {}),
    usageContext: {
      operation: "chat_completion",
      surface: "insured_review",
      userType: ctx.userType,
      agencyId: ctx.agencyId,
      userId: ctx.userId,
      insuredAccountId: ctx.insuredAccountId,
      policyId: ctx.policyId,
      reviewSessionId,
      route: "/api/insured/review/:policyId/start",
      meta: {
        phase: "start",
        reviewType: params.reviewType ?? null,
        policyTypeId: ctx.policyTypeId ?? null,
        carrierId: ctx.carrierId ?? null,
        stateId: ctx.stateId ?? null,
        offeringId: ctx.offeringId ?? null,
        contextBlockCount: assembled.blocks.length,
        contextBlockKeys: assembled.blocks.map((block) => block.key),
      },
    },
  });

  const transcript: ChatMessage[] = [
    ...messages,
    { role: "assistant", content: result.content },
  ];

  await prisma.reviewSession.update({
    where: { id: reviewSessionId },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      transcript: toJsonValue(transcript),
      assembledContext: toJsonValue({
        blocks: assembled.blocks.map((b) => ({
          key: b.key,
          sortOrder: b.sortOrder,
        })),
        model: result.model,
      }),
    },
  });

  return {
    message: result.content,
    model: result.model,
    usage: result.usage,
  };
}

export async function sendReviewMessage(
  params: SendMessageParams
): Promise<ChatResponse> {
  const { reviewSessionId, userMessage } = params;
  const model = params.model;

  const session = await prisma.reviewSession.findUniqueOrThrow({
    where: { id: reviewSessionId },
    select: { transcript: true, status: true },
  });

  const transcript = (session.transcript as ChatMessage[] | null) ?? [];

  transcript.push({ role: "user", content: userMessage });

  const result = await chatCompletion({
    messages: transcript,
    ...(model ? { model } : {}),
    usageContext: {
      operation: "chat_completion",
      surface: "insured_review",
      userType: params.userType ?? "INSURED",
      agencyId: params.agencyId,
      userId: params.userId,
      insuredAccountId: params.insuredAccountId,
      policyId: params.policyId,
      reviewSessionId,
      route: "/api/insured/review/:sessionId/message",
      meta: {
        phase: "message",
        ...(params.meta ? { request: params.meta } : {}),
      },
    },
  });

  transcript.push({ role: "assistant", content: result.content });

  await prisma.reviewSession.update({
    where: { id: reviewSessionId },
    data: {
      transcript: toJsonValue(transcript),
    },
  });

  return {
    message: result.content,
    model: result.model,
    usage: result.usage,
  };
}

export async function getReviewTranscript(
  reviewSessionId: string
): Promise<ChatMessage[]> {
  const session = await prisma.reviewSession.findUniqueOrThrow({
    where: { id: reviewSessionId },
    select: { transcript: true },
  });

  return (session.transcript as ChatMessage[] | null) ?? [];
}
