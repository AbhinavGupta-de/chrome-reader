import React, { useEffect, useMemo, useState } from "react";
import { VocabWord, LeitnerRating } from "../lib/vocab/types";
import AudioButton from "./AudioButton";

interface Props {
  items: VocabWord[];
  onRate: (id: string, rating: LeitnerRating) => Promise<void>;
  onClose: () => void;
}

const MAX_PER_SESSION = 50;

export default function ReviewModal({ items, onRate, onClose }: Props) {
  const due = useMemo(() => {
    const now = Date.now();
    return items
      .filter((w) => !w.mastered && w.nextReviewAt <= now)
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
      .slice(0, MAX_PER_SESSION);
  }, [items]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = due[index];
  const total = due.length;

  useEffect(() => {
    setRevealed(false);
  }, [index]);

  const rate = async (rating: LeitnerRating) => {
    if (!card) return;
    await onRate(card.id, rating);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!revealed && e.key === " ") { e.preventDefault(); setRevealed(true); }
      if (revealed) {
        if (e.key === "1") rate("again");
        if (e.key === "2") rate("hard");
        if (e.key === "3") rate("good");
        if (e.key === "4") rate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, card]);

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-4">No words due for review right now. Come back tomorrow!</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-2">All caught up.</p>
          <p className="text-xs text-silver mb-4">{total} word{total === 1 ? "" : "s"} reviewed.</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  const firstContext = card.contexts[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="clay-card !p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-silver">{index + 1} / {total} due</span>
          <button onClick={onClose} className="text-silver text-xs hover:text-clay-black">✕</button>
        </div>

        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 className="text-3xl font-semibold">{card.word}</h2>
            <AudioButton text={card.word} url={card.audioUrl} size={18} />
          </div>
          {card.phonetic && <p className="text-sm text-silver">{card.phonetic}</p>}
        </div>

        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="clay-btn-solid w-full text-sm">
            Reveal (Space)
          </button>
        ) : (
          <div>
            <div className="border-t border-oat pt-4 mb-4 space-y-2">
              {card.definitions.slice(0, 3).map((d, i) => (
                <div key={i} className="text-sm">
                  <span className="italic text-silver text-xs">{d.partOfSpeech} </span>
                  <span>{d.definition}</span>
                </div>
              ))}
              {firstContext && (
                <p className="text-xs text-silver mt-2 italic">
                  From "{firstContext.bookTitle}" (ch. {firstContext.chapterIndex + 1}): …{firstContext.sentence}…
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => rate("again")} className="clay-btn-white text-xs !py-2 text-pomegranate-400">Again</button>
              <button onClick={() => rate("hard")} className="clay-btn-white text-xs !py-2">Hard</button>
              <button onClick={() => rate("good")} className="clay-btn-white text-xs !py-2 text-matcha-600">Good</button>
              <button onClick={() => rate("easy")} className="clay-btn-solid text-xs !py-2">Easy</button>
            </div>
            <p className="text-[10px] text-silver text-center mt-2">1 / 2 / 3 / 4</p>
          </div>
        )}
      </div>
    </div>
  );
}
