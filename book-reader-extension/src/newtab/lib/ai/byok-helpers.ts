/**
 * Single source of truth for "is BYOK actually usable right now?".
 *
 * Both the router (which picks a client) and the `useAI` hook (which
 * computes the public `available` flag) call this. Keeping the rule in
 * one place prevents the two definitions from drifting — a bug we
 * specifically guard against because the previous codebase had two
 * near-duplicate availability checks.
 */

import type { AiProvider } from "./types";
import type { ByokConfig } from "./byok-cache";

export function getConfiguredProvider(byok: ByokConfig): AiProvider | null {
  if (!byok.activeProvider) return null;
  const apiKey = byok.keys[byok.activeProvider];
  if (typeof apiKey !== "string" || apiKey.length === 0) return null;
  return byok.activeProvider;
}
