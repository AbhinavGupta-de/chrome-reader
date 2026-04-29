import React, { useMemo, useState } from "react";
import { VocabWord } from "../lib/vocab/types";
import AudioButton from "./AudioButton";
import { wordsToCsv, downloadCsv } from "../lib/vocab/csv";

type SortKey = "recent" | "alpha" | "seen" | "due";

interface Props {
  items: VocabWord[];
  currentBookHash: string | null;
  dueCount: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  onResetStage: (id: string) => void;
  onReview: () => void;
  onQuiz: () => void;
}

export default function WordsPanel({ items, currentBookHash, dueCount, onClose, onDelete, onResetStage, onReview, onQuiz }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [scope, setScope] = useState<"all" | "book">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let arr = items.slice();
    if (scope === "book" && currentBookHash) {
      arr = arr.filter((w) => w.contexts.some((c) => c.bookHash === currentBookHash));
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((w) => w.word.includes(s));
    }
    arr.sort((a, b) => {
      if (sort === "alpha") return a.word.localeCompare(b.word);
      if (sort === "seen") return b.contexts.length - a.contexts.length;
      if (sort === "due") return a.nextReviewAt - b.nextReviewAt;
      return b.createdAt - a.createdAt;
    });
    return arr;
  }, [items, search, sort, scope, currentBookHash]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = () => {
    for (const id of selected) onDelete(id);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const csv = wordsToCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`vocabulary-${date}.csv`, csv);
  };

  return (
    <div className="w-80 border-l border-oat bg-clay-white flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-oat">
        <h3 className="text-sm font-semibold">Words ({items.length})</h3>
        <button onClick={onClose} className="clay-btn-white !p-1.5 !rounded-[8px]">✕</button>
      </div>

      <div className="px-3 py-2 border-b border-oat space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words…"
          className="w-full px-2.5 py-1.5 text-xs rounded-[8px] border border-oat bg-clay-white"
        />
        <div className="flex gap-1.5 text-xs">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="flex-1 px-2 py-1 rounded-[6px] border border-oat bg-clay-white">
            <option value="recent">Recent</option>
            <option value="alpha">A–Z</option>
            <option value="seen">Most seen</option>
            <option value="due">Due first</option>
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value as "all" | "book")} className="flex-1 px-2 py-1 rounded-[6px] border border-oat bg-clay-white">
            <option value="all">All books</option>
            <option value="book" disabled={!currentBookHash}>This book</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onReview}
            disabled={dueCount === 0}
            className="flex-1 clay-btn-solid text-xs !py-1.5 disabled:opacity-50"
          >
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
        {filtered.map((w) => {
          const isOpen = expanded.has(w.id);
          const isSel = selected.has(w.id);
          const stageLabel = w.mastered ? "✓ Mastered" : `Stage ${w.stage}`;
          return (
            <div key={w.id} className="clay-card !p-2 text-xs">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggleSelect(w.id)}
                  className="mt-1"
                />
                <button onClick={() => toggleExpand(w.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold truncate">{w.word}</span>
                    {w.phonetic && <span className="text-silver text-[10px]">{w.phonetic}</span>}
                  </div>
                  <p className="text-silver text-[11px] truncate mt-0.5">{w.definitions[0]?.definition ?? ""}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-silver">
                      Seen {w.contexts.length}× in {new Set(w.contexts.map((c) => c.bookHash)).size}
                    </span>
                    <span className="text-[10px] text-silver">·</span>
                    <span className="text-[10px] text-silver">{stageLabel}</span>
                  </div>
                </button>
                <AudioButton text={w.word} url={w.audioUrl} size={12} />
              </div>
              {isOpen && (
                <div className="pt-2 mt-2 border-t border-oat space-y-1.5">
                  {w.definitions.map((d, i) => (
                    <div key={i}>
                      <p className="text-silver italic text-[10px]">{d.partOfSpeech}</p>
                      <p>{d.definition}</p>
                      {d.example && <p className="text-silver italic">"{d.example}"</p>}
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-oat">
                    <p className="text-[10px] font-medium text-silver mb-1">Contexts</p>
                    {w.contexts.map((c, i) => (
                      <p key={i} className="text-[11px] mb-0.5">
                        <span className="text-silver">[{c.bookTitle}, ch.{c.chapterIndex + 1}]</span> …{c.sentence}…
                      </p>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button onClick={() => onResetStage(w.id)} className="text-[10px] text-silver hover:text-clay-black">↻ Reset</button>
                    <button onClick={() => onDelete(w.id)} className="text-[10px] text-pomegranate-400">🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="border-t border-oat px-3 py-2 flex items-center justify-between bg-cream">
          <span className="text-xs">{selected.size} selected</span>
          <button onClick={bulkDelete} className="text-xs text-pomegranate-400 font-medium">Delete</button>
        </div>
      )}
    </div>
  );
}
