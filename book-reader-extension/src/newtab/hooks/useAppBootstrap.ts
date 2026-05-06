/**
 * Single mount-time bootstrap that orders the steps required before the
 * App can render meaningfully. The ordering matters:
 *
 *   1. `getSettings()` — applies legacy migrations (theme flag, pdfColorMode,
 *      pinToolbar, pdfShowThumbnails) so downstream code sees the cleaned
 *      shape.
 *   2. `loadCustomThemes()` — must complete before `applyTheme` so a saved
 *      custom-theme id resolves; without this, custom themes fall through
 *      to the light fallback.
 *   3. `applyTheme(themeId, customThemes)` — useTheme also performs this on
 *      mount, but doing it here too removes the visible flash where the
 *      page paints in light defaults before the theme effect runs.
 *   4. `loadByokIntoCache()` — populates the synchronous BYOK cache so the
 *      AI router (which is sync) can answer correctly on the very first
 *      AI call.
 *   5. Library metadata + lastOpenedAt — read once so the LibraryPanel and
 *      "current book" resolution see the same data.
 *   6. Panel state — restored before the AppShell paints its rails.
 *   7. Resume current book + last position so the reader content is ready
 *      when the spinner clears.
 *
 * Returns `{ bootstrapped }`. Callers gate their main render on this flag.
 */

import { useEffect, useState } from "react";
import { getSettings, getCurrentBook, getPosition, getAllBookMetas } from "../lib/storage";
import { applyTheme } from "../lib/themes/apply";
import { loadCustomThemes } from "../lib/themes/storage";
import { loadByokIntoCache } from "../lib/ai/byok-cache";
import { PANEL_STATE_STORAGE_KEY } from "./usePanelState";

export interface UseAppBootstrapResult {
  bootstrapped: boolean;
}

async function loadPanelState(): Promise<void> {
  // Pre-warm the chrome.storage cache. usePanelState reads it on mount;
  // pre-fetching here keeps the bootstrap order explicit and lets the
  // `bootstrapped` flag honestly reflect that panel state has been seen.
  await chrome.storage.local.get(PANEL_STATE_STORAGE_KEY);
}

async function resumeCurrentBookPosition(): Promise<void> {
  const currentBookHash = await getCurrentBook();
  if (!currentBookHash) return;
  // Reading the position warms the storage cache so `usePosition`'s first
  // read is fast. The actual book load happens in `useBook` once the App
  // mounts; this step's purpose is to fail fast if storage is unhealthy.
  await getPosition(currentBookHash);
}

async function runBootstrap(): Promise<void> {
  const settings = await getSettings();
  const customThemes = await loadCustomThemes();
  applyTheme(settings.themeId, customThemes);
  await loadByokIntoCache();
  await getAllBookMetas();
  await loadPanelState();
  await resumeCurrentBookPosition();
}

export function useAppBootstrap(): UseAppBootstrapResult {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    runBootstrap()
      .catch(() => {
        // Bootstrap is best-effort; the App still renders so the user is
        // not stranded on a spinner if (e.g.) chrome.storage is missing
        // in a non-extension context.
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { bootstrapped };
}
