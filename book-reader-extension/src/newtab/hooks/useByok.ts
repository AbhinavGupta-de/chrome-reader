/**
 * React hook that mirrors the BYOK config to local state, persists writes
 * to `chrome.storage.local`, and keeps the synchronous `byok-cache` in
 * lockstep so the AI router (called outside React context) sees the same
 * value the UI just rendered.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BYOK_STORAGE_KEY,
  getCachedByok,
  getEmptyByokConfig,
  setCachedByok,
  type ByokConfig,
} from "../lib/ai/byok-cache";
import type { AiProvider } from "../lib/ai/types";

export interface UseByokResult {
  byok: ByokConfig;
  setActiveProvider: (provider: AiProvider | null) => void;
  setKey: (provider: AiProvider, apiKey: string) => void;
  setModel: (provider: AiProvider, model: string | null) => void;
  clearAllKeys: () => void;
}

function persistByok(next: ByokConfig): Promise<void> {
  return chrome.storage.local.set({ [BYOK_STORAGE_KEY]: next });
}

function readStoredByok(): ByokConfig | null {
  const cached = getCachedByok();
  if (
    cached.activeProvider !== null ||
    Object.keys(cached.keys).length > 0 ||
    Object.keys(cached.models).length > 0
  ) {
    return cached;
  }
  return null;
}

export function useByok(): UseByokResult {
  const [byok, setByokState] = useState<ByokConfig>(
    () => readStoredByok() ?? getEmptyByokConfig(),
  );
  const byokRef = useRef<ByokConfig>(byok);

  useEffect(() => {
    byokRef.current = byok;
  }, [byok]);

  // Sync from chrome.storage on mount in case the cache was empty when this
  // hook first ran (e.g. bootstrap fired in parallel with the first render).
  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(BYOK_STORAGE_KEY).then((result) => {
      if (cancelled) return;
      const stored = result[BYOK_STORAGE_KEY] as ByokConfig | undefined;
      if (!stored) return;
      const normalized: ByokConfig = {
        activeProvider: stored.activeProvider ?? null,
        keys: { ...(stored.keys ?? {}) },
        models: { ...(stored.models ?? {}) },
      };
      setCachedByok(normalized);
      setByokState(normalized);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-tab sync.
  useEffect(() => {
    const handleStorageChanged = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ): void => {
      if (areaName !== "local") return;
      const change = changes[BYOK_STORAGE_KEY];
      if (!change) return;
      const next = (change.newValue as ByokConfig | undefined) ?? getEmptyByokConfig();
      const normalized: ByokConfig = {
        activeProvider: next.activeProvider ?? null,
        keys: { ...(next.keys ?? {}) },
        models: { ...(next.models ?? {}) },
      };
      setCachedByok(normalized);
      setByokState(normalized);
    };
    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, []);

  const writeAndPersist = useCallback((next: ByokConfig): void => {
    byokRef.current = next;
    setCachedByok(next);
    setByokState(next);
    void persistByok(next);
  }, []);

  const setActiveProvider = useCallback(
    (provider: AiProvider | null): void => {
      writeAndPersist({ ...byokRef.current, activeProvider: provider });
    },
    [writeAndPersist],
  );

  const setKey = useCallback(
    (provider: AiProvider, apiKey: string): void => {
      const trimmed = apiKey.trim();
      const nextKeys = { ...byokRef.current.keys };
      if (trimmed.length === 0) {
        delete nextKeys[provider];
      } else {
        nextKeys[provider] = trimmed;
      }
      writeAndPersist({ ...byokRef.current, keys: nextKeys });
    },
    [writeAndPersist],
  );

  const setModel = useCallback(
    (provider: AiProvider, model: string | null): void => {
      const nextModels = { ...byokRef.current.models };
      if (model === null || model.length === 0) {
        delete nextModels[provider];
      } else {
        nextModels[provider] = model;
      }
      writeAndPersist({ ...byokRef.current, models: nextModels });
    },
    [writeAndPersist],
  );

  const clearAllKeys = useCallback((): void => {
    writeAndPersist({ activeProvider: null, keys: {}, models: {} });
  }, [writeAndPersist]);

  return { byok, setActiveProvider, setKey, setModel, clearAllKeys };
}
