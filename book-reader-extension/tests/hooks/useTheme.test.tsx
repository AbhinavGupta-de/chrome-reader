import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useTheme } from "../../src/newtab/hooks/useTheme";
import { CUSTOM_THEMES_STORAGE_KEY } from "../../src/newtab/lib/themes/storage";
import type { CustomThemeDef } from "../../src/newtab/lib/themes/types";
import { resetChromeStorageStub } from "../setup";

const ACTIVE_CUSTOM_THEME_ID = "custom-active";
const ACTIVE_CUSTOM_THEME_BASE_PRESET_ID = "sepia";

function buildSeedCustomTheme(): CustomThemeDef {
  return {
    id: ACTIVE_CUSTOM_THEME_ID,
    name: "Seed Custom",
    mode: "light",
    pdfTint: "sepia",
    baseId: ACTIVE_CUSTOM_THEME_BASE_PRESET_ID,
    tokens: {},
    createdAt: 0,
    isCustom: true,
  };
}

async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  resetChromeStorageStub();
  cleanup();
});

describe("useTheme.deleteCustomTheme", () => {
  it("deletingActiveCustomThemeRevertsToItsBasePreset", async () => {
    await chrome.storage.local.set({
      [CUSTOM_THEMES_STORAGE_KEY]: [buildSeedCustomTheme()],
    });

    const { result } = renderHook(() => useTheme(ACTIVE_CUSTOM_THEME_ID));
    await flushAsyncEffects();
    expect(result.current.activeThemeId).toBe(ACTIVE_CUSTOM_THEME_ID);

    await act(async () => {
      await result.current.deleteCustomTheme(ACTIVE_CUSTOM_THEME_ID);
    });

    expect(result.current.activeThemeId).toBe(ACTIVE_CUSTOM_THEME_BASE_PRESET_ID);
    expect(result.current.customThemes).toHaveLength(0);
  });

  it("deletingNonActiveCustomThemeLeavesActiveThemeIdUnchanged", async () => {
    const otherCustomTheme: CustomThemeDef = {
      ...buildSeedCustomTheme(),
      id: "custom-unrelated",
      baseId: "dark",
    };
    await chrome.storage.local.set({
      [CUSTOM_THEMES_STORAGE_KEY]: [otherCustomTheme],
    });

    const { result } = renderHook(() => useTheme("light"));
    await flushAsyncEffects();
    expect(result.current.activeThemeId).toBe("light");

    await act(async () => {
      await result.current.deleteCustomTheme("custom-unrelated");
    });

    expect(result.current.activeThemeId).toBe("light");
  });
});
