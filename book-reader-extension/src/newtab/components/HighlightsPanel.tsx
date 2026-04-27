import React from "react";
import { Highlight } from "../lib/highlights/types";

const SWATCH: Record<string, string> = {
  yellow: "#fde68a", green: "#bbf7d0", pink: "#fbcfe8", blue: "#bfdbfe",
};

interface Props {
  items: Highlight[];
  onJump: (h: Highlight) => void;
  onClose: () => void;
}

export default function HighlightsPanel({ items, onJump, onClose }: Props) {
  return (
    <div className="w-80 border-l border-oat bg-clay-white flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-oat">
        <h3 className="text-sm font-semibold">Highlights ({items.length})</h3>
        <button onClick={onClose} className="clay-btn-white !p-1.5 !rounded-[8px]">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-silver text-center py-6">No highlights yet. Select text and pick a color.</p>
        )}
        {items.map((h) => (
          <button
            key={h.id}
            onClick={() => onJump(h)}
            className="w-full text-left clay-card !p-2.5 hover:bg-cream"
          >
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: SWATCH[h.color] }} />
              <div className="min-w-0">
                <p className="text-xs line-clamp-3">{h.text}</p>
                {h.note && <p className="text-[11px] text-silver italic mt-1 line-clamp-2">{h.note}</p>}
                <p className="text-[10px] text-silver mt-1">Ch. {h.anchor.chapterIndex + 1}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
