import React from "react";
import { ReaderSettings } from "../lib/storage";

interface SettingsProps {
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { label: "DM Sans", value: "'DM Sans', Arial, sans-serif", preview: "Ag" },
  { label: "Georgia", value: "Georgia, serif", preview: "Ag" },
  { label: "Space Mono", value: "'Space Mono', monospace", preview: "Ag" },
];

export default function Settings({ settings, onChange, onClose }: SettingsProps) {
  const update = (patch: Partial<ReaderSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-clay-black/30 flex items-center justify-center p-4 fade-in">
      <div className="clay-card w-full max-w-sm !p-0 overflow-hidden modal-enter">
        <div className="flex items-center justify-between px-6 py-5 border-b border-oat">
          <h2 className="text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.4px" }}>Settings</h2>
          <button onClick={onClose} className="clay-btn-white !p-2 !rounded-[8px]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Theme */}
          <div>
            <p className="clay-label mb-2">Theme</p>
            <div className="flex gap-3">
              {([
                { value: "light" as const, label: "Light", bg: "#faf9f7", dot: "#000" },
                { value: "dark" as const, label: "Dark", bg: "#1a1815", dot: "#f0ede8" },
              ]).map((t) => (
                <button
                  key={t.value}
                  onClick={() => update({ theme: t.value })}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-[12px] border transition-all ${
                    settings.theme === t.value ? "border-clay-black clay-shadow" : "border-oat hover:border-charcoal"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full border border-oat flex items-center justify-center" style={{ background: t.bg }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: t.dot }} />
                  </div>
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="clay-label">Size</p>
              <span className="text-xs tabular-nums text-silver">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-silver">A</span>
              <input type="range" min={14} max={26} value={settings.fontSize}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-[#078a52]"
              />
              <span className="text-lg text-silver font-semibold">A</span>
            </div>
          </div>

          {/* Line Height */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="clay-label">Spacing</p>
              <span className="text-xs tabular-nums text-silver">{settings.lineHeight.toFixed(1)}</span>
            </div>
            <input type="range" min={1.3} max={2.2} step={0.1} value={settings.lineHeight}
              onChange={(e) => update({ lineHeight: Number(e.target.value) })}
              className="w-full accent-[#078a52]"
            />
          </div>

          {/* Font */}
          <div>
            <p className="clay-label mb-2">Font</p>
            <div className="flex gap-2">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => update({ fontFamily: f.value })}
                  className={`flex-1 py-3 rounded-[12px] text-center border transition-all ${
                    settings.fontFamily === f.value
                      ? "border-clay-black clay-shadow"
                      : "border-oat hover:border-charcoal"
                  }`}
                  style={{ fontFamily: f.value }}
                >
                  <span className="text-lg">{f.preview}</span>
                  <p className="text-[10px] text-silver mt-0.5 font-medium" style={{ fontFamily: "var(--font-sans)" }}>{f.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pin Toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="clay-label">Pin Toolbar</p>
              <p className="text-xs text-silver mt-0.5">Keep the top bar visible</p>
            </div>
            <button
              onClick={() => update({ pinToolbar: !settings.pinToolbar })}
              className={`w-11 h-6 rounded-full transition-all duration-200 relative ${
                settings.pinToolbar ? "bg-matcha-600" : "bg-oat"
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-clay-white shadow-sm transition-all duration-200 ${
                settings.pinToolbar ? "left-[22px]" : "left-0.5"
              }`} />
            </button>
          </div>

          {/* Preview */}
          <div
            className="clay-card !rounded-[12px] p-4"
          >
            <p className="clay-label mb-2">Preview</p>
            <p style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, fontFamily: settings.fontFamily }}>
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
