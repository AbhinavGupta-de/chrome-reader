import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { resetChromeStorageStub } from "../setup";
import { CUSTOM_THEMES_STORAGE_KEY } from "../../src/newtab/lib/themes/storage";
import { SETTINGS_STORAGE_KEY } from "../../src/newtab/lib/storage";

const applyThemeMock = vi.fn();

vi.mock("../../src/newtab/lib/themes/apply", () => ({
  applyTheme: (themeId: string, customThemes: ReadonlyArray<unknown>) =>
    applyThemeMock(themeId, customThemes),
}));

beforeEach(() => {
  resetChromeStorageStub();
  applyThemeMock.mockClear();
});

describe("useAppBootstrap", () => {
  it("resolvesBootstrappedFlagToTrueAfterMount", async () => {
    const { useAppBootstrap } = await import("../../src/newtab/hooks/useAppBootstrap");

    const { result } = renderHook(() => useAppBootstrap());

    expect(result.current.bootstrapped).toBe(false);
    await waitFor(() => expect(result.current.bootstrapped).toBe(true));
  });

  it("appliesCustomThemeWithCustomThemesArrayPopulatedNotEmpty", async () => {
    const customThemeId = "custom-test-1";
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: {
        themeId: customThemeId,
        fontSize: 18,
        lineHeight: 1.8,
        fontFamily: "'DM Sans', Arial, sans-serif",
        translateTo: "en",
        pdfViewMode: "continuous",
        pdfTintOverride: null,
        pdfShowThumbnailStrip: true,
        pdfShowViewMode: true,
        pdfShowPageNav: true,
        pdfShowColorMode: true,
        pdfShowZoom: true,
        showLeftRail: true,
        showRightRail: true,
      },
    });
    await chrome.storage.local.set({
      [CUSTOM_THEMES_STORAGE_KEY]: [
        {
          id: customThemeId,
          name: "Test Custom",
          mode: "dark",
          baseId: "dark",
          tokens: {},
          pdfTint: "dark",
          createdAt: 1,
          isCustom: true,
        },
      ],
    });

    const { useAppBootstrap } = await import("../../src/newtab/hooks/useAppBootstrap");

    const { result } = renderHook(() => useAppBootstrap());
    await waitFor(() => expect(result.current.bootstrapped).toBe(true));

    expect(applyThemeMock).toHaveBeenCalled();
    const lastCall = applyThemeMock.mock.calls[applyThemeMock.mock.calls.length - 1];
    expect(lastCall[0]).toBe(customThemeId);
    const passedCustoms = lastCall[1] as ReadonlyArray<{ id: string }>;
    expect(passedCustoms.length).toBeGreaterThan(0);
    expect(passedCustoms.some((entry) => entry.id === customThemeId)).toBe(true);
  });
});
