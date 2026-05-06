import { describe, it, expect, beforeEach } from "vitest";
import {
  getSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "../../src/newtab/lib/storage";

async function seedStorage(initial: Record<string, unknown>): Promise<void> {
  // Reset entire stub so leftover keys from prior tests don't bleed.
  const knownKeys = [SETTINGS_STORAGE_KEY];
  for (const key of knownKeys) {
    await chrome.storage.local.set({ [key]: undefined });
  }
  for (const [key, value] of Object.entries(initial)) {
    await chrome.storage.local.set({ [key]: value });
  }
}

beforeEach(async () => {
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: undefined });
});

describe("settings migration", () => {
  it("migratesLegacyDarkThemeFlagToThemeId", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { theme: "dark", fontSize: 18, lineHeight: 1.8 },
    });

    const settings = await getSettings();

    expect(settings.themeId).toBe("dark");
    expect("theme" in settings).toBe(false);
  });

  it("migratesLegacyLightThemeFlagToThemeId", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { theme: "light" },
    });

    const settings = await getSettings();

    expect(settings.themeId).toBe("light");
  });

  it("migratesPdfColorModeNormalToNullPdfTintOverride", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { pdfColorMode: "normal" },
    });

    const settings = await getSettings();

    expect(settings.pdfTintOverride).toBeNull();
  });

  it("migratesNonNormalPdfColorModeToMatchingPdfTintOverride", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { pdfColorMode: "sepia" },
    });

    const settings = await getSettings();

    expect(settings.pdfTintOverride).toBe("sepia");
  });

  it("dropsDeprecatedPinToolbarField", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { pinToolbar: true },
    });

    const settings = await getSettings();

    expect("pinToolbar" in settings).toBe(false);
  });

  it("dropsDeprecatedPdfShowThumbnailsAndDefaultsThumbnailStripOn", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { pdfShowThumbnails: true },
    });

    const settings = await getSettings();

    expect("pdfShowThumbnails" in settings).toBe(false);
    expect(settings.pdfShowThumbnailStrip).toBe(true);
  });

  it("preservesLegacyPdfShowThumbnailsValueOfFalse", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { pdfShowThumbnails: false },
    });

    const settings = await getSettings();

    expect("pdfShowThumbnails" in settings).toBe(false);
    expect(settings.pdfShowThumbnailStrip).toBe(false);
  });

  it("returnsDefaultSettingsWhenStorageEmpty", async () => {
    await seedStorage({});

    const settings = await getSettings();

    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("preservesNewThemeIdWhenAlsoLegacyThemePresent", async () => {
    // Edge case: settings already migrated — don't clobber themeId.
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { theme: "light", themeId: "dracula" },
    });

    const settings = await getSettings();

    expect(settings.themeId).toBe("dracula");
  });

  it("persistsMigratedShapeBackToStorageWhenLegacyFieldsWerePresent", async () => {
    await seedStorage({
      [SETTINGS_STORAGE_KEY]: { theme: "dark", pinToolbar: true, pdfColorMode: "sepia" },
    });

    await getSettings();
    // Allow the fire-and-forget write-back to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const persisted = result[SETTINGS_STORAGE_KEY] as Record<string, unknown>;

    expect("theme" in persisted).toBe(false);
    expect("pinToolbar" in persisted).toBe(false);
    expect("pdfColorMode" in persisted).toBe(false);
    expect(persisted.themeId).toBe("dark");
    expect(persisted.pdfTintOverride).toBe("sepia");
  });

  it("doesNotWriteBackWhenStoredShapeIsAlreadyClean", async () => {
    const cleanShape = { ...DEFAULT_SETTINGS, themeId: "nord" };
    await seedStorage({ [SETTINGS_STORAGE_KEY]: cleanShape });

    // Spy on storage writes.
    const storageSet = chrome.storage.local.set as unknown as { mock?: { calls: unknown[] } };
    const callCountBefore = storageSet.mock?.calls.length ?? 0;

    await getSettings();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const callCountAfter = storageSet.mock?.calls.length ?? 0;
    expect(callCountAfter).toBe(callCountBefore);
  });
});
