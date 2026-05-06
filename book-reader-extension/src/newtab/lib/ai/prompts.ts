/**
 * Prompt templates lifted verbatim from
 * `book-reader-api/src/services/ai.ts` and `translate.ts`. Kept here so all
 * direct provider clients share a single source of truth with the backend.
 *
 * Each template returns `{ system, user }`. Providers map these to their
 * specific request shape (Anthropic system field, OpenAI/OpenRouter
 * `messages: [{role: "system"}, {role: "user"}]`, Google
 * `systemInstruction` + `contents`).
 */

export interface PromptPair {
  system: string;
  user: string;
}

const MAX_CHAPTER_TEXT_LENGTH = 8000;
const MAX_CONTEXT_LENGTH = 6000;
const MAX_EXPLAIN_CONTEXT_LENGTH = 4000;
const MAX_TRANSLATE_TEXT_LENGTH = 4000;

export function buildSummarizePrompt(chapterText: string): PromptPair {
  return {
    system:
      "You are a helpful reading assistant. Provide concise, insightful chapter summaries that capture the key themes, events, and character developments. Keep summaries to 3-5 paragraphs.",
    user: `Please summarize the following chapter:\n\n${chapterText.slice(0, MAX_CHAPTER_TEXT_LENGTH)}`,
  };
}

export function buildAskPrompt(question: string, context: string): PromptPair {
  return {
    system:
      "You are a knowledgeable reading companion. Answer questions about books thoughtfully and accurately based on the provided context. If the answer isn't in the context, say so honestly.",
    user: `Context from the book:\n${context.slice(0, MAX_CONTEXT_LENGTH)}\n\nQuestion: ${question}`,
  };
}

export function buildHighlightsPrompt(chapterText: string): PromptPair {
  return {
    system:
      "You are a literary analyst. Extract the 5-8 most important or memorable passages from the text. Return each passage as a direct quote on its own line, prefixed with a dash (-).",
    user: `Extract key passages from:\n\n${chapterText.slice(0, MAX_CHAPTER_TEXT_LENGTH)}`,
  };
}

export function buildExplainPrompt(selection: string, context: string): PromptPair {
  return {
    system:
      "You are a thoughtful reading assistant. When asked to explain a passage, provide context about its meaning, literary significance, vocabulary, or historical references as appropriate. Be concise but insightful.",
    user: `Surrounding context:\n${context.slice(0, MAX_EXPLAIN_CONTEXT_LENGTH)}\n\nPlease explain this passage:\n"${selection}"`,
  };
}

export function buildTranslatePrompt(text: string, targetLang: string): PromptPair {
  return {
    system:
      'You are a precise translator. Reply with ONLY a single JSON object of shape {"detectedLang":"<bcp47>","translation":"..."}. No prose, no code fences.',
    user: `Translate the following text to ${targetLang}:\n\n${text.slice(0, MAX_TRANSLATE_TEXT_LENGTH)}`,
  };
}

/**
 * Parse the model's bullet-list highlight response into a clean string array.
 * Mirrors the post-processing the backend `ai.ts` does after `chat()` returns.
 */
export function parseHighlightLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.length > 0);
}

interface ParsedTranslation {
  translation: string;
  detectedLang?: string;
}

/**
 * Parse the model's translate JSON response. Falls back to the raw text if
 * parsing fails — matches the backend `translate.ts` defensive logic.
 */
export function parseTranslateResponse(raw: string): ParsedTranslation {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { translation?: unknown; detectedLang?: unknown };
    if (typeof parsed.translation !== "string") {
      throw new Error("missing translation");
    }
    const detected = typeof parsed.detectedLang === "string" ? parsed.detectedLang : undefined;
    return { translation: parsed.translation, detectedLang: detected };
  } catch {
    return { translation: raw.trim() };
  }
}
