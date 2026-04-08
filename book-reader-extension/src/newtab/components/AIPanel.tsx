import React, { useState } from "react";

interface AIPanelProps {
  onSummarize: () => Promise<string | null>;
  onAsk: (question: string) => Promise<string | null>;
  onHighlights: () => Promise<string[] | null>;
  onExplain: (selection: string) => Promise<string | null>;
  selectedText: string;
  loading: boolean;
  error: string | null;
  available: boolean;
  onSignIn: () => void;
  onClose: () => void;
}

interface Message { role: "user" | "assistant"; content: string; }

export default function AIPanel({ onSummarize, onAsk, onHighlights, onExplain, selectedText, loading, error, available, onSignIn, onClose }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const add = (role: Message["role"], content: string) =>
    setMessages((prev) => [...prev, { role, content }]);

  const handleSummarize = async () => { add("user", "Summarize this chapter"); const r = await onSummarize(); if (r) add("assistant", r); };
  const handleHighlights = async () => { add("user", "Show key highlights"); const r = await onHighlights(); if (r) add("assistant", r.map((h, i) => `${i + 1}. ${h}`).join("\n\n")); };
  const handleExplain = async () => { if (!selectedText) return; add("user", `Explain: "${selectedText.slice(0, 80)}..."`); const r = await onExplain(selectedText); if (r) add("assistant", r); };
  const handleAsk = async () => { if (!input.trim()) return; const q = input.trim(); setInput(""); add("user", q); const r = await onAsk(q); if (r) add("assistant", r); };

  return (
    <div className="w-80 border-l border-oat bg-clay-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-oat">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${available ? "bg-matcha-600" : "bg-silver"}`} />
          AI Assistant
        </h3>
        <button onClick={onClose} className="clay-btn-white !p-1.5 !rounded-[8px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Unavailable */}
      {!available && (
        <div className="px-4 py-6 text-center border-b border-oat">
          <p className="text-sm text-charcoal mb-1">
            {navigator.onLine ? "Sign in to unlock AI" : "AI needs internet"}
          </p>
          <p className="text-xs text-silver mb-3">Summaries, Q&A, highlights, and explanations.</p>
          {navigator.onLine && (
            <button onClick={onSignIn} className="clay-btn-solid text-xs !py-1.5 !px-4">Sign in with Google</button>
          )}
        </div>
      )}

      {/* Quick actions */}
      {available && (
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-oat">
          <button onClick={handleSummarize} disabled={loading} className="clay-btn-white text-xs !py-1 !px-2.5 disabled:opacity-50">Summarize</button>
          <button onClick={handleHighlights} disabled={loading} className="clay-btn-white text-xs !py-1 !px-2.5 disabled:opacity-50">Highlights</button>
          {selectedText && (
            <button onClick={handleExplain} disabled={loading} className="clay-btn-white text-xs !py-1 !px-2.5 disabled:opacity-50">Explain</button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && available && (
          <p className="text-xs text-silver text-center py-6">Ask about the book, get summaries, or highlights.</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm rounded-[12px] px-3 py-2 max-w-[90%] whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-clay-black text-clay-white ml-auto"
                : "clay-card !rounded-[12px] !p-3"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 text-silver">
            <span className="w-1.5 h-1.5 rounded-full bg-matcha-600 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-matcha-600 animate-bounce" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-matcha-600 animate-bounce" style={{ animationDelay: "0.3s" }} />
          </div>
        )}
        {error && <p className="text-xs text-pomegranate-400 bg-pomegranate-400/10 px-3 py-2 rounded-[8px]">{error}</p>}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-oat">
        <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex gap-2">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={available ? "Ask about the book..." : "Sign in to ask..."}
            disabled={!available}
            className="flex-1 px-3 py-2 text-sm rounded-[4px] border border-oat bg-clay-white text-clay-black placeholder:text-silver focus:outline-2 focus:outline-[rgb(20,110,245)] disabled:opacity-50"
          />
          <button type="submit" disabled={loading || !input.trim() || !available} className="clay-btn-solid text-sm !py-2 !px-3 disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
