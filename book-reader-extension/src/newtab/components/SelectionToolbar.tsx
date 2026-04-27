import React from "react";
import { HighlightColor } from "../lib/highlights/types";

export type { HighlightColor };

export type ToolbarAction =
  | "highlight"
  | "remove_highlight"
  | "define"
  | "translate"
  | "search"
  | "explain";

export interface ToolbarPayload {
  color?: HighlightColor;
  highlightIds?: string[];
}

interface Props {
  rect: DOMRect;
  hasExplain: boolean;
  aiAvailable: boolean;
  isPdf?: boolean;
  overlappingHighlightIds?: string[];
  onAction: (action: ToolbarAction, payload?: ToolbarPayload) => void;
}

const COLOR_SWATCH: Record<HighlightColor, string> = {
  yellow: "#fde68a",
  green: "#bbf7d0",
  pink: "#fbcfe8",
  blue: "#bfdbfe",
};

export default function SelectionToolbar({ rect, hasExplain, aiAvailable, isPdf, overlappingHighlightIds, onAction }: Props) {
  const top = Math.max(rect.top - 48, 8);
  const left = rect.left + rect.width / 2;
  const [showColors, setShowColors] = React.useState(false);
  const overlapping = overlappingHighlightIds ?? [];
  const hasOverlap = overlapping.length > 0;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 clay-card flex items-center gap-1 !rounded-[1584px] px-2 py-1 shadow-md"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()} // keep selection alive
    >
      {showColors ? (
        <>
          {(Object.keys(COLOR_SWATCH) as HighlightColor[]).map((c) => (
            <button
              key={c}
              aria-label={`Highlight ${c}`}
              className="w-6 h-6 rounded-full border border-oat"
              style={{ background: COLOR_SWATCH[c] }}
              onClick={() => {
                onAction("highlight", { color: c });
                setShowColors(false);
              }}
            />
          ))}
          <button
            className="text-xs px-2 text-silver"
            onClick={() => setShowColors(false)}
          >
            cancel
          </button>
        </>
      ) : (
        <>
          {hasOverlap ? (
            <button
              className="text-xs !py-1 !px-2.5 clay-btn-white text-pomegranate-400 inline-flex items-center gap-1"
              onClick={() => onAction("remove_highlight", { highlightIds: overlapping })}
              title="Remove highlight"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.5 9a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1L12 4" />
              </svg>
              Remove
            </button>
          ) : (
            <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => setShowColors(true)}>
              Highlight
            </button>
          )}
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("define")}>
            Define
          </button>
          {aiAvailable && (
            <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("translate")}>
              Translate
            </button>
          )}
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("search")}>
            Web
          </button>
          {hasExplain && (
            <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("explain")}>
              Explain
            </button>
          )}
        </>
      )}
    </div>
  );
}
