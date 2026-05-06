/**
 * Anthropic Messages API direct-from-browser client.
 *
 * Browser-origin requests require the
 * `anthropic-dangerous-direct-browser-access: true` header — without it the
 * API rejects the request before any auth check.
 */

import type { AiClient } from "./types";
import { buildAiClientFromCaller, resolveModel } from "./build-client";
import type { PromptPair } from "./prompts";

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_API_VERSION = "2023-06-01";
export const BROWSER_DIRECT_HEADER = "anthropic-dangerous-direct-browser-access";
const ANTHROPIC_MAX_TOKENS = 1024;

interface AnthropicMessageBlock {
  type: string;
  text?: string;
}

interface AnthropicMessagesResponse {
  content?: AnthropicMessageBlock[];
}

function extractAnthropicText(data: AnthropicMessagesResponse): string {
  return (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: PromptPair,
): Promise<string> {
  const requestPayload = {
    model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      [BROWSER_DIRECT_HEADER]: "true",
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  return extractAnthropicText((await response.json()) as AnthropicMessagesResponse);
}

export function createAnthropicClient(
  apiKey: string,
  modelOverride?: string,
): AiClient {
  const model = resolveModel(modelOverride, ANTHROPIC_DEFAULT_MODEL);
  return buildAiClientFromCaller((prompt) => callAnthropic(apiKey, model, prompt));
}
