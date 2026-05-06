import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OPENAI_API_URL,
  OPENAI_DEFAULT_MODEL,
  createOpenAiClient,
} from "../../src/newtab/lib/ai/openai";

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function installFetchMock(responseBody: unknown): { calls: CapturedRequest[]; restore: () => void } {
  const calls: CapturedRequest[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

describe("createOpenAiClient", () => {
  let restore: () => void;
  let calls: CapturedRequest[];

  beforeEach(() => {
    const installed = installFetchMock({
      choices: [{ message: { content: "answer body" } }],
    });
    restore = installed.restore;
    calls = installed.calls;
  });

  afterEach(() => {
    restore();
  });

  it("sendsChatCompletionsRequestWithBearerAuth", async () => {
    const client = createOpenAiClient("oai-key");

    const answer = await client.ask("why?", "context here");

    expect(answer).toBe("answer body");
    expect(calls[0].url).toBe(OPENAI_API_URL);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer oai-key");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe(OPENAI_DEFAULT_MODEL);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });

  it("respectsModelOverride", async () => {
    const client = createOpenAiClient("oai-key", "gpt-5.5-mini");
    await client.summarize("hi");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("gpt-5.5-mini");
  });
});
