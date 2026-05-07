/**
 * Public API surface of the extension.
 *
 * Non-AI endpoints (auth, position sync, highlights, vocab) keep their
 * existing shapes and call the shared `request` helper from `lib/http.ts`.
 *
 * AI endpoints keep their public signatures + return shapes
 * (`{summary}`, `{answer}`, `{highlights}`, `{explanation}`,
 * `{translation, detectedLang?}`) but their bodies now route through
 * `getAiClient(bookHash)` so direct provider calls work the same as
 * the server fallback.
 */

export {
  setAuthToken,
  getAuthToken,
  isAuthenticated,
  isOnline,
} from "./http";

import { request } from "./http";
import { getAiClient } from "./ai/router";

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function authenticateWithGoogle(
  idToken: string,
): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

// ── Position sync ────────────────────────────────────────────────────────────

export interface RemotePosition {
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  scrollOffset: number;
  percentage: number;
  updatedAt: string;
}

export async function syncPosition(
  bookHash: string,
  bookTitle: string,
  chapterIndex: number,
  scrollOffset: number,
  percentage: number,
): Promise<RemotePosition> {
  return request(`/position/${bookHash}`, {
    method: "PUT",
    body: JSON.stringify({ bookTitle, chapterIndex, scrollOffset, percentage }),
  });
}

export async function getRemotePosition(bookHash: string): Promise<RemotePosition | null> {
  try {
    return await request(`/position/${bookHash}`);
  } catch {
    return null;
  }
}

// ── AI features ──────────────────────────────────────────────────────────────

export async function aiSummarize(
  bookHash: string,
  chapterText: string,
): Promise<{ summary: string }> {
  return { summary: await getAiClient(bookHash).summarize(chapterText) };
}

export async function aiAsk(
  bookHash: string,
  question: string,
  context: string,
): Promise<{ answer: string }> {
  return { answer: await getAiClient(bookHash).ask(question, context) };
}

export async function aiHighlights(
  bookHash: string,
  chapterText: string,
): Promise<{ highlights: string[] }> {
  return { highlights: await getAiClient(bookHash).highlights(chapterText) };
}

export async function aiExplain(
  bookHash: string,
  selection: string,
  context: string,
): Promise<{ explanation: string }> {
  return { explanation: await getAiClient(bookHash).explain(selection, context) };
}

export async function aiTranslate(
  bookHash: string,
  text: string,
  targetLang: string,
): Promise<{ translation: string; detectedLang?: string }> {
  const result = await getAiClient(bookHash).translate(text, targetLang);
  return { translation: result.text, detectedLang: result.detectedLang };
}

// ── Highlights sync ──────────────────────────────────────────────────────────

export interface RemoteHighlight {
  id: string;
  clientId: string;
  bookHash: string;
  chapterIndex: number;
  startOffset: number;
  length: number;
  contextBefore: string;
  contextAfter: string;
  text: string;
  color: string;
  note: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export async function listRemoteHighlights(bookHash: string): Promise<RemoteHighlight[]> {
  const r = await request<{ highlights: RemoteHighlight[] }>(`/highlights/${bookHash}`);
  return r.highlights;
}

export async function putRemoteHighlight(
  bookHash: string,
  clientId: string,
  body: {
    chapterIndex: number;
    startOffset: number;
    length: number;
    contextBefore: string;
    contextAfter: string;
    text: string;
    color: string;
    note?: string | null;
  },
): Promise<{ id: string; clientId: string }> {
  return request(`/highlights/${bookHash}/${clientId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRemoteHighlight(bookHash: string, clientId: string): Promise<void> {
  await request(`/highlights/${bookHash}/${clientId}`, { method: "DELETE" });
}

// ── Vocabulary sync ──────────────────────────────────────────────────────────

export interface RemoteVocabWord {
  id: string;
  clientId: string;
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  definitions: unknown;
  contexts: unknown;
  stage: number;
  mastered: boolean;
  nextReviewAt: string;
  lastReviewAt: string | null;
  correctStreak: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export async function listRemoteVocab(): Promise<RemoteVocabWord[]> {
  const r = await request<{ words: RemoteVocabWord[] }>(`/vocabulary`);
  return r.words;
}

export async function putRemoteVocab(
  clientId: string,
  body: {
    word: string;
    phonetic: string | null;
    audioUrl: string | null;
    definitions: unknown;
    contexts: unknown;
    stage: number;
    mastered: boolean;
    nextReviewAt: number;
    lastReviewAt: number | null;
    correctStreak: number;
  },
): Promise<{ id: string; clientId: string }> {
  return request(`/vocabulary/${clientId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRemoteVocab(clientId: string): Promise<void> {
  await request(`/vocabulary/${clientId}`, { method: "DELETE" });
}
