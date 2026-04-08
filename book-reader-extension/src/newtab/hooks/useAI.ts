import { useState, useCallback } from "react";
import { aiSummarize, aiAsk, aiHighlights, aiExplain, isAuthenticated, isOnline } from "../lib/api";

const OFFLINE_MSG = "AI features require an internet connection. Please go online and sign in to use them.";
const UNAUTH_MSG = "Sign in with Google to use AI features.";

function checkAvailability(): string | null {
  if (!isOnline()) return OFFLINE_MSG;
  if (!isAuthenticated()) return UNAUTH_MSG;
  return null;
}

export function useAI(bookHash: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = isOnline() && isAuthenticated();

  const summarize = useCallback(
    async (chapterText: string): Promise<string | null> => {
      if (!bookHash) return null;
      const unavailable = checkAvailability();
      if (unavailable) { setError(unavailable); return null; }
      setLoading(true);
      setError(null);
      try {
        const result = await aiSummarize(bookHash, chapterText);
        return result.summary;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Summarization failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [bookHash]
  );

  const ask = useCallback(
    async (question: string, context: string): Promise<string | null> => {
      if (!bookHash) return null;
      const unavailable = checkAvailability();
      if (unavailable) { setError(unavailable); return null; }
      setLoading(true);
      setError(null);
      try {
        const result = await aiAsk(bookHash, question, context);
        return result.answer;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Question failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [bookHash]
  );

  const highlights = useCallback(
    async (chapterText: string): Promise<string[] | null> => {
      if (!bookHash) return null;
      const unavailable = checkAvailability();
      if (unavailable) { setError(unavailable); return null; }
      setLoading(true);
      setError(null);
      try {
        const result = await aiHighlights(bookHash, chapterText);
        return result.highlights;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Highlights failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [bookHash]
  );

  const explain = useCallback(
    async (selection: string, context: string): Promise<string | null> => {
      if (!bookHash) return null;
      const unavailable = checkAvailability();
      if (unavailable) { setError(unavailable); return null; }
      setLoading(true);
      setError(null);
      try {
        const result = await aiExplain(bookHash, selection, context);
        return result.explanation;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Explanation failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [bookHash]
  );

  return { loading, error, available, summarize, ask, highlights, explain };
}
