/**
 * OpenAI Chat Completions direct-from-browser client.
 *
 * We use Chat Completions (not the newer Responses API) so we share one
 * request shape with OpenRouter — see the openai-endpoint-guard test for
 * the explicit assertion. If OpenAI deprecates Chat Completions for the
 * configured default model, that test fails loudly and the spec must be
 * revisited (Responses API has different request/response shapes).
 */

import type { AiClient } from "./types";
import { buildAiClientFromCaller, resolveModel } from "./build-client";
import type { PromptPair } from "./prompts";

export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_DEFAULT_MODEL = "gpt-5.5";

interface OpenAiChoice {
  message?: { content?: string };
}

interface OpenAiChatResponse {
  choices?: OpenAiChoice[];
}

async function callOpenAi(
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

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as OpenAiChatResponse;
  return data.choices?.[0]?.message?.content ?? "";
}

export function createOpenAiClient(
  apiKey: string,
  modelOverride?: string,
): AiClient {
  const model = resolveModel(modelOverride, OPENAI_DEFAULT_MODEL);
  return buildAiClientFromCaller((prompt) => callOpenAi(apiKey, model, prompt));
}
