/**
 * Shared AiClient assembler.
 *
 * Every direct provider client only differs in the `callModel` function
 * (URL, headers, request body shape, response parsing). Once that is
 * captured, the five `AiClient` methods (summarize/ask/highlights/explain/
 * translate) are identical across providers — they call the prompt builder,
 * dispatch via `callModel`, and post-process two of the results
 * (`highlights` parses bullet lines, `translate` parses JSON).
 */

import type { AiClient, AiTranslateResult } from "./types";
import {
  buildAskPrompt,
  buildExplainPrompt,
  buildHighlightsPrompt,
  buildSummarizePrompt,
  buildTranslatePrompt,
  parseHighlightLines,
  parseTranslateResponse,
  type PromptPair,
} from "./prompts";

export type ModelCaller = (prompt: PromptPair) => Promise<string>;

export function buildAiClientFromCaller(callModel: ModelCaller): AiClient {
  return {
    async summarize(chapterText: string): Promise<string> {
      return callModel(buildSummarizePrompt(chapterText));
    },
    async ask(question: string, context: string): Promise<string> {
      return callModel(buildAskPrompt(question, context));
    },
    async highlights(chapterText: string): Promise<string[]> {
      const raw = await callModel(buildHighlightsPrompt(chapterText));
      return parseHighlightLines(raw);
    },
    async explain(selection: string, context: string): Promise<string> {
      return callModel(buildExplainPrompt(selection, context));
    },
    async translate(text: string, targetLang: string): Promise<AiTranslateResult> {
      const raw = await callModel(buildTranslatePrompt(text, targetLang));
      const parsed = parseTranslateResponse(raw);
      return { text: parsed.translation, detectedLang: parsed.detectedLang };
    },
  };
}

export function resolveModel(modelOverride: string | undefined, defaultModel: string): string {
  return modelOverride && modelOverride.length > 0 ? modelOverride : defaultModel;
}
