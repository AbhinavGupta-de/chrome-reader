/**
 * OpenRouter direct-from-browser client.
 *
 * OpenRouter is intentionally OpenAI-compatible — same Chat Completions
 * shape. The optional `HTTP-Referer` and `X-Title` headers help
 * OpenRouter identify the calling app on their dashboard.
 */

import type { AiClient } from "./types";
import { buildAiClientFromCaller, resolveModel } from "./build-client";
import type { PromptPair } from "./prompts";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
export const OPENROUTER_REFERER = "https://instant-book-reader.local";
export const OPENROUTER_TITLE = "Instant Book Reader";

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterChatResponse {
  choices?: OpenRouterChoice[];
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  prompt: PromptPair,
): Promise<string> {
  const requestPayload = {
    model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterChatResponse;
  return data.choices?.[0]?.message?.content ?? "";
}

export function createOpenRouterClient(
  apiKey: string,
  modelOverride?: string,
): AiClient {
  const model = resolveModel(modelOverride, OPENROUTER_DEFAULT_MODEL);
  return buildAiClientFromCaller((prompt) => callOpenRouter(apiKey, model, prompt));
}
