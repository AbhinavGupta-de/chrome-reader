import React, { useState } from "react";
import { Highlight, HighlightColor } from "../../lib/highlights/types";

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
  const top = window.scrollY + rect.bottom + 6;
  const left = window.scrollX + rect.left;
  const [note, setNote] = useState(highlight.note ?? "");

  return (
    <div className="absolute z-50 clay-card !p-3 w-72" style={{ top, left }}>
      <div className="flex justify-between mb-2">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChangeColor(c)}
              className={`w-5 h-5 rounded-full border ${highlight.color === c ? "border-clay-black" : "border-oat"}`}
              style={{ background: SWATCH[c] }}
              aria-label={c}
            />
          ))}
        </div>
        <button onClick={onClose} className="text-silver text-xs">✕</button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onChangeNote(note)}
        placeholder="Add a note…"
        rows={3}
        className="w-full text-xs p-2 border border-oat rounded-[8px] bg-clay-white"
      />
      <div className="flex justify-end mt-2">
        <button onClick={onDelete} className="text-xs text-pomegranate-400">Delete</button>
      </div>
    </div>
  );
}
