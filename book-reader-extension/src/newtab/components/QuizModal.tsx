import React, { useEffect, useMemo, useRef, useState } from "react";
import { VocabWord } from "../lib/vocab/types";

interface Props {
  items: VocabWord[];
  onClose: () => void;
}

const QUESTIONS_PER_SESSION = 10;

interface Question {
  word: VocabWord;
  blanked: string;
  answer: string;
}

function buildQuestions(items: VocabWord[]): Question[] {
  const usable = items.filter((w) => !w.deleted && w.contexts.length > 0);
  const shuffled = [...usable].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_SESSION);
  return shuffled.map((w) => {
    const c = w.contexts[Math.floor(Math.random() * w.contexts.length)];
    const re = new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const blanked = c.sentence.replace(re, "_____");
    return { word: w, blanked, answer: w.word.toLowerCase() };
  });
}

export default function QuizModal({ items, onClose }: Props) {
  const questions = useMemo(() => buildQuestions(items), [items]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState<{ correct: boolean } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const q = questions[index];

  useEffect(() => {
    setInput("");
    setSubmitted(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-4">Save some words first — quizzes need at least one saved word.</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-2">Quiz finished.</p>
          <p className="text-2xl font-semibold mb-4">{score.correct} / {score.total}</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (submitted) {
      setIndex((i) => i + 1);
      return;
    }
    const correct = input.trim().toLowerCase() === q.answer;
    setSubmitted({ correct });
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="clay-card !p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-silver">{index + 1} / {questions.length}</span>
          <button onClick={onClose} className="text-silver text-xs hover:text-clay-black">✕</button>
        </div>

        <p className="text-sm leading-relaxed mb-4">{q.blanked}</p>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!submitted}
            placeholder="Type the missing word…"
            className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white"
          />
          {submitted && (
            <div className="mt-3 text-sm">
              {submitted.correct ? (
                <p className="text-matcha-600">✓ Correct</p>
              ) : (
                <p className="text-pomegranate-400">✕ Answer: <strong>{q.answer}</strong></p>
              )}
              <p className="text-xs text-silver mt-1">{q.word.definitions[0]?.definition ?? ""}</p>
            </div>
          )}
          <button type="submit" className="clay-btn-solid w-full text-sm mt-4">
            {submitted ? "Next" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
