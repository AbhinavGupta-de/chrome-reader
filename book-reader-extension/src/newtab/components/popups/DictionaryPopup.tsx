import React, { useEffect, useMemo, useState } from "react";
import { DictEntry } from "../../lib/dictionary";
import { useDismissable } from "../../hooks/useClickOutside";
import AudioButton from "../AudioButton";

interface Props {
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
  selectionText: string;
  contextSentence: string;
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  isSaved: boolean;
  audioUrlFromEntry?: string;
  onAutoSave: (entry: DictEntry, contextSentence: string) => void;
  onUnsave: () => void;
  onClose: () => void;
}

export default function DictionaryPopup(props: Props) {
  const { loading, entry, notFoundWord, rect, selectionText, contextSentence, isSaved, audioUrlFromEntry, onAutoSave, onUnsave, onClose } = props;
  const top = rect.bottom + 8;
  const left = rect.left;
  const ref = useDismissable<HTMLDivElement>(true, onClose);

  const [autoSaveFired, setAutoSaveFired] = useState(false);
  useEffect(() => {
    if (autoSaveFired) return;
    if (loading || !entry) return;
    onAutoSave(entry, contextSentence);
    setAutoSaveFired(true);
  }, [autoSaveFired, loading, entry, contextSentence, onAutoSave]);

  const ttsText = useMemo(() => entry?.word ?? notFoundWord ?? selectionText, [entry, notFoundWord, selectionText]);

  return (
    <div
      ref={ref}
      className="fixed z-50 clay-card !p-3 w-72 max-h-80 overflow-y-auto"
      style={{ top, left }}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{entry?.word ?? notFoundWord ?? "…"}</p>
            <AudioButton text={ttsText} url={audioUrlFromEntry} size={13} />
          </div>
          {entry?.phonetic && <p className="text-xs text-silver">{entry.phonetic}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {entry && (
            <button
              onClick={isSaved ? onUnsave : () => entry && onAutoSave(entry, contextSentence)}
              title={isSaved ? "Saved — click to remove" : "Save"}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                isSaved
                  ? "bg-matcha-300/20 text-matcha-600 border-matcha-300"
                  : "bg-clay-white text-silver border-oat hover:text-clay-black"
              }`}
            >
              {isSaved ? "✓ Saved" : "○ Save"}
            </button>
          )}
          <button onClick={onClose} className="text-silver text-xs px-1">✕</button>
        </div>
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
