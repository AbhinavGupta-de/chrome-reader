import React, { useMemo, useState } from "react";
import { VocabWord } from "../lib/vocab/types";
import AudioButton from "./AudioButton";
import { wordsToCsv, downloadCsv } from "../lib/vocab/csv";

type WordsSortKey = "recent" | "alpha" | "seen" | "due";
type WordsScope = "all" | "book";

interface WordsPanelProps {
  items: VocabWord[];
  currentBookHash: string | null;
  dueCount: number;
  onDelete: (id: string) => void;
  onResetStage: (id: string) => void;
  onReview: () => void;
  onQuiz: () => void;
}

/**
 * Body for the words right-side panel. The Panel container owns the header
 * (title + close X); this component renders the search/sort controls and
 * scrollable word list.
 */
export default function WordsPanel({
  items,
  currentBookHash,
  dueCount,
  onDelete,
  onResetStage,
  onReview,
  onQuiz,
}: WordsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<WordsSortKey>("recent");
  const [scope, setScope] = useState<WordsScope>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let arr = items.slice();
    if (scope === "book" && currentBookHash) {
      arr = arr.filter((word) => word.contexts.some((context) => context.bookHash === currentBookHash));
    }
    if (searchQuery.trim()) {
      const needle = searchQuery.trim().toLowerCase();
      arr = arr.filter((word) => word.word.includes(needle));
    }
    arr.sort((a, b) => {
      if (sortKey === "alpha") return a.word.localeCompare(b.word);
      if (sortKey === "seen") return b.contexts.length - a.contexts.length;
      if (sortKey === "due") return a.nextReviewAt - b.nextReviewAt;
      return b.createdAt - a.createdAt;
    });
    return arr;
  }, [items, searchQuery, sortKey, scope, currentBookHash]);

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandId = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = () => {
    for (const id of selectedIds) onDelete(id);
    setSelectedIds(new Set());
  };

  const exportCsv = () => {
    const csv = wordsToCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`vocabulary-${date}.csv`, csv);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-oat space-y-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search words…"
          className="w-full px-2.5 py-1.5 text-xs rounded-[8px] border border-oat bg-clay-white"
          aria-label="Search saved words"
        />
        <div className="flex gap-1.5 text-xs">
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as WordsSortKey)}
            className="flex-1 px-2 py-1 rounded-[6px] border border-oat bg-clay-white"
            aria-label="Sort words"
          >
            <option value="recent">Recent</option>
            <option value="alpha">A–Z</option>
            <option value="seen">Most seen</option>
            <option value="due">Due first</option>
          </select>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as WordsScope)}
            className="flex-1 px-2 py-1 rounded-[6px] border border-oat bg-clay-white"
            aria-label="Word scope"
          >
            <option value="all">All books</option>
            <option value="book" disabled={!currentBookHash}>This book</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onReview} disabled={dueCount === 0} className="flex-1 clay-btn-solid text-xs !py-1.5 disabled:opacity-50">
            Review {dueCount > 0 && `(${dueCount})`}
          </button>
          <button onClick={onQuiz} disabled={items.length === 0} className="flex-1 clay-btn-white text-xs !py-1.5 disabled:opacity-50">
            Quiz me
          </button>
          <button onClick={exportCsv} disabled={items.length === 0} className="clay-btn-white text-xs !py-1.5 !px-2.5 disabled:opacity-50" title="Export CSV">
            ⤓
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-silver text-center py-6">
            {items.length === 0 ? "No saved words yet — click Define on any word to start." : "No words match."}
          </p>
        )}
        {filtered.map((word) => {
          const isOpen = expandedIds.has(word.id);
          const isSelected = selectedIds.has(word.id);
          const stageLabel = word.mastered ? "✓ Mastered" : `Stage ${word.stage}`;
          return (
            <div key={word.id} className="clay-card !p-2 text-xs">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectId(word.id)}
                  className="mt-1"
                />
                <button onClick={() => toggleExpandId(word.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold truncate">{word.word}</span>
                    {word.phonetic && <span className="text-silver text-[10px]">{word.phonetic}</span>}
                  </div>
                  <p className="text-silver text-[11px] truncate mt-0.5">{word.definitions[0]?.definition ?? ""}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-silver">
                      Seen {word.contexts.length}× in {new Set(word.contexts.map((c) => c.bookHash)).size}
                    </span>
                    <span className="text-[10px] text-silver">·</span>
                    <span className="text-[10px] text-silver">{stageLabel}</span>
                  </div>
                </button>
                <AudioButton text={word.word} url={word.audioUrl} size={12} />
              </div>
              {isOpen && (
                <div className="pt-2 mt-2 border-t border-oat space-y-1.5">
                  {word.definitions.map((def, index) => (
                    <div key={index}>
                      <p className="text-silver italic text-[10px]">{def.partOfSpeech}</p>
                      <p>{def.definition}</p>
                      {def.example && <p className="text-silver italic">"{def.example}"</p>}
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-oat">
                    <p className="text-[10px] font-medium text-silver mb-1">Contexts</p>
                    {word.contexts.map((context, index) => (
                      <p key={index} className="text-[11px] mb-0.5">
                        <span className="text-silver">[{context.bookTitle}, ch.{context.chapterIndex + 1}]</span> …{context.sentence}…
                      </p>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button onClick={() => onResetStage(word.id)} className="text-[10px] text-silver hover:text-clay-black">↻ Reset</button>
                    <button onClick={() => onDelete(word.id)} className="text-[10px] text-pomegranate-400">🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedIds.size > 0 && (
        <div className="border-t border-oat px-3 py-2 flex items-center justify-between bg-cream">
          <span className="text-xs">{selectedIds.size} selected</span>
          <button onClick={bulkDelete} className="text-xs text-pomegranate-400 font-medium">Delete</button>
        </div>
      )}
    </div>
  );
}
