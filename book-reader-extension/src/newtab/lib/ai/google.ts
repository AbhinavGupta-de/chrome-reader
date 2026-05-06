/**
 * Google Gemini direct-from-browser client.
 *
 * The API key is passed via `?key=` query string; there is no
 * Authorization header. The system prompt becomes `systemInstruction`,
 * and the user prompt becomes a single `contents[].parts[].text`.
 */

import type { AiClient } from "./types";
import { buildAiClientFromCaller, resolveModel } from "./build-client";
import type { PromptPair } from "./prompts";

export const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GOOGLE_DEFAULT_MODEL = "gemini-3.1-pro-preview";

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export function buildGoogleApiUrl(model: string, apiKey: string): string {
  return `${GOOGLE_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function callGoogle(
  apiKey: string,
  model: string,
  prompt: PromptPair,
): Promise<string> {
  const requestPayload = {
    systemInstruction: { parts: [{ text: prompt.system }] },
    contents: [{ role: "user", parts: [{ text: prompt.user }] }],
  };

  const response = await fetch(buildGoogleApiUrl(model, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export function createGoogleClient(
  apiKey: string,
  modelOverride?: string,
): AiClient {
  const model = resolveModel(modelOverride, GOOGLE_DEFAULT_MODEL);
  return buildAiClientFromCaller((prompt) => callGoogle(apiKey, model, prompt));
}
