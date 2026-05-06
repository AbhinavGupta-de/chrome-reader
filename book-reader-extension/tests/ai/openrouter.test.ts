import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OPENROUTER_API_URL,
  OPENROUTER_DEFAULT_MODEL,
  createOpenRouterClient,
} from "../../src/newtab/lib/ai/openrouter";

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function installFetchMock(responseBody: unknown): { calls: CapturedRequest[]; restore: () => void } {
  const calls: CapturedRequest[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(responseBody), { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

describe("createOpenRouterClient", () => {
  let restore: () => void;
  let calls: CapturedRequest[];

  beforeEach(() => {
    const installed = installFetchMock({
      choices: [{ message: { content: "router reply" } }],
    });
    restore = installed.restore;
    calls = installed.calls;
  });

  afterEach(() => restore());

  it("sendsOpenAiCompatibleRequestWithBearerAndIdentityHeaders", async () => {
    const client = createOpenRouterClient("or-key");

    const summary = await client.summarize("text");

    expect(summary).toBe("router reply");
    expect(calls[0].url).toBe(OPENROUTER_API_URL);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer or-key");
    expect(headers["HTTP-Referer"]).toBeTruthy();
    expect(headers["X-Title"]).toBeTruthy();
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe(OPENROUTER_DEFAULT_MODEL);
  });

  it("respectsModelOverride", async () => {
    const client = createOpenRouterClient("or-key", "openai/gpt-5.5");
    await client.summarize("x");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("openai/gpt-5.5");
  });
});
