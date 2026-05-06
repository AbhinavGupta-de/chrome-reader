import React from "react";
import { ReaderSettings } from "../../lib/storage";

export const FONT_OPTIONS: ReadonlyArray<{
  label: string;
  value: string;
  preview: string;
}> = [
  { label: "DM Sans", value: "'DM Sans', Arial, sans-serif", preview: "Ag" },
  { label: "Georgia", value: "Georgia, serif", preview: "Ag" },
  { label: "Space Mono", value: "'Space Mono', monospace", preview: "Ag" },
];

const MIN_FONT_SIZE_PX = 14;
const MAX_FONT_SIZE_PX = 26;
const MIN_LINE_HEIGHT = 1.3;
const MAX_LINE_HEIGHT = 2.2;
const LINE_HEIGHT_STEP = 0.1;

interface InlineReaderControlsProps {
  settings: ReaderSettings;
  onSettingsChange: (next: ReaderSettings) => void;
}

/**
 * Compact font/size/line-height controls rendered inside the expanded TopBar.
 *
 * All three drive the same `ReaderSettings` object as the Settings modal —
 * no parallel persistence path.
 */
export default function InlineReaderControls({
  settings,
  onSettingsChange,
}: InlineReaderControlsProps) {
  const update = (patch: Partial<ReaderSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="flex items-center gap-2 min-w-[180px]">
        <label className="text-[11px] uppercase tracking-wide text-silver" htmlFor="topbar-font-size">
          Size
        </label>
        <input
          id="topbar-font-size"
          type="range"
          min={MIN_FONT_SIZE_PX}
          max={MAX_FONT_SIZE_PX}
          value={settings.fontSize}
          onChange={(event) => update({ fontSize: Number(event.target.value) })}
          className="flex-1 accent-matcha-600"
        />
        <span className="text-[11px] tabular-nums text-silver w-8 text-right">
          {settings.fontSize}px
        </span>
      </div>

      <div className="flex items-center gap-2 min-w-[180px]">
        <label className="text-[11px] uppercase tracking-wide text-silver" htmlFor="topbar-line-height">
          Spacing
        </label>
        <input
          id="topbar-line-height"
          type="range"
          min={MIN_LINE_HEIGHT}
          max={MAX_LINE_HEIGHT}
          step={LINE_HEIGHT_STEP}
          value={settings.lineHeight}
          onChange={(event) => update({ lineHeight: Number(event.target.value) })}
          className="flex-1 accent-matcha-600"
        />
        <span className="text-[11px] tabular-nums text-silver w-8 text-right">
          {settings.lineHeight.toFixed(1)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-silver">Font</span>
        <div className="flex gap-1.5">
          {FONT_OPTIONS.map((font) => {
            const isActive = settings.fontFamily === font.value;
            return (
              <button
                key={font.value}
                type="button"
                onClick={() => update({ fontFamily: font.value })}
                aria-pressed={isActive}
                className={`px-2.5 py-1 text-xs rounded-[8px] border transition-all ${
                  isActive
                    ? "border-clay-black bg-clay-white clay-shadow"
                    : "border-oat hover:border-charcoal"
                }`}
                style={{ fontFamily: font.value }}
              >
                <span className="text-sm">{font.preview}</span>
                <span className="ml-1 text-[10px] text-silver" style={{ fontFamily: "var(--font-sans)" }}>
                  {font.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
