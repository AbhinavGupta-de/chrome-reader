import React from "react";
import { DictEntry } from "../../lib/dictionary";

interface Props {
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
  onClose: () => void;
}

export default function DictionaryPopup({ loading, entry, notFoundWord, rect, onClose }: Props) {
  const top = rect.bottom + 8;
  const left = rect.left;
  return (
    <div
      className="fixed z-50 clay-card !p-3 w-72 max-h-80 overflow-y-auto"
      style={{ top, left }}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-semibold">{entry?.word ?? notFoundWord ?? "…"}</p>
          {entry?.phonetic && <p className="text-xs text-silver">{entry.phonetic}</p>}
        </div>
        <button onClick={onClose} className="text-silver text-xs">✕</button>
      </div>
      {loading && <p className="text-xs text-silver">Looking up…</p>}
      {!loading && !entry && notFoundWord && (
        <p className="text-xs text-silver">No definition found for "{notFoundWord}".</p>
      )}
      {entry?.meanings.map((m, i) => (
        <div key={i} className="mb-2">
          <p className="text-xs italic text-silver mb-0.5">{m.partOfSpeech}</p>
          {m.definitions.slice(0, 3).map((d, j) => (
            <div key={j} className="text-xs mb-1">
              <p>{d.definition}</p>
              {d.example && <p className="text-silver italic mt-0.5">"{d.example}"</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
