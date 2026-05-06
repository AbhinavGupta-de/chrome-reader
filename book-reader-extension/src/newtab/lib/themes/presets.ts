import type { BuiltInThemeDef, PdfTint, ThemeMode } from "./types";

function definePreset(
  id: string,
  name: string,
  mode: ThemeMode,
  pdfTint: PdfTint,
): BuiltInThemeDef {
  return { id, name, mode, pdfTint, isCustom: false };
}

export const THEME_PRESETS: ReadonlyArray<BuiltInThemeDef> = [
  definePreset("light", "Light", "light", "normal"),
  definePreset("dark", "Dark", "dark", "dark"),
  definePreset("sepia", "Sepia", "light", "sepia"),
  definePreset("solarized-light", "Solarized Light", "light", "normal"),
  definePreset("solarized-dark", "Solarized Dark", "dark", "dark"),
  definePreset("nord", "Nord", "dark", "dark"),
  definePreset("gruvbox-light", "Gruvbox Light", "light", "sepia"),
  definePreset("gruvbox-dark", "Gruvbox Dark", "dark", "dark"),
  definePreset("dracula", "Dracula", "dark", "dark"),
  definePreset("tokyo-night", "Tokyo Night", "dark", "dark"),
  definePreset("paper", "Paper", "light", "normal"),
  definePreset("e-ink", "E-Ink", "light", "normal"),
  definePreset("rose-pine", "Rosé Pine", "dark", "dark"),
  definePreset("catppuccin-latte", "Catppuccin Latte", "light", "normal"),
  definePreset("catppuccin-mocha", "Catppuccin Mocha", "dark", "dark"),
] as const;

const PRESET_INDEX_BY_ID: ReadonlyMap<string, BuiltInThemeDef> = new Map(
  THEME_PRESETS.map((preset) => [preset.id, preset]),
);

export function getPresetById(presetId: string): BuiltInThemeDef | undefined {
  return PRESET_INDEX_BY_ID.get(presetId);
}

export function isKnownPresetId(presetId: string): boolean {
  return PRESET_INDEX_BY_ID.has(presetId);
}
