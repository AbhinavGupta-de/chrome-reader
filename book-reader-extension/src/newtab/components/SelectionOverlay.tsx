import React from "react";

interface Props {
  rects: readonly DOMRect[];
}

export default function SelectionOverlay({ rects }: Props) {
  const visibleRects = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (visibleRects.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none" aria-hidden="true">
      {visibleRects.map((rect, index) => (
        <div
          key={`${rect.left}:${rect.top}:${rect.width}:${rect.height}:${index}`}
          className="reader-selection-overlay fixed"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}
    </div>
  );
}
