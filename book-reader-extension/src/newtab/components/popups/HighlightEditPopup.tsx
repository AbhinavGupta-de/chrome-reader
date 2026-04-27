import React, { useState } from "react";
import { Highlight, HighlightColor } from "../../lib/highlights/types";
import { useDismissable } from "../../hooks/useClickOutside";

const COLORS: HighlightColor[] = ["yellow", "green", "pink", "blue"];
const SWATCH: Record<HighlightColor, string> = {
  yellow: "#fde68a", green: "#bbf7d0", pink: "#fbcfe8", blue: "#bfdbfe",
};

interface Props {
  highlight: Highlight;
  rect: DOMRect;
  onChangeColor: (c: HighlightColor) => void;
  onChangeNote: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function HighlightEditPopup({ highlight, rect, onChangeColor, onChangeNote, onDelete, onClose }: Props) {
  const top = rect.bottom + 6;
  const left = rect.left;
  const [note, setNote] = useState(highlight.note ?? "");
  const ref = useDismissable<HTMLDivElement>(true, () => {
    onChangeNote(note);
    onClose();
  });

  return (
    <div ref={ref} className="fixed z-50 clay-card !p-3 w-72" style={{ top, left }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChangeColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                highlight.color === c
                  ? "border-clay-black scale-110"
                  : "border-oat hover:border-charcoal"
              }`}
              style={{ background: SWATCH[c] }}
              aria-label={`Color ${c}`}
              title={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            aria-label="Remove highlight"
            title="Remove highlight"
            className="p-1.5 rounded-[8px] text-pomegranate-400 hover:bg-pomegranate-400/10 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.5 9a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1L12 4M6.5 7v4M9.5 7v4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-[8px] text-silver hover:text-clay-black hover:bg-oat/40 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l7 7M10 3l-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onChangeNote(note)}
        placeholder="Add a note…"
        rows={3}
        className="w-full text-xs p-2 border border-oat rounded-[8px] bg-clay-white focus:outline-2 focus:outline-matcha-600/40"
      />
    </div>
  );
}
