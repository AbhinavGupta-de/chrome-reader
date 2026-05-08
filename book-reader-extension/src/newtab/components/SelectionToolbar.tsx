import React from "react";
import { HighlightColor } from "../lib/highlights/types";
import Tooltip from "./Tooltip";

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
  const keepSelectionAlive = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);
  const buttonClass = "text-xs !py-1 !px-2 clay-btn-white pointer-events-auto";

  return (
    <div
      data-selection-toolbar
      className="fixed z-50 -translate-x-1/2 clay-card flex items-center gap-1 !rounded-[1584px] px-2 py-1 shadow-md pointer-events-none select-none"
      style={{ top, left }}
    >
      {showColors ? (
        <>
          {(Object.keys(COLOR_SWATCH) as HighlightColor[]).map((c) => (
            <Tooltip key={c} label={`Highlight ${c}`} position="top" delay={200}>
              <button
                aria-label={`Highlight ${c}`}
                className="w-6 h-6 rounded-full border border-oat pointer-events-auto"
                style={{ background: COLOR_SWATCH[c] }}
                onPointerDown={keepSelectionAlive}
                onClick={() => {
                  onAction("highlight", { color: c });
                  setShowColors(false);
                }}
              />
            </Tooltip>
          ))}
          <button
            className="text-xs px-2 text-silver pointer-events-auto"
            onPointerDown={keepSelectionAlive}
            onClick={() => setShowColors(false)}
          >
            cancel
          </button>
        </>
      ) : (
        <>
          {hasOverlap ? (
            <Tooltip label="Remove existing highlight" position="top" delay={200}>
              <button
                className="text-xs !py-1 !px-2.5 clay-btn-white text-pomegranate-400 inline-flex items-center gap-1 pointer-events-auto"
                onPointerDown={keepSelectionAlive}
                onClick={() => onAction("remove_highlight", { highlightIds: overlapping })}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.5 9a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1L12 4" />
                </svg>
                Remove
              </button>
            </Tooltip>
          ) : (
            <Tooltip label="Highlight selected text" position="top" delay={200}>
              <button className={buttonClass} onPointerDown={keepSelectionAlive} onClick={() => setShowColors(true)}>
                Highlight
              </button>
            </Tooltip>
          )}
          <Tooltip label="Look up definition" position="top" delay={200}>
            <button className={buttonClass} onPointerDown={keepSelectionAlive} onClick={() => onAction("define")}>
              Define
            </button>
          </Tooltip>
          {aiAvailable && (
            <Tooltip label="Translate to your language" position="top" delay={200}>
              <button className={buttonClass} onPointerDown={keepSelectionAlive} onClick={() => onAction("translate")}>
                Translate
              </button>
            </Tooltip>
          )}
          <Tooltip label="Search on Google" position="top" delay={200}>
            <button className={buttonClass} onPointerDown={keepSelectionAlive} onClick={() => onAction("search")}>
              Web
            </button>
          </Tooltip>
          {hasExplain && (
            <Tooltip label="Explain with AI" position="top" delay={200}>
              <button className={buttonClass} onPointerDown={keepSelectionAlive} onClick={() => onAction("explain")}>
                Explain
              </button>
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}
