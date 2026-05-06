import { describe, it, expect } from "vitest";
import { resolvePresetBaseId } from "../../src/newtab/components/settings/ThemeGrid";
import type {
  BuiltInThemeDef,
  CustomThemeDef,
} from "../../src/newtab/lib/themes/types";

const FIXTURE_PRESETS: ReadonlyArray<BuiltInThemeDef> = [
  { id: "light", name: "Light", mode: "light", pdfTint: "normal", isCustom: false },
  { id: "dark", name: "Dark", mode: "dark", pdfTint: "dark", isCustom: false },
  { id: "sepia", name: "Sepia", mode: "light", pdfTint: "sepia", isCustom: false },
];

function buildCustomTheme(id: string, baseId: string): CustomThemeDef {
  return {
    id,
    name: "Test Custom",
    mode: "light",
    pdfTint: "normal",
    baseId,
    tokens: {},
    createdAt: 0,
    isCustom: true,
  };
}

describe("resolvePresetBaseId", () => {
  it("returnsActivePresetIdWhenActiveThemeIsItselfAPreset", () => {
    const resolved = resolvePresetBaseId("dark", [], FIXTURE_PRESETS);

    expect(resolved).toBe("dark");
  });

  it("resolvesActiveCustomThemesBaseToItsPresetParent", () => {
    const customThemes = [buildCustomTheme("custom-abc", "sepia")];

    const resolved = resolvePresetBaseId("custom-abc", customThemes, FIXTURE_PRESETS);

    expect(resolved).toBe("sepia");
  });

  it("fallsBackToLightWhenActiveThemeIdMatchesNothing", () => {
    const resolved = resolvePresetBaseId("ghost-theme", [], FIXTURE_PRESETS);

    expect(resolved).toBe("light");
  });

  it("fallsBackToLightWhenCustomThemesBaseIdIsNotAKnownPreset", () => {
    const customThemes = [buildCustomTheme("custom-broken", "no-such-preset")];

    const resolved = resolvePresetBaseId(
      "custom-broken",
      customThemes,
      FIXTURE_PRESETS,
    );

    expect(resolved).toBe("light");
  });
});
