/**
 * Server-fallback AI client.
 *
 * Routes calls through the existing backend `/ai/*` endpoints. The backend
 * is the path used when the user is signed in with Google but has not
 * configured BYOK. Unwraps the backend's `{summary}`/`{answer}`/etc.
 * envelopes into the bare strings/arrays expected by `AiClient`.
 *
 * The backend routes require `bookHash` for cache scoping; the router
 * passes it to this constructor so direct clients (which do not need it)
 * can ignore the field.
 */

import type { AiClient, AiTranslateResult } from "./types";
import { request } from "../http";

const SUMMARIZE_PATH = "/ai/summarize";
const ASK_PATH = "/ai/ask";
const HIGHLIGHTS_PATH = "/ai/highlights";
const EXPLAIN_PATH = "/ai/explain";
const TRANSLATE_PATH = "/ai/translate";

interface SummarizeResponse {
  summary: string;
}
interface AskResponse {
  answer: string;
}
interface HighlightsResponse {
  highlights: string[];
}
interface ExplainResponse {
  explanation: string;
}
interface TranslateResponse {
  translation: string;
  detectedLang?: string;
}

function requireBookHash(bookHash: string | null): string {
  if (!bookHash) {
    throw new Error("Server AI client requires a book hash; open a book first.");
  }
  return bookHash;
}

export function createServerClient(bookHash: string | null): AiClient {
  return {
    async summarize(chapterText: string): Promise<string> {
      const body = JSON.stringify({ bookHash: requireBookHash(bookHash), text: chapterText });
      const response = await request<SummarizeResponse>(SUMMARIZE_PATH, { method: "POST", body });
      return response.summary;
    },
    async ask(question: string, context: string): Promise<string> {
      const body = JSON.stringify({ bookHash: requireBookHash(bookHash), question, context });
      const response = await request<AskResponse>(ASK_PATH, { method: "POST", body });
      return response.answer;
    },
    async highlights(chapterText: string): Promise<string[]> {
      const body = JSON.stringify({ bookHash: requireBookHash(bookHash), text: chapterText });
      const response = await request<HighlightsResponse>(HIGHLIGHTS_PATH, { method: "POST", body });
      return response.highlights;
    },
    async explain(selection: string, context: string): Promise<string> {
      const body = JSON.stringify({ bookHash: requireBookHash(bookHash), selection, context });
      const response = await request<ExplainResponse>(EXPLAIN_PATH, { method: "POST", body });
      return response.explanation;
    },
    async translate(text: string, targetLang: string): Promise<AiTranslateResult> {
      const body = JSON.stringify({ bookHash: requireBookHash(bookHash), text, targetLang });
      const response = await request<TranslateResponse>(TRANSLATE_PATH, { method: "POST", body });
      return { text: response.translation, detectedLang: response.detectedLang };
    },
  };
}
