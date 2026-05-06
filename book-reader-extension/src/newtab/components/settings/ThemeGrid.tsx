import React from "react";
import type {
  BuiltInThemeDef,
  CustomThemeDef,
} from "../../lib/themes/types";

/** Fallback preset used when no other resolution path yields a known preset id. */
const FALLBACK_PRESET_ID = "light";

/**
 * Resolves the active theme id down to a *preset* id suitable for use as
 * `ThemeBuilder.initialBaseId`. Custom themes carry their own `baseId` (always
 * a preset by construction) — passing a custom id directly would otherwise
 * stack a new custom theme on top of another custom id, and `applyTheme`
 * would land on the light-default CSS block since only preset ids have
 * matching CSS rules.
 */
export function resolvePresetBaseId(
  activeThemeId: string,
  customThemes: ReadonlyArray<CustomThemeDef>,
  presets: ReadonlyArray<BuiltInThemeDef>,
): string {
  const matchingPreset = presets.find((preset) => preset.id === activeThemeId);
  if (matchingPreset) return matchingPreset.id;

  const matchingCustom = customThemes.find((custom) => custom.id === activeThemeId);
  if (matchingCustom) {
    const customBaseIsKnownPreset = presets.some(
      (preset) => preset.id === matchingCustom.baseId,
    );
    if (customBaseIsKnownPreset) return matchingCustom.baseId;
  }

  return FALLBACK_PRESET_ID;
}

interface ThemeGridProps {
  presets: ReadonlyArray<BuiltInThemeDef>;
  customThemes: ReadonlyArray<CustomThemeDef>;
  activeThemeId: string;
  onSelect: (themeId: string) => void;
  onCreateCustom: () => void;
  onEditCustom: (theme: CustomThemeDef) => void;
  onDeleteCustom: (themeId: string) => void;
}

function PresetCard({
  preset,
  isActive,
  onSelect,
}: {
  preset: BuiltInThemeDef;
  isActive: boolean;
  onSelect: (themeId: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(preset.id)}
      data-theme={preset.id}
      className={`flex flex-col items-start gap-1 p-3 rounded-[12px] border bg-cream text-clay-black ${
        isActive ? "border-clay-black clay-shadow" : "border-oat"
      }`}
    >
      <span className="text-sm font-medium">{preset.name}</span>
      <span className="text-[10px] uppercase tracking-wide text-silver">
        {preset.mode}
      </span>
    </button>
  );
}

function CustomThemeRow({
  customTheme,
  isActive,
  onSelect,
  onEdit,
  onDelete,
}: {
  customTheme: CustomThemeDef;
  isActive: boolean;
  onSelect: (themeId: string) => void;
  onEdit: (theme: CustomThemeDef) => void;
  onDelete: (themeId: string) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 p-3 rounded-[12px] border ${
        isActive ? "border-clay-black clay-shadow" : "border-oat"
      }`}
    >
      <button
        onClick={() => onSelect(customTheme.id)}
        className="flex-1 text-left text-sm font-medium truncate"
      >
        {customTheme.name}
      </button>
      <div className="flex gap-1">
        <button
          onClick={() => onEdit(customTheme)}
          className="text-xs text-silver hover:text-clay-black"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(customTheme.id)}
          className="text-xs text-pomegranate-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ThemeGrid({
  presets,
  customThemes,
  activeThemeId,
  onSelect,
  onCreateCustom,
  onEditCustom,
  onDeleteCustom,
}: ThemeGridProps) {
  return (
    <div className="space-y-5">
      <section>
        <p className="clay-label mb-2">Presets</p>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={activeThemeId === preset.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="clay-label">Custom themes</p>
          <button onClick={onCreateCustom} className="clay-btn-white text-xs">
            + New
          </button>
        </div>
        {customThemes.length === 0 ? (
          <p className="text-xs text-silver">
            No custom themes yet — click “New” to create one.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {customThemes.map((customTheme) => (
              <CustomThemeRow
                key={customTheme.id}
                customTheme={customTheme}
                isActive={activeThemeId === customTheme.id}
                onSelect={onSelect}
                onEdit={onEditCustom}
                onDelete={onDeleteCustom}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
