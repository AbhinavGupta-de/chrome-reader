import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  CUSTOM_THEMES_STORAGE_KEY,
} from "../../src/newtab/lib/themes/storage";
import type { CustomThemeDef } from "../../src/newtab/lib/themes/types";

const SAMPLE_CUSTOM_THEME: CustomThemeDef = {
  id: "custom-abc",
  name: "My Theme",
  mode: "dark",
  pdfTint: "dark",
  baseId: "dark",
  tokens: { cream: "#101010" },
  createdAt: 1_700_000_000_000,
  isCustom: true,
};

beforeEach(async () => {
  // Clear the stub store between tests so they don't bleed.
  await chrome.storage.local.set({ [CUSTOM_THEMES_STORAGE_KEY]: [] });
});

describe("custom theme storage", () => {
  it("returnsEmptyListWhenNothingStored", async () => {
    await chrome.storage.local.set({ [CUSTOM_THEMES_STORAGE_KEY]: undefined });

    const themes = await loadCustomThemes();

    expect(themes).toEqual([]);
  });

  it("persistsSavedThemeAndReturnsItOnNextLoad", async () => {
    await saveCustomTheme(SAMPLE_CUSTOM_THEME);

    const themes = await loadCustomThemes();

    expect(themes).toHaveLength(1);
    expect(themes[0]).toEqual(SAMPLE_CUSTOM_THEME);
  });

  it("replacesExistingThemeWhenSavingWithSameId", async () => {
    await saveCustomTheme(SAMPLE_CUSTOM_THEME);

    await saveCustomTheme({ ...SAMPLE_CUSTOM_THEME, name: "Renamed" });

    const themes = await loadCustomThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0].name).toBe("Renamed");
  });

  it("removesThemeById", async () => {
    await saveCustomTheme(SAMPLE_CUSTOM_THEME);

    await deleteCustomTheme(SAMPLE_CUSTOM_THEME.id);

    expect(await loadCustomThemes()).toEqual([]);
  });

  it("usesDocumentedStorageKey", () => {
    expect(CUSTOM_THEMES_STORAGE_KEY).toBe("custom_themes");
  });
});
