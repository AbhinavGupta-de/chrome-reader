import React from "react";
import { HighlightColor } from "../lib/highlights/types";

export type { HighlightColor };

export type ToolbarAction = "highlight" | "define" | "translate" | "search" | "explain";

interface Props {
  rect: DOMRect;
  hasExplain: boolean;
  onAction: (action: ToolbarAction, payload?: { color?: HighlightColor }) => void;
}

const COLOR_SWATCH: Record<HighlightColor, string> = {
  yellow: "#fde68a",
  green: "#bbf7d0",
  pink: "#fbcfe8",
  blue: "#bfdbfe",
};

export default function SelectionToolbar({ rect, hasExplain, onAction }: Props) {
  const top = Math.max(window.scrollY + rect.top - 48, window.scrollY + 8);
  const left = window.scrollX + rect.left + rect.width / 2;
  const [showColors, setShowColors] = React.useState(false);

  return (
    <div
      className="absolute z-50 -translate-x-1/2 clay-card flex items-center gap-1 !rounded-[1584px] px-2 py-1 shadow-md"
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
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => setShowColors(true)}>
            Highlight
          </button>
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("define")}>
            Define
          </button>
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("translate")}>
            Translate
          </button>
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
