import React from "react";
import { Highlight } from "../lib/highlights/types";

const HIGHLIGHT_SWATCH: Record<string, string> = {
  yellow: "#fde68a",
  green: "#bbf7d0",
  pink: "#fbcfe8",
  blue: "#bfdbfe",
};

interface HighlightsPanelProps {
  items: Highlight[];
  onJump: (highlight: Highlight) => void;
}

/**
 * Body for the highlights right-side panel. The Panel container owns the
 * header (title + close X); this component renders just the scrollable list.
 */
export default function HighlightsPanel({ items, onJump }: HighlightsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-silver text-center py-6">
            No highlights yet. Select text and pick a color.
          </p>
        )}
        {items.map((highlight) => (
          <button
            key={highlight.id}
            type="button"
            onClick={() => onJump(highlight)}
            className="w-full text-left clay-card !p-2.5 hover:bg-cream"
          >
            <div className="flex items-start gap-2">
              <span
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: HIGHLIGHT_SWATCH[highlight.color] }}
              />
              <div className="min-w-0">
                <p className="text-xs line-clamp-3">{highlight.text}</p>
                {highlight.note && (
                  <p className="text-[11px] text-silver italic mt-1 line-clamp-2">{highlight.note}</p>
                )}
                <p className="text-[10px] text-silver mt-1">Ch. {highlight.anchor.chapterIndex + 1}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
