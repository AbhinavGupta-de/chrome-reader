import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  ANTHROPIC_DEFAULT_MODEL,
  BROWSER_DIRECT_HEADER,
  createAnthropicClient,
} from "../../src/newtab/lib/ai/anthropic";

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

describe("createAnthropicClient", () => {
  let restore: () => void;
  let calls: CapturedRequest[];

  beforeEach(() => {
    const installed = installFetchMock({ content: [{ type: "text", text: "summary body" }] });
    restore = installed.restore;
    calls = installed.calls;
  });

  afterEach(() => {
    restore();
  });

  it("sendsClaudeMessagesRequestWithDangerousBrowserHeader", async () => {
    const client = createAnthropicClient("test-key");

    const summary = await client.summarize("hello world");

    expect(summary).toBe("summary body");
    expect(calls).toHaveLength(1);
    const request = calls[0];
    expect(request.url).toBe(ANTHROPIC_API_URL);
    expect(request.init.method).toBe("POST");
    const headers = request.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBe(ANTHROPIC_API_VERSION);
    expect(headers[BROWSER_DIRECT_HEADER]).toBe("true");
    const body = JSON.parse(request.init.body as string);
    expect(body.model).toBe(ANTHROPIC_DEFAULT_MODEL);
    expect(body.system).toContain("reading assistant");
    expect(body.messages[0]).toMatchObject({ role: "user" });
  });

  it("respectsModelOverrideWhenProvided", async () => {
    const client = createAnthropicClient("test-key", "claude-opus-4-5");

    await client.summarize("text");

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("claude-opus-4-5");
  });

  it("parsesHighlightLinesIntoArray", async () => {
    restore();
    const installed = installFetchMock({
      content: [{ type: "text", text: "- one\n- two\n- three" }],
    });
    restore = installed.restore;
    calls = installed.calls;

    const client = createAnthropicClient("test-key");
    const result = await client.highlights("any text");

    expect(result).toEqual(["one", "two", "three"]);
  });

  it("parsesTranslateJsonIntoTextAndDetectedLang", async () => {
    restore();
    const installed = installFetchMock({
      content: [
        { type: "text", text: '{"detectedLang":"es","translation":"hola"}' },
      ],
    });
    restore = installed.restore;
    calls = installed.calls;

    const client = createAnthropicClient("test-key");
    const result = await client.translate("hello", "es");

    expect(result.text).toBe("hola");
    expect(result.detectedLang).toBe("es");
  });

  it("throwsWhenAnthropicReturnsNonOkStatus", async () => {
    restore();
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("rate limit", { status: 429 })) as typeof fetch;
    const restoreLocal = () => {
      globalThis.fetch = original;
    };

    const client = createAnthropicClient("test-key");
    await expect(client.summarize("x")).rejects.toThrow(/429/);

    restoreLocal();
  });
});
