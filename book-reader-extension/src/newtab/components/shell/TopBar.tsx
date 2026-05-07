import React from "react";
import { ReaderSettings } from "../../lib/storage";
import { useDismissable } from "../../hooks/useClickOutside";
import InlineReaderControls from "./InlineReaderControls";
import Tooltip from "../Tooltip";

export const TOPBAR_COLLAPSED_HEIGHT_PX = 28;
export const TOPBAR_EXPANDED_HEIGHT_PX = 120;

interface TopBarProps {
  bookTitle: string;
  bookAuthor: string;
  bookFormat: "epub" | "pdf" | "txt" | null;
  readingTimeMinutes: number | null;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  settings: ReaderSettings;
  onSettingsChange: (next: ReaderSettings) => void;
}

/**
 * Always-visible thin strip; click chevron (or the strip body) to expand.
 *
 * Collapsed: 28px tall — book title + format badge + reading-time + chevron.
 * Expanded: ~120px tall — adds inline reader controls and a close X.
 *
 * Esc or outside-click collapses. No scroll-hide. `pinToolbar` is gone —
 * the strip is permanently visible by design.
 */
export default function TopBar({
  bookTitle,
  bookAuthor,
  bookFormat,
  readingTimeMinutes,
  expanded,
  onExpand,
  onCollapse,
  settings,
  onSettingsChange,
}: TopBarProps) {
  const containerRef = useDismissable<HTMLDivElement>(expanded, onCollapse);
  const formatBadge = bookFormat?.toUpperCase() ?? "";

  return (
    <div
      ref={containerRef}
      className="relative z-30 border-b border-oat bg-cream/90 backdrop-blur-md"
      style={{ minHeight: TOPBAR_COLLAPSED_HEIGHT_PX }}
    >
      {!expanded ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand reader controls"
          aria-expanded="false"
          className="w-full flex items-center justify-between px-4 text-xs"
          style={{ height: TOPBAR_COLLAPSED_HEIGHT_PX }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span
              className="text-[10px] font-semibold px-1.5 py-px rounded-[4px] bg-clay-black text-clay-white tracking-wide"
              aria-hidden={!formatBadge}
            >
              {formatBadge || "—"}
            </span>
            <span className="truncate text-charcoal max-w-[40vw]">{bookTitle}</span>
          </span>
          <span className="flex items-center gap-2 text-silver">
            {readingTimeMinutes !== null && (
              <span className="tabular-nums">{readingTimeMinutes} min</span>
            )}
            <ChevronDownIcon />
          </span>
        </button>
      ) : (
        <div
          className="px-4 py-3 drop-down"
          style={{ minHeight: TOPBAR_EXPANDED_HEIGHT_PX }}
          role="region"
          aria-label="Reader controls"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-px rounded-[4px] bg-clay-black text-clay-white tracking-wide">
                  {formatBadge || "—"}
                </span>
                <p className="text-sm font-medium truncate" style={{ letterSpacing: "-0.16px" }}>
                  {bookTitle}
                </p>
              </div>
              <p className="text-[11px] text-silver truncate mt-0.5">{bookAuthor}</p>
            </div>
            <Tooltip label="Collapse controls" position="bottom">
              <button
                type="button"
                onClick={onCollapse}
                aria-label="Collapse reader controls"
                className="clay-btn-white !p-1.5 !rounded-[8px]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </Tooltip>
          </div>
          <InlineReaderControls
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}
