import type { UserType } from "@prisma/client";

import { env } from "../config/env.js";
import { recordAiUsageEvent } from "../services/ai-usage.js";
import type { ToolDefinition } from "./tools.js";

export interface ContentPartText {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" } | undefined;
}

export interface ContentPartImage {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type ContentPart = ContentPartText | ContentPartImage;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: ToolCall[] | undefined;
  tool_call_id?: string | undefined;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionOptions {
  model?: string | undefined;
  messages: ChatMessage[];
  tools?: ToolDefinition[] | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  usageContext?: ChatCompletionUsageContext | undefined;
  /** Called with each text chunk as it arrives from the model (streaming). */
  onDelta?: ((delta: string) => void) | undefined;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  toolCalls: ToolCall[];
  providerRequestId?: string | undefined;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  usageDetails: ChatUsageDetails;
}

export interface ChatCompletionUsageContext {
  operation: string;
  surface: string;
  userType?: UserType | undefined;
  agencyId?: string | undefined;
  userId?: string | undefined;
  insuredAccountId?: string | undefined;
  policyId?: string | undefined;
  reviewSessionId?: string | undefined;
  route?: string | undefined;
  screen?: string | undefined;
  meta?: Record<string, unknown> | undefined;
}

export interface ChatUsageDetails {
  promptTokens: number;
  promptCachedTokens: number;
  promptCacheWriteTokens: number;
  promptAudioTokens: number;
  completionTokens: number;
  completionAudioTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  cost: number | null;
  cacheDiscount: number | null;
  raw: Record<string, unknown>;
}

interface ProviderUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
  };
  cost?: number | string;
}

function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function inferProvider(model: string | undefined): string | undefined {
  if (!model) {
    return undefined;
  }

  const [provider] = model.split("/", 1);
  return provider || undefined;
}

function messageTextLength(message: ChatMessage): number {
  const toolCallLength = (message.tool_calls ?? []).reduce((sum, toolCall) => {
    return (
      sum +
      toolCall.id.length +
      toolCall.function.name.length +
      toolCall.function.arguments.length
    );
  }, 0);

  let contentLength: number;
  if (typeof message.content === "string") {
    contentLength = message.content.length;
  } else {
    contentLength = message.content.reduce((sum, part) => {
      if (part.type === "text") return sum + part.text.length;
      // Image URLs are large base64 strings; estimate at 100 chars for tracking
      return sum + 100;
    }, 0);
  }

  return contentLength + toolCallLength + (message.tool_call_id?.length ?? 0);
}

function normalizeUsage(
  usage: ProviderUsage | undefined,
  cacheDiscount: unknown
): ChatUsageDetails {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    promptCachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    promptCacheWriteTokens: usage?.prompt_tokens_details?.cache_write_tokens ?? 0,
    promptAudioTokens: usage?.prompt_tokens_details?.audio_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    completionAudioTokens: usage?.completion_tokens_details?.audio_tokens ?? 0,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    cost: toFiniteNumber(usage?.cost) ?? null,
    cacheDiscount: toFiniteNumber(cacheDiscount) ?? null,
    raw: JSON.parse(JSON.stringify(usage ?? {})) as Record<string, unknown>,
  };
}

/**
 * Apply prompt caching markers to messages.
 * Marks the system message and the conversation history boundary with
 * cache_control so the stable prefix is cached across multi-turn conversations.
 * OpenRouter passes these through for providers that support it (Anthropic,
 * DeepSeek, etc.) and ignores them for others.
 */
function applyCacheControl(
  messages: ChatMessage[]
): ChatMessage[] {
  return messages.map((msg, i) => {
    // Mark the system message for caching (largest stable block)
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : null;
      if (text) {
        return {
          ...msg,
          content: [
            { type: "text" as const, text, cache_control: { type: "ephemeral" as const } },
          ],
        };
      }
    }

    // Mark the second-to-last user message for caching (conversation history boundary)
    // This caches system + history, so only the latest turn is uncached
    if (msg.role === "user" && i < messages.length - 1) {
      const nextUserIdx = messages.findIndex((m, j) => j > i && m.role === "user");
      if (nextUserIdx === messages.length - 1) {
        // This is the second-to-last user message
        const text = typeof msg.content === "string" ? msg.content : null;
        if (text) {
          return {
            ...msg,
            content: [
              { type: "text" as const, text, cache_control: { type: "ephemeral" as const } },
            ],
          };
        }
      }
    }

    return msg;
  });
}

export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  const requestedModel =
    options.model ?? env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-20250514";
  const startedAt = Date.now();
  const inputCharacters = options.messages.reduce((sum, message) => {
    return sum + messageTextLength(message);
  }, 0);
  const messageCount = options.messages.length;
  const toolDefinitionCount = options.tools?.length ?? 0;

  const cachedMessages = applyCacheControl(options.messages);

  const body: Record<string, unknown> = {
    model: requestedModel,
    messages: cachedMessages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["HTTP-Referer"] = "https://prism-insurance.app";
    headers["X-Title"] = "PRISM Policy Review";
  }

  let loggedFailure = false;

  try {
    const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const latencyMs = Date.now() - startedAt;

      await recordAiUsageEvent({
        gateway: "OPENROUTER",
        provider: inferProvider(requestedModel),
        operation: options.usageContext?.operation ?? "chat_completion",
        surface: options.usageContext?.surface ?? "unspecified",
        status: "ERROR",
        model: requestedModel,
        requestedModel,
        userType: options.usageContext?.userType,
        agencyId: options.usageContext?.agencyId,
        userId: options.usageContext?.userId,
        insuredAccountId: options.usageContext?.insuredAccountId,
        policyId: options.usageContext?.policyId,
        reviewSessionId: options.usageContext?.reviewSessionId,
        route: options.usageContext?.route,
        screen: options.usageContext?.screen,
        latencyMs,
        messageCount,
        inputCharacters,
        maxTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        meta: {
          request: {
            messageCount,
            toolDefinitionCount,
            hasTools: toolDefinitionCount > 0,
            baseUrl: env.OPENROUTER_BASE_URL,
          },
          context: options.usageContext?.meta ?? {},
        },
        errorCode: `HTTP_${response.status}`,
        errorMessage: errorBody,
      });

      loggedFailure = true;

      throw new Error(
        `OpenRouter API error (${response.status}): ${errorBody}`
      );
    }

    const data = (await response.json()) as {
      id?: string;
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: ToolCall[];
        };
      }>;
      model: string;
      usage?: ProviderUsage;
      cache_discount?: number | string;
    };

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error("OpenRouter returned no choices.");
    }

    const content = stripThinkingTags(choice.message.content ?? "");
    const toolCalls = choice.message.tool_calls ?? [];
    const usageDetails = normalizeUsage(data.usage, data.cache_discount);
    const resolvedModel = data.model || requestedModel;
    const latencyMs = Date.now() - startedAt;
    const outputCharacters =
      content.length +
      toolCalls.reduce((sum, toolCall) => {
        return (
          sum +
          toolCall.id.length +
          toolCall.function.name.length +
          toolCall.function.arguments.length
        );
      }, 0);

    await recordAiUsageEvent({
      gateway: "OPENROUTER",
      provider: inferProvider(resolvedModel) ?? inferProvider(requestedModel),
      operation: options.usageContext?.operation ?? "chat_completion",
      surface: options.usageContext?.surface ?? "unspecified",
      status: "SUCCESS",
      model: resolvedModel,
      requestedModel,
      userType: options.usageContext?.userType,
      agencyId: options.usageContext?.agencyId,
      userId: options.usageContext?.userId,
      insuredAccountId: options.usageContext?.insuredAccountId,
      policyId: options.usageContext?.policyId,
      reviewSessionId: options.usageContext?.reviewSessionId,
      route: options.usageContext?.route,
      screen: options.usageContext?.screen,
      providerRequestId: data.id,
      latencyMs,
      messageCount,
      inputCharacters,
      outputCharacters,
      toolCallCount: toolCalls.length,
      inputTokens: usageDetails.promptTokens,
      inputCachedTokens: usageDetails.promptCachedTokens,
      inputCacheWriteTokens: usageDetails.promptCacheWriteTokens,
      inputAudioTokens: usageDetails.promptAudioTokens,
      outputTokens: usageDetails.completionTokens,
      outputAudioTokens: usageDetails.completionAudioTokens,
      reasoningTokens: usageDetails.reasoningTokens,
      totalTokens: usageDetails.totalTokens,
      maxTokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      ...(usageDetails.cost !== null ? { providerCost: usageDetails.cost } : {}),
      ...(usageDetails.cacheDiscount !== null
        ? { cacheDiscount: usageDetails.cacheDiscount }
        : {}),
      usage: usageDetails.raw,
      meta: {
        request: {
          messageCount,
          toolDefinitionCount,
          hasTools: toolDefinitionCount > 0,
          baseUrl: env.OPENROUTER_BASE_URL,
        },
        response: {
          toolCallNames: toolCalls.map((toolCall) => toolCall.function.name),
          toolCallCount: toolCalls.length,
        },
        context: options.usageContext?.meta ?? {},
      },
    });

    return {
      content,
      model: resolvedModel,
      toolCalls,
      providerRequestId: data.id,
      usage: {
        promptTokens: usageDetails.promptTokens,
        completionTokens: usageDetails.completionTokens,
        totalTokens: usageDetails.totalTokens,
      },
      usageDetails,
    };
  } catch (error) {
    if (!loggedFailure) {
      await recordAiUsageEvent({
        gateway: "OPENROUTER",
        provider: inferProvider(requestedModel),
        operation: options.usageContext?.operation ?? "chat_completion",
        surface: options.usageContext?.surface ?? "unspecified",
        status: "ERROR",
        model: requestedModel,
        requestedModel,
        userType: options.usageContext?.userType,
        agencyId: options.usageContext?.agencyId,
        userId: options.usageContext?.userId,
        insuredAccountId: options.usageContext?.insuredAccountId,
        policyId: options.usageContext?.policyId,
        reviewSessionId: options.usageContext?.reviewSessionId,
        route: options.usageContext?.route,
        screen: options.usageContext?.screen,
        latencyMs: Date.now() - startedAt,
        messageCount,
        inputCharacters,
        maxTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        meta: {
          request: {
            messageCount,
            toolDefinitionCount,
            hasTools: toolDefinitionCount > 0,
            baseUrl: env.OPENROUTER_BASE_URL,
          },
          context: options.usageContext?.meta ?? {},
        },
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown AI error.",
      });
    }

    throw error;
  }
}
