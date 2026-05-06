import { describe, it, expect } from "vitest";
import {
  THEME_PRESETS,
  getPresetById,
  isKnownPresetId,
} from "../../src/newtab/lib/themes/presets";

describe("theme presets", () => {
  it("registersExactlyFifteenPresets", () => {
    // arrange + act handled by static import

    // assert
    expect(THEME_PRESETS).toHaveLength(15);
  });

  it("includesCanonicalLightAndDarkPresets", () => {
    expect(isKnownPresetId("light")).toBe(true);
    expect(isKnownPresetId("dark")).toBe(true);
  });

  it("returnsUndefinedForUnknownPresetIds", () => {
    expect(getPresetById("nonexistent")).toBeUndefined();
  });

  it("hasUniqueIdsAcrossAllPresets", () => {
    const presetIds = THEME_PRESETS.map((preset) => preset.id);

    const uniqueIds = new Set(presetIds);

    expect(uniqueIds.size).toBe(presetIds.length);
  });

  it("givesEveryPresetANonEmptyHumanReadableName", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it("declaresEveryPresetAsBuiltInNotCustom", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.isCustom).toBe(false);
    }
  });

  it("resolvesByIdToTheSamePresetReturnedFromArray", () => {
    const draculaFromArray = THEME_PRESETS.find((p) => p.id === "dracula");

    const draculaFromLookup = getPresetById("dracula");

    expect(draculaFromLookup).toBe(draculaFromArray);
  });
});
