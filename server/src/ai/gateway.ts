/**
 * AI Gateway dispatcher.
 *
 * Routes chatCompletion calls to either OpenRouter or OpenAI based on
 * the AI_GATEWAY env var. All callers import from here instead of
 * directly from openrouter.ts or openai.ts.
 */

import { env } from "../config/env.js";
import { chatCompletion as chatCompletionOpenRouter } from "./openrouter.js";
import { chatCompletionOpenAI } from "./openai.js";
import type { ChatCompletionOptions, ChatCompletionResult } from "./openrouter.js";

export type { ChatCompletionOptions, ChatCompletionResult } from "./openrouter.js";
export type {
  ChatMessage,
  ChatCompletionUsageContext,
  ChatUsageDetails,
  ContentPart,
  ContentPartImage,
  ContentPartText,
  ToolCall,
} from "./openrouter.js";

export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  if (env.AI_GATEWAY === "openai") {
    return chatCompletionOpenAI(options);
  }
  return chatCompletionOpenRouter(options);
}
