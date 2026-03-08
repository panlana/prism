/**
 * OpenAI Responses API gateway.
 *
 * Drop-in alternative to openrouter.ts — same ChatCompletionOptions /
 * ChatCompletionResult interface so callers don't need to change.
 *
 * Uses the OpenAI Node SDK `responses.create()` endpoint which gives us
 * automatic prompt caching on identical prefixes.
 */

import OpenAI from "openai";

import { env } from "../config/env.js";
import { recordAiUsageEvent } from "../services/ai-usage.js";
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  ChatUsageDetails,
  ContentPart,
  ToolCall,
} from "./openrouter.js";
import type { ToolDefinition } from "./tools.js";

// ---------------------------------------------------------------------------
// Message conversion: ChatMessage[] → Responses API input items
// ---------------------------------------------------------------------------

type ResponsesInput = OpenAI.Responses.ResponseInputItem;

function convertMessages(messages: ChatMessage[]): {
  input: ResponsesInput[];
} {
  const input: ResponsesInput[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string"
        ? msg.content
        : (msg.content as ContentPart[])
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("\n");
      input.push({ role: "system", content: text });
      continue;
    }

    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        input.push({ role: "user", content: msg.content });
      } else {
        // Multi-part content (text + images)
        const parts: OpenAI.Responses.ResponseInputContent[] = [];
        for (const p of msg.content as ContentPart[]) {
          if (p.type === "text") {
            parts.push({ type: "input_text", text: p.text });
          } else if (p.type === "image_url") {
            parts.push({
              type: "input_image",
              image_url: p.image_url.url,
              detail: p.image_url.detail ?? "auto",
            });
          }
        }
        input.push({ role: "user", content: parts });
      }
      continue;
    }

    if (msg.role === "assistant") {
      // If the assistant message has tool_calls, emit function_call items
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          input.push({
            type: "function_call",
            id: tc.id,
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          } as ResponsesInput);
        }
      }
      // If there's text content too, add it
      if (msg.content && typeof msg.content === "string" && msg.content.trim()) {
        input.push({
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: msg.content }],
        } as ResponsesInput);
      }
      continue;
    }

    if (msg.role === "tool") {
      // Tool results → function_call_output
      input.push({
        type: "function_call_output",
        call_id: msg.tool_call_id ?? "",
        output: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      });
      continue;
    }
  }

  return { input };
}

// ---------------------------------------------------------------------------
// Tool conversion: ToolDefinition[] → Responses API function tools
// ---------------------------------------------------------------------------

function convertTools(
  tools: ToolDefinition[]
): OpenAI.Responses.FunctionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters as OpenAI.Responses.FunctionTool["parameters"],
    strict: false,
  }));
}

// ---------------------------------------------------------------------------
// Response extraction
// ---------------------------------------------------------------------------

interface ResponsesUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

function normalizeUsage(usage: ResponsesUsage | null | undefined): ChatUsageDetails {
  return {
    promptTokens: usage?.input_tokens ?? 0,
    promptCachedTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
    promptCacheWriteTokens: 0,
    promptAudioTokens: 0,
    completionTokens: usage?.output_tokens ?? 0,
    completionAudioTokens: 0,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    cost: null,
    cacheDiscount: null,
    raw: JSON.parse(JSON.stringify(usage ?? {})) as Record<string, unknown>,
  };
}

function messageTextLength(msg: ChatMessage): number {
  if (typeof msg.content === "string") return msg.content.length;
  return (msg.content as ContentPart[]).reduce((sum, p) => {
    if (p.type === "text") return sum + p.text.length;
    return sum + 100; // estimate for images
  }, 0);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function chatCompletionOpenAI(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requestedModel = options.model ?? env.OPENAI_MODEL ?? "gpt-5-mini";
  const startedAt = Date.now();
  const inputCharacters = options.messages.reduce(
    (sum, m) => sum + messageTextLength(m),
    0
  );
  const messageCount = options.messages.length;
  const toolDefinitionCount = options.tools?.length ?? 0;

  const openai = new OpenAI({ apiKey });
  const { input } = convertMessages(options.messages);
  const tools = options.tools?.length ? convertTools(options.tools) : undefined;

  let loggedFailure = false;

  try {
    const stream = await openai.responses.create({
      model: requestedModel,
      input,
      ...(tools ? { tools } : {}),
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      text: { verbosity: "low" },
      store: true,
      stream: true,
    });

    // Accumulate streamed output
    let textContent = "";
    const toolCalls: ToolCall[] = [];
    let streamUsage: ResponsesUsage | null = null;
    let streamModel: string | null = null;
    let responseId: string | null = null;

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const delta = event.delta ?? "";
        textContent += delta;
        if (delta && options.onDelta) options.onDelta(delta);
      }

      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        const item = event.item;
        toolCalls.push({
          id: item.call_id,
          type: "function",
          function: {
            name: item.name,
            arguments: item.arguments,
          },
        });
      }

      if (event.type === "response.completed" && event.response) {
        streamUsage = event.response.usage as ResponsesUsage | null;
        streamModel = event.response.model;
        responseId = event.response.id;
      }
    }

    const usage = streamUsage;
    console.log(`[OpenAI] ${requestedModel} | ${usage?.input_tokens ?? 0} in (${usage?.input_tokens_details?.cached_tokens ?? 0} cached) → ${usage?.output_tokens ?? 0} out`);
    const usageDetails = normalizeUsage(usage);
    const latencyMs = Date.now() - startedAt;

    const outputCharacters =
      textContent.length +
      toolCalls.reduce(
        (sum, tc) =>
          sum + tc.id.length + tc.function.name.length + tc.function.arguments.length,
        0
      );

    await recordAiUsageEvent({
      gateway: "OPENAI",
      provider: "openai",
      operation: options.usageContext?.operation ?? "chat_completion",
      surface: options.usageContext?.surface ?? "unspecified",
      status: "SUCCESS",
      model: streamModel ?? requestedModel,
      requestedModel,
      userType: options.usageContext?.userType,
      agencyId: options.usageContext?.agencyId,
      userId: options.usageContext?.userId,
      insuredAccountId: options.usageContext?.insuredAccountId,
      policyId: options.usageContext?.policyId,
      reviewSessionId: options.usageContext?.reviewSessionId,
      route: options.usageContext?.route,
      screen: options.usageContext?.screen,
      providerRequestId: responseId ?? "",
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
      usage: usageDetails.raw,
      meta: {
        request: {
          messageCount,
          toolDefinitionCount,
          hasTools: toolDefinitionCount > 0,
        },
        response: {
          toolCallNames: toolCalls.map((tc) => tc.function.name),
          toolCallCount: toolCalls.length,
        },
        context: options.usageContext?.meta ?? {},
      },
    });

    return {
      content: textContent,
      model: streamModel ?? requestedModel,
      toolCalls,
      providerRequestId: responseId ?? "",
      usage: {
        promptTokens: usageDetails.promptTokens,
        completionTokens: usageDetails.completionTokens,
        totalTokens: usageDetails.totalTokens,
      },
      usageDetails,
    };
  } catch (error) {
    if (!loggedFailure) {
      const latencyMs = Date.now() - startedAt;
      await recordAiUsageEvent({
        gateway: "OPENAI",
        provider: "openai",
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
          request: { messageCount, toolDefinitionCount, hasTools: toolDefinitionCount > 0 },
          context: options.usageContext?.meta ?? {},
        },
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown AI error.",
      });
    }

    throw error;
  }
}
