import React from "react";

interface Props {
  loading: boolean;
  source: string;
  translation: string | null;
  error: string | null;
  targetLang: string;
  rect: DOMRect;
  onClose: () => void;
}

export default function TranslatePopup({ loading, source, translation, error, targetLang, rect, onClose }: Props) {
  const top = window.scrollY + rect.bottom + 8;
  const left = window.scrollX + rect.left;
  return (
    <div className="absolute z-50 clay-card !p-3 w-80" style={{ top, left }}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs text-silver">→ {targetLang}</p>
        <button onClick={onClose} className="text-silver text-xs">✕</button>
      </div>
      <p className="text-xs text-silver italic mb-2 line-clamp-3">"{source}"</p>
      {loading && <p className="text-xs text-silver">Translating…</p>}
      {error && <p className="text-xs text-pomegranate-400">{error}</p>}
      {translation && <p className="text-sm">{translation}</p>}
    </div>
  );
}
