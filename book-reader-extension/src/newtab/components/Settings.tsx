import React, { useState } from "react";
import { ReaderSettings, PdfViewMode, PdfColorMode } from "../lib/storage";

interface SettingsProps {
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
  onClose: () => void;
  isPdf?: boolean;
}

const FONT_OPTIONS = [
  { label: "DM Sans", value: "'DM Sans', Arial, sans-serif", preview: "Ag" },
  { label: "Georgia", value: "Georgia, serif", preview: "Ag" },
  { label: "Space Mono", value: "'Space Mono', monospace", preview: "Ag" },
];

const VIEW_MODE_OPTIONS: { id: PdfViewMode; label: string }[] = [
  { id: "single", label: "Single" },
  { id: "continuous", label: "Scroll" },
  { id: "spread", label: "Spread" },
];

const COLOR_MODE_OPTIONS: { id: PdfColorMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "dark", label: "Dark" },
  { id: "sepia", label: "Sepia" },
];

type SettingsSection = "appearance" | "reader" | "pdf";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1M11.2 4.8l1-1" />
      </svg>
    ),
  },
  {
    id: "reader",
    label: "Reader",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h4.5c.8 0 1.5.7 1.5 1.5V14c0-.8-.7-1-1.5-1H2V3z" />
        <path d="M14 3H9.5C8.7 3 8 3.7 8 4.5V14c0-.8.7-1 1.5-1H14V3z" />
      </svg>
    ),
  },
  {
    id: "pdf",
    label: "PDF Viewer",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h5l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
        <path d="M9 2v4h4" />
        <path d="M5.5 9.5h5M5.5 12h3" />
      </svg>
    ),
  },
];

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${
        value ? "bg-matcha-600" : "bg-oat"
      }`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-clay-white shadow-sm transition-all duration-200 ${
        value ? "left-[22px]" : "left-0.5"
      }`} />
    </button>
  );
}

function ToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-clay-black">{label}</p>
        {description && <p className="text-xs text-silver mt-0.5">{description}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

export default function Settings({ settings, onChange, onClose, isPdf }: SettingsProps) {
  const update = (patch: Partial<ReaderSettings>) => onChange({ ...settings, ...patch });
  const [activeSection, setActiveSection] = useState<SettingsSection>(isPdf ? "pdf" : "appearance");

  return (
    <div className="fixed inset-0 z-50 bg-clay-black/30 flex items-center justify-center p-4 fade-in">
      <div className="clay-card w-full max-w-2xl !p-0 overflow-hidden modal-enter flex flex-col" style={{ height: "min(560px, 85vh)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-oat flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight" style={{ letterSpacing: "-0.4px" }}>Settings</h2>
          <button onClick={onClose} className="clay-btn-white !p-2 !rounded-[8px]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[160px] flex-shrink-0 border-r border-oat bg-oat/20 py-3 px-2 space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-all text-sm ${
                  activeSection === s.id
                    ? "bg-clay-white shadow-sm text-clay-black font-medium"
                    : "text-charcoal hover:bg-clay-white/50 hover:text-clay-black"
                }`}
              >
                <span className={activeSection === s.id ? "text-matcha-600" : "text-silver"}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === "appearance" && (
              <div className="space-y-6">
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

                {/* Preview */}
                <div className="clay-card !rounded-[12px] p-4">
                  <p className="clay-label mb-2">Preview</p>
                  <p style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, fontFamily: settings.fontFamily }}>
                    The quick brown fox jumps over the lazy dog.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "reader" && (
              <div className="space-y-5">
                <ToggleRow
                  label="Pin Toolbar"
                  description="Keep the top bar always visible"
                  value={settings.pinToolbar}
                  onChange={() => update({ pinToolbar: !settings.pinToolbar })}
                />

                <div>
                  <p className="clay-label mb-2">Translate to</p>
                  <select
                    value={settings.translateTo}
                    onChange={(e) => update({ translateTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white text-clay-black"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="it">Italian</option>
                    <option value="pt">Portuguese</option>
                    <option value="hi">Hindi</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
            )}

            {activeSection === "pdf" && (
              <div className="space-y-6">
                {/* View Mode */}
                <div>
                  <p className="clay-label mb-2">View Mode</p>
                  <div className="flex gap-2">
                    {VIEW_MODE_OPTIONS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => update({ pdfViewMode: m.id })}
                        className={`flex-1 py-2 text-xs font-medium rounded-[8px] border transition-all ${
                          settings.pdfViewMode === m.id
                            ? "border-clay-black clay-shadow"
                            : "border-oat hover:border-charcoal"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Mode */}
                <div>
                  <p className="clay-label mb-2">Page Colors</p>
                  <div className="flex gap-2">
                    {COLOR_MODE_OPTIONS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => update({ pdfColorMode: m.id })}
                        className={`flex-1 py-2 text-xs font-medium rounded-[8px] border transition-all ${
                          settings.pdfColorMode === m.id
                            ? "border-clay-black clay-shadow"
                            : "border-oat hover:border-charcoal"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-4">
                  <ToggleRow
                    label="Thumbnails Sidebar"
                    description="Show page previews on the side"
                    value={settings.pdfShowThumbnails}
                    onChange={() => update({ pdfShowThumbnails: !settings.pdfShowThumbnails })}
                  />
                </div>

                {/* Toolbar visibility */}
                <div className="border-t border-oat pt-5">
                  <p className="clay-label mb-3">Toolbar Controls</p>
                  <div className="space-y-3">
                    <ToggleRow
                      label="View Mode Picker"
                      description="Single / Scroll / Spread buttons"
                      value={settings.pdfShowViewMode}
                      onChange={() => update({ pdfShowViewMode: !settings.pdfShowViewMode })}
                    />
                    <ToggleRow
                      label="Page Navigation"
                      description="Previous / next buttons and page input"
                      value={settings.pdfShowPageNav}
                      onChange={() => update({ pdfShowPageNav: !settings.pdfShowPageNav })}
                    />
                    <ToggleRow
                      label="Color Mode"
                      description="Normal / Dark / Sepia buttons"
                      value={settings.pdfShowColorMode}
                      onChange={() => update({ pdfShowColorMode: !settings.pdfShowColorMode })}
                    />
                    <ToggleRow
                      label="Zoom Controls"
                      description="Zoom in / out / reset buttons"
                      value={settings.pdfShowZoom}
                      onChange={() => update({ pdfShowZoom: !settings.pdfShowZoom })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
