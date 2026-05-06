import React, { useState, useEffect } from "react";
import type { PdfViewMode, PdfColorMode } from "./PdfViewer";

interface PdfToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  viewMode: PdfViewMode;
  colorMode: PdfColorMode;
  showThumbnailStrip: boolean;
  showViewMode?: boolean;
  showPageNav?: boolean;
  showColorMode?: boolean;
  showZoom?: boolean;
  onGoToPage: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onViewModeChange: (mode: PdfViewMode) => void;
  onColorModeChange: (mode: PdfColorMode) => void;
  onToggleThumbnailStrip: () => void;
  zoomMin: number;
  zoomMax: number;
}

const VIEW_MODES: { id: PdfViewMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "single",
    label: "Single Page",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="1" width="8" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: "continuous",
    label: "Continuous Scroll",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="0.5" width="7" height="5" rx="0.5" />
        <rect x="3.5" y="8.5" width="7" height="5" rx="0.5" />
      </svg>
    ),
  },
  {
    id: "spread",
    label: "Two-Page Spread",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="0.5" y="2" width="5.5" height="10" rx="0.5" />
        <rect x="8" y="2" width="5.5" height="10" rx="0.5" />
      </svg>
    ),
  },
];

const COLOR_MODES: { id: PdfColorMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "normal",
    label: "Normal",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="7" cy="7" r="2.5" />
        <path d="M7 1.5v1.5M7 11v1.5M1.5 7H3M11 7h1.5M3.1 3.1l1 1M9.9 9.9l1 1M3.1 10.9l1-1M9.9 4.1l1-1" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark Mode",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 7.5a5 5 0 1 1-5-5 3.5 3.5 0 0 0 5 5z" />
      </svg>
    ),
  },
  {
    id: "sepia",
    label: "Sepia",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 2.5C5 5 3.5 6.5 3.5 8.5a3.5 3.5 0 1 0 7 0C10.5 6.5 9 5 7 2.5z" />
      </svg>
    ),
  },
];

export default function PdfToolbar({
  currentPage,
  totalPages,
  zoom,
  viewMode,
  colorMode,
  showThumbnailStrip,
  showViewMode = true,
  showPageNav = true,
  showColorMode = true,
  showZoom = true,
  onGoToPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onViewModeChange,
  onColorModeChange,
  onToggleThumbnailStrip,
  zoomMin,
  zoomMax,
}: PdfToolbarProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));
  const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  useEffect(() => {
    if (document.activeElement?.tagName !== "INPUT") {
      setInputValue(String(currentPage));
    }
  }, [currentPage]);

  const handleInputBlur = () => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1) onGoToPage(page);
    else setInputValue(String(currentPage));
  };

  return (
    <div className="flex items-center px-3 py-2 border-b border-oat flex-shrink-0">
      {/* Thumbnail strip toggle - pinned left */}
      <button
        onClick={onToggleThumbnailStrip}
        className={`clay-btn-white !p-1.5 !rounded-[8px] transition-colors flex-shrink-0 ${showThumbnailStrip ? "!bg-matcha-600/10 !border-matcha-600" : ""}`}
        title="Toggle thumbnail strip"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="4" height="5" rx="0.5" />
          <rect x="1" y="8" width="4" height="5" rx="0.5" />
          <path d="M7.5 3h5M7.5 7h5M7.5 11h5" />
        </svg>
      </button>

      {/* Centered controls — build visible sections array, render dividers between them */}
      <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
      {(() => {
        const sections: React.ReactNode[] = [];

        if (showViewMode) {
          sections.push(
            <div key="vm" className="flex items-center bg-oat/40 rounded-[8px] p-0.5 gap-0.5">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onViewModeChange(m.id)}
                  className={`p-1.5 rounded-[6px] transition-all ${
                    viewMode === m.id
                      ? "bg-clay-white shadow-sm text-clay-black"
                      : "text-silver hover:text-clay-black"
                  }`}
                  title={m.label}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          );
        }

        if (showPageNav) {
          sections.push(
            <div key="pn" className="flex items-center gap-1.5">
              <button
                onClick={() => onGoToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
                title="Previous page"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3L4 7l5 4" />
                </svg>
              </button>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={handleInputBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="w-12 text-center text-xs font-medium bg-transparent border border-oat rounded-[8px] py-1 focus:outline-none focus:border-matcha-600 transition-colors tabular-nums"
                  min={1}
                  max={totalPages}
                />
                <span className="text-silver whitespace-nowrap">/ {totalPages}</span>
              </div>
              <button
                onClick={() => onGoToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
                title="Next page"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3l5 4-5 4" />
                </svg>
              </button>
              <span className="text-[11px] text-silver tabular-nums ml-0.5">{pct}%</span>
            </div>
          );
        }

        if (showColorMode) {
          sections.push(
            <div key="cm" className="flex items-center bg-oat/40 rounded-[8px] p-0.5 gap-0.5">
              {COLOR_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onColorModeChange(m.id)}
                  className={`p-1.5 rounded-[6px] transition-all ${
                    colorMode === m.id
                      ? "bg-clay-white shadow-sm text-clay-black"
                      : "text-silver hover:text-clay-black"
                  }`}
                  title={m.label}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          );
        }

        if (showZoom) {
          sections.push(
            <div key="zm" className="flex items-center gap-1">
              <button
                onClick={onZoomOut}
                disabled={zoom <= zoomMin}
                className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
                title="Zoom out (Ctrl -)"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 7h8" />
                </svg>
              </button>
              <button
                onClick={onZoomReset}
                className="text-[11px] text-silver tabular-nums hover:text-clay-black transition-colors min-w-[3rem] text-center"
                title="Reset zoom (Ctrl 0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={onZoomIn}
                disabled={zoom >= zoomMax}
                className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
                title="Zoom in (Ctrl +)"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 3v8M3 7h8" />
                </svg>
              </button>
            </div>
          );
        }

        const result: React.ReactNode[] = [];
        sections.forEach((section, i) => {
          if (i > 0) result.push(<div key={`d${i}`} className="w-px h-5 bg-oat" />);
          result.push(section);
        });
        return result;
      })()}
      </div>

      {/* Right spacer to balance the thumbnails button */}
      <div className="w-[30px] flex-shrink-0" />
    </div>
  );
}
