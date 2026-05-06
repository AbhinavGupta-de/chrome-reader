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
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Body content for the right-side AI panel. The Panel container owns the
 * header (title + close X); this component renders quick-action buttons,
 * scrolling message list, and the text input.
 */
export default function AIPanel({
  onSummarize,
  onAsk,
  onHighlights,
  onExplain,
  selectedText,
  loading,
  error,
  available,
  onSignIn,
}: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const append = (role: ChatMessage["role"], content: string) =>
    setMessages((prev) => [...prev, { role, content }]);

  const handleSummarize = async () => {
    append("user", "Summarize this chapter");
    const reply = await onSummarize();
    if (reply) append("assistant", reply);
  };
  const handleHighlights = async () => {
    append("user", "Show key highlights");
    const items = await onHighlights();
    if (items) append("assistant", items.map((entry, index) => `${index + 1}. ${entry}`).join("\n\n"));
  };
  const handleExplain = async () => {
    if (!selectedText) return;
    append("user", `Explain: "${selectedText.slice(0, 80)}..."`);
    const reply = await onExplain(selectedText);
    if (reply) append("assistant", reply);
  };
  const handleAsk = async () => {
    if (!input.trim()) return;
    const question = input.trim();
    setInput("");
    append("user", question);
    const reply = await onAsk(question);
    if (reply) append("assistant", reply);
  };

  return (
    <div className="flex flex-col h-full">
      {!available && (
        <div className="px-4 py-5 text-center border-b border-oat">
          <p className="text-sm text-charcoal mb-1">
            {navigator.onLine ? "Sign in to unlock AI" : "AI needs internet"}
          </p>
          <p className="text-xs text-silver mb-3">Summaries, Q&amp;A, highlights, and explanations.</p>
          {navigator.onLine && (
            <button onClick={onSignIn} className="clay-btn-solid text-xs !py-1.5 !px-4">
              Sign in with Google
            </button>
          )}
        </div>
      )}
      {available && (
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-oat">
          <button onClick={handleSummarize} disabled={loading} className="clay-btn-white text-xs !py-1 !px-2.5 disabled:opacity-50">Summarize</button>
          <button onClick={handleHighlights} disabled={loading} className="clay-btn-white text-xs !py-1 !px-2.5 disabled:opacity-50">Highlights</button>
          {selectedText && (
            <button onClick={handleExplain} disabled={loading} className="clay-btn-white text-xs !py-1 !px-2.5 disabled:opacity-50">Explain</button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && available && (
          <p className="text-xs text-silver text-center py-6">Ask about the book, get summaries, or highlights.</p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`text-sm rounded-[12px] px-3 py-2 max-w-[90%] whitespace-pre-wrap ${
              message.role === "user"
                ? "bg-clay-black text-clay-white ml-auto"
                : "clay-card !rounded-[12px] !p-3"
            }`}
          >
            {message.content}
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
      <div className="px-4 py-3 border-t border-oat">
        <form onSubmit={(event) => { event.preventDefault(); handleAsk(); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
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
