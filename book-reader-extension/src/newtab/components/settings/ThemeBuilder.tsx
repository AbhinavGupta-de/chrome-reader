import React, { useMemo, useState } from "react";
import type {
  BuiltInThemeDef,
  CustomThemeDef,
  PdfTint,
  ThemeMode,
  ThemeTokens,
} from "../../lib/themes/types";
import { getPresetById, isKnownPresetId } from "../../lib/themes/presets";

interface ThemeBuilderProps {
  initialBaseId?: string;
  existing?: CustomThemeDef;
  presets: ReadonlyArray<BuiltInThemeDef>;
  onSave: (theme: CustomThemeDef) => Promise<void> | void;
  onCancel: () => void;
}

/** Subset of theme tokens exposed in the color picker grid. */
const EDITABLE_TOKEN_KEYS: ReadonlyArray<keyof ThemeTokens> = [
  "cream",
  "black",
  "white",
  "oat",
  "silver",
  "charcoal",
  "matcha-600",
  "ube-800",
  "pomegranate-400",
];

const TOKEN_LABEL_BY_KEY: Record<keyof ThemeTokens, string> = {
  cream: "Page background",
  black: "Body text",
  white: "Surface",
  oat: "Border",
  "oat-light": "Nested surface",
  silver: "Muted text",
  charcoal: "Strong text",
  "dark-charcoal": "Strong text (hover)",
  "cool-border": "Cool border",
  "matcha-300": "Accent (soft)",
  "matcha-600": "Accent (primary)",
  "matcha-800": "Accent (deep)",
  "slushie-500": "Info",
  "lemon-400": "Warn (soft)",
  "lemon-500": "Warn",
  "ube-300": "Highlight (purple soft)",
  "ube-800": "Highlight (purple)",
  "pomegranate-400": "Danger",
  "blueberry-800": "Highlight (blue)",
  "light-frost": "Frost",
  "shadow-clay": "Card shadow",
  "shadow-hover": "Hover shadow",
  "shadow-hover-sm": "Hover shadow (small)",
  "reader-prose-bg": "Reader column bg",
};

const PDF_TINT_OPTIONS: ReadonlyArray<PdfTint> = ["normal", "dark", "sepia"];
const MODE_OPTIONS: ReadonlyArray<ThemeMode> = ["light", "dark"];

const DEFAULT_NEW_THEME_NAME = "My Theme";
const FALLBACK_NEW_THEME_NAME = "Untitled Theme";
const COLOR_PICKER_FALLBACK = "#000000";
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_LENGTH = 8;
/**
 * Defensive fallback: if a caller passes a non-preset id (e.g. a custom theme
 * id that slipped through resolution), `applyTheme` would land on the
 * light-default CSS block because only preset ids have matching CSS rules.
 * Falling back to "light" keeps token edits visible instead of silently
 * stacking on top of broken styles.
 */
const SAFE_FALLBACK_PRESET_ID = "light";

function generateCustomThemeId(): string {
  const randomSuffix = Math.random()
    .toString(RANDOM_ID_RADIX)
    .slice(2, 2 + RANDOM_ID_LENGTH);
  return `custom-${randomSuffix}-${Date.now().toString(RANDOM_ID_RADIX)}`;
}

function buildPreviewStyle(tokens: Partial<ThemeTokens>): React.CSSProperties {
  const entries = Object.entries(tokens)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map<[string, string]>(([key, value]) => [`--${key}`, value]);
  return Object.fromEntries(entries) as React.CSSProperties;
}

export default function ThemeBuilder({
  initialBaseId = SAFE_FALLBACK_PRESET_ID,
  existing,
  presets,
  onSave,
  onCancel,
}: ThemeBuilderProps) {
  const safeInitialBaseId = isKnownPresetId(initialBaseId)
    ? initialBaseId
    : SAFE_FALLBACK_PRESET_ID;

  const initialMode: ThemeMode =
    existing?.mode ?? getPresetById(safeInitialBaseId)?.mode ?? "light";

  const [name, setName] = useState<string>(existing?.name ?? DEFAULT_NEW_THEME_NAME);
  const [baseId, setBaseId] = useState<string>(existing?.baseId ?? safeInitialBaseId);
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [pdfTint, setPdfTint] = useState<PdfTint>(existing?.pdfTint ?? "normal");
  const [tokens, setTokens] = useState<Partial<ThemeTokens>>(existing?.tokens ?? {});

  const previewStyle = useMemo<React.CSSProperties>(
    () => buildPreviewStyle(tokens),
    [tokens],
  );

  const handleTokenChange = (tokenKey: keyof ThemeTokens, tokenValue: string): void => {
    setTokens((current) => ({ ...current, [tokenKey]: tokenValue }));
  };

  const handleSubmit = async (): Promise<void> => {
    const theme: CustomThemeDef = {
      id: existing?.id ?? generateCustomThemeId(),
      name: name.trim() || FALLBACK_NEW_THEME_NAME,
      mode,
      pdfTint,
      baseId,
      tokens,
      createdAt: existing?.createdAt ?? Date.now(),
      isCustom: true,
    };
    await onSave(theme);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="clay-label mb-1 block">Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white text-clay-black"
        />
      </div>

      <div>
        <label className="clay-label mb-1 block">Base preset</label>
        <select
          value={baseId}
          onChange={(event) => setBaseId(event.target.value)}
          className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white text-clay-black"
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="clay-label mb-1 block">Mode</label>
        <div className="flex gap-3">
          {MODE_OPTIONS.map((candidateMode) => (
            <button
              key={candidateMode}
              onClick={() => setMode(candidateMode)}
              className={`flex-1 py-2 rounded-[8px] border ${
                mode === candidateMode ? "border-clay-black clay-shadow" : "border-oat"
              }`}
            >
              {candidateMode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="clay-label mb-1 block">PDF tint</label>
        <div className="flex gap-2">
          {PDF_TINT_OPTIONS.map((tintOption) => (
            <button
              key={tintOption}
              onClick={() => setPdfTint(tintOption)}
              className={`flex-1 py-2 text-xs rounded-[8px] border ${
                pdfTint === tintOption ? "border-clay-black clay-shadow" : "border-oat"
              }`}
            >
              {tintOption}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="clay-label">Colors</label>
        {EDITABLE_TOKEN_KEYS.map((tokenKey) => (
          <div key={tokenKey} className="flex items-center justify-between gap-3">
            <span className="text-sm">{TOKEN_LABEL_BY_KEY[tokenKey]}</span>
            <input
              type="color"
              value={(tokens[tokenKey] as string | undefined) ?? COLOR_PICKER_FALLBACK}
              onChange={(event) => handleTokenChange(tokenKey, event.target.value)}
              className="w-10 h-8 rounded border border-oat"
            />
          </div>
        ))}
      </div>

      <div className="clay-card p-4 !rounded-[12px]" style={previewStyle}>
        <p className="clay-label mb-1">Preview</p>
        <p className="text-sm">The quick brown fox jumps over the lazy dog.</p>
        <button className="clay-btn-solid text-xs mt-2">Sample button</button>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="clay-btn-white text-sm">
          Cancel
        </button>
        <button onClick={handleSubmit} className="clay-btn-solid text-sm">
          Save theme
        </button>
      </div>
    </div>
  );
}
