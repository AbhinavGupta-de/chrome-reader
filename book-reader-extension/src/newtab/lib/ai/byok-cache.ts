/**
 * Module-level synchronous cache for the user's BYOK config.
 *
 * The AI router (`getAiClient`) is sync — React components and callbacks
 * call it without an `await`. Reading from `chrome.storage.local` is async,
 * so we keep the latest config in this in-memory cache and refresh it on
 * three triggers:
 *   1. App bootstrap calls `loadByokIntoCache()` once on mount.
 *   2. The cache subscribes to `chrome.storage.onChanged` so writes from
 *      other tabs/windows propagate.
 *   3. `useByok` calls `setCachedByok` immediately when the local React
 *      state mutates (so the router sees the change in the same tick the
 *      user made it).
 */

import type { AiProvider } from "./types";

export interface ByokConfig {
  activeProvider: AiProvider | null;
  keys: Partial<Record<AiProvider, string>>;
  models: Partial<Record<AiProvider, string>>;
}

export const BYOK_STORAGE_KEY = "byok";

const EMPTY_BYOK_CONFIG: ByokConfig = {
  activeProvider: null,
  keys: {},
  models: {},
};

let cachedByok: ByokConfig = EMPTY_BYOK_CONFIG;
let installedListener: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null = null;

function normalizeStoredByok(stored: unknown): ByokConfig {
  if (!stored || typeof stored !== "object") return { ...EMPTY_BYOK_CONFIG };
  const candidate = stored as Partial<ByokConfig>;
  return {
    activeProvider: candidate.activeProvider ?? null,
    keys: { ...(candidate.keys ?? {}) },
    models: { ...(candidate.models ?? {}) },
  };
}

export function getCachedByok(): ByokConfig {
  return cachedByok;
}

export function setCachedByok(next: ByokConfig): void {
  cachedByok = next;
}

export function getEmptyByokConfig(): ByokConfig {
  return { ...EMPTY_BYOK_CONFIG, keys: {}, models: {} };
}

export async function loadByokIntoCache(): Promise<void> {
  const stored = await chrome.storage.local.get(BYOK_STORAGE_KEY);
  setCachedByok(normalizeStoredByok(stored[BYOK_STORAGE_KEY]));
  installStorageChangeSubscription();
}

function installStorageChangeSubscription(): void {
  // Replace any prior listener (test stubs may have wiped the listener list
  // between runs). Removing the previous handle is a no-op when the array
  // is already empty, so this is safe for both first-install and re-install.
  if (installedListener) {
    chrome.storage.onChanged.removeListener(installedListener);
  }
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== "local") return;
    const change = changes[BYOK_STORAGE_KEY];
    if (!change) return;
    setCachedByok(normalizeStoredByok(change.newValue));
  };
  installedListener = listener;
  chrome.storage.onChanged.addListener(listener);
}
