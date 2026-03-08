import type { Prisma, UserType } from "@prisma/client";

import { prisma } from "../lib/db.js";

export interface RecordAiUsageInput {
  gateway: string;
  operation: string;
  surface: string;
  status: string;
  model: string;
  requestedModel?: string | undefined;
  provider?: string | undefined;
  userType?: UserType | undefined;
  agencyId?: string | undefined;
  userId?: string | undefined;
  insuredAccountId?: string | undefined;
  policyId?: string | undefined;
  reviewSessionId?: string | undefined;
  route?: string | undefined;
  screen?: string | undefined;
  providerRequestId?: string | undefined;
  latencyMs?: number | undefined;
  messageCount?: number | undefined;
  inputCharacters?: number | undefined;
  outputCharacters?: number | undefined;
  toolCallCount?: number | undefined;
  inputTokens?: number | undefined;
  inputCachedTokens?: number | undefined;
  inputCacheWriteTokens?: number | undefined;
  inputAudioTokens?: number | undefined;
  outputTokens?: number | undefined;
  outputAudioTokens?: number | undefined;
  reasoningTokens?: number | undefined;
  totalTokens?: number | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  providerCost?: string | number | undefined;
  cacheDiscount?: string | number | undefined;
  meta?: Record<string, unknown> | undefined;
  usage?: Record<string, unknown> | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
}

function toJsonValue(
  value: Record<string, unknown>
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordAiUsageEvent(
  input: RecordAiUsageInput
): Promise<void> {
  try {
    const data: Prisma.AiUsageEventUncheckedCreateInput = {
      gateway: input.gateway,
      operation: input.operation,
      surface: input.surface,
      status: input.status,
      model: input.model,
      ...(input.requestedModel ? { requestedModel: input.requestedModel } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.userType ? { userType: input.userType } : {}),
      ...(input.agencyId ? { agencyId: input.agencyId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.insuredAccountId ? { insuredAccountId: input.insuredAccountId } : {}),
      ...(input.policyId ? { policyId: input.policyId } : {}),
      ...(input.reviewSessionId ? { reviewSessionId: input.reviewSessionId } : {}),
      ...(input.route ? { route: input.route } : {}),
      ...(input.screen ? { screen: input.screen } : {}),
      ...(input.providerRequestId
        ? { providerRequestId: input.providerRequestId }
        : {}),
      ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
      messageCount: input.messageCount ?? 0,
      inputCharacters: input.inputCharacters ?? 0,
      outputCharacters: input.outputCharacters ?? 0,
      toolCallCount: input.toolCallCount ?? 0,
      inputTokens: input.inputTokens ?? 0,
      inputCachedTokens: input.inputCachedTokens ?? 0,
      inputCacheWriteTokens: input.inputCacheWriteTokens ?? 0,
      inputAudioTokens: input.inputAudioTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      outputAudioTokens: input.outputAudioTokens ?? 0,
      reasoningTokens: input.reasoningTokens ?? 0,
      totalTokens: input.totalTokens ?? 0,
      ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      ...(input.temperature !== undefined
        ? { temperature: input.temperature }
        : {}),
      ...(input.providerCost !== undefined
        ? { providerCost: input.providerCost }
        : {}),
      ...(input.cacheDiscount !== undefined
        ? { cacheDiscount: input.cacheDiscount }
        : {}),
      ...(input.meta ? { meta: toJsonValue(input.meta) } : {}),
      ...(input.usage ? { usage: toJsonValue(input.usage) } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    };

    await prisma.aiUsageEvent.create({
      data,
    });
  } catch (error) {
    console.warn("[AI Usage] Failed to record usage event:", error);
  }
}
