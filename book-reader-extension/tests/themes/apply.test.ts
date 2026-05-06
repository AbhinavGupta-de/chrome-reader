import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "../../src/newtab/lib/themes/apply";
import { THEME_PRESETS } from "../../src/newtab/lib/themes/presets";
import type { CustomThemeDef } from "../../src/newtab/lib/themes/types";

const NO_CUSTOM_THEMES: ReadonlyArray<CustomThemeDef> = [];

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-applied-inline-tokens");
  document.documentElement.classList.remove("dark");
});

describe("applyTheme", () => {
  it("setsDataThemeAttributeForBuiltInPreset", () => {
    applyTheme("dark", NO_CUSTOM_THEMES);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("addsDarkClassForDarkModePresets", () => {
    applyTheme("dracula", NO_CUSTOM_THEMES);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removesDarkClassWhenSwitchingToLightModePreset", () => {
    document.documentElement.classList.add("dark");

    applyTheme("sepia", NO_CUSTOM_THEMES);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("fallsBackToLightPresetForUnknownThemeId", () => {
    applyTheme("not-a-real-theme", NO_CUSTOM_THEMES);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("appliesCustomThemeTokensInlineOnRoot", () => {
    const customTheme: CustomThemeDef = {
      id: "custom-1",
      name: "Test",
      mode: "dark",
      pdfTint: "dark",
      baseId: "dark",
      tokens: { cream: "#abcdef", "matcha-600": "#123456" },
      createdAt: 0,
      isCustom: true,
    };

    applyTheme(customTheme.id, [customTheme]);

    const html = document.documentElement;
    expect(html.getAttribute("data-theme")).toBe("dark");
    expect(html.style.getPropertyValue("--cream")).toBe("#abcdef");
    expect(html.style.getPropertyValue("--matcha-600")).toBe("#123456");
  });

  it("clearsPriorInlineTokensWhenSwitchingFromCustomToPreset", () => {
    const customTheme: CustomThemeDef = {
      id: "custom-1",
      name: "Test",
      mode: "dark",
      pdfTint: "dark",
      baseId: "dark",
      tokens: { cream: "#abcdef" },
      createdAt: 0,
      isCustom: true,
    };
    applyTheme(customTheme.id, [customTheme]);

    applyTheme("light", [customTheme]);

    expect(document.documentElement.style.getPropertyValue("--cream")).toBe("");
  });

  it("setsPdfTintInlineSoPdfViewerCanRead", () => {
    applyTheme("sepia", NO_CUSTOM_THEMES);

    expect(document.documentElement.style.getPropertyValue("--pdf-tint").trim()).toBe("sepia");
  });

  it("activatesEveryRegisteredPresetWithoutThrowing", () => {
    for (const preset of THEME_PRESETS) {
      expect(() => applyTheme(preset.id, NO_CUSTOM_THEMES)).not.toThrow();
    }
  });

  it("clearsAllPreviouslyAppliedInlineTokensEvenWhenNewThemeAppliesNone", () => {
    const customTheme: CustomThemeDef = {
      id: "custom-2",
      name: "Test",
      mode: "light",
      pdfTint: "normal",
      baseId: "light",
      tokens: { "matcha-600": "#abc123" },
      createdAt: 0,
      isCustom: true,
    };
    applyTheme(customTheme.id, [customTheme]);

    applyTheme("dark", [customTheme]);

    expect(document.documentElement.style.getPropertyValue("--matcha-600")).toBe("");
  });
});
