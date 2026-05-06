/**
 * Synchronous AI client factory.
 *
 * Selection rules (see spec §8.4):
 *   1. If BYOK is configured (active provider has a non-empty key) →
 *      direct provider client with the user's key + optional model
 *      override.
 *   2. Else if signed in → server fallback client.
 *   3. Else → throw with a user-facing message.
 *
 * The router relies on `byok-cache` being populated before the first call
 * — `useAppBootstrap` invokes `loadByokIntoCache()` during mount.
 */

import type { AiClient, AiProvider } from "./types";
import { getCachedByok } from "./byok-cache";
import { getConfiguredProvider } from "./byok-helpers";
import { isAuthenticated } from "../http";
import { createServerClient } from "./server";
import { createAnthropicClient } from "./anthropic";
import { createOpenAiClient } from "./openai";
import { createGoogleClient } from "./google";
import { createOpenRouterClient } from "./openrouter";

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI not configured. Add an API key in Settings → AI Keys, or sign in with Google.";

function createDirectClient(
  provider: AiProvider,
  apiKey: string,
  modelOverride: string | undefined,
): AiClient {
  switch (provider) {
    case "anthropic":
      return createAnthropicClient(apiKey, modelOverride);
    case "openai":
      return createOpenAiClient(apiKey, modelOverride);
    case "google":
      return createGoogleClient(apiKey, modelOverride);
    case "openrouter":
      return createOpenRouterClient(apiKey, modelOverride);
  }
}

export function getAiClient(bookHash: string | null): AiClient {
  const byok = getCachedByok();
  const configuredProvider = getConfiguredProvider(byok);

  if (configuredProvider) {
    const apiKey = byok.keys[configuredProvider];
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      // getConfiguredProvider already filtered this case, but TS narrows
      // better with an explicit check and it future-proofs against bugs.
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }
    const modelOverride = byok.models[configuredProvider];
    return createDirectClient(configuredProvider, apiKey, modelOverride);
  }

  if (isAuthenticated()) {
    return createServerClient(bookHash);
  }

  throw new Error(AI_NOT_CONFIGURED_MESSAGE);
}
