/**
 * AI client surface — every provider (Anthropic, OpenAI, Google, OpenRouter)
 * and the server fallback implements this interface so the router can swap
 * implementations behind one signature.
 */

export type AiProvider = "anthropic" | "openai" | "google" | "openrouter";
export type AiSource = "server" | AiProvider;

export interface AiTranslateResult {
  text: string;
  detectedLang?: string;
}

export interface AiClient {
  summarize(chapterText: string): Promise<string>;
  ask(question: string, context: string): Promise<string>;
  highlights(chapterText: string): Promise<string[]>;
  explain(selection: string, context: string): Promise<string>;
  translate(text: string, targetLang: string): Promise<AiTranslateResult>;
}
