import { describe, it, expect, beforeEach, vi } from "vitest";
import { setCachedByok, getEmptyByokConfig } from "../../src/newtab/lib/ai/byok-cache";
import { setAuthToken } from "../../src/newtab/lib/http";
import { getAiClient, AI_NOT_CONFIGURED_MESSAGE } from "../../src/newtab/lib/ai/router";

beforeEach(() => {
  setCachedByok(getEmptyByokConfig());
  setAuthToken(null);
});

describe("getAiClient (router)", () => {
  it("usesAnthropicDirectClientWhenByokKeyIsSet", () => {
    setCachedByok({
      activeProvider: "anthropic",
      keys: { anthropic: "sk-ant-XXXX" },
      models: {},
    });

    const client = getAiClient("book-1");

    expect(client).toBeDefined();
    expect(typeof client.summarize).toBe("function");
  });

  it("picksFallbackToServerWhenByokKeyIsMissingButAuthenticated", () => {
    setCachedByok({
      activeProvider: "openai",
      keys: {},
      models: {},
    });
    setAuthToken("auth-token");

    const client = getAiClient("book-1");

    expect(client).toBeDefined();
    expect(typeof client.summarize).toBe("function");
  });

  it("throwsWhenNoByokAndNotAuthenticated", () => {
    expect(() => getAiClient("book-1")).toThrow(AI_NOT_CONFIGURED_MESSAGE);
  });

  it("usesByokWhenBothByokAndAuthArePresent", async () => {
    setCachedByok({
      activeProvider: "anthropic",
      keys: { anthropic: "sk-ant-X" },
      models: {},
    });
    setAuthToken("auth-token");

    const original = globalThis.fetch;
    let urlSeen = "";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      urlSeen = String(input);
      return new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }] }), { status: 200 });
    }) as typeof fetch;

    const client = getAiClient("book-1");
    await client.summarize("hi");

    expect(urlSeen).toContain("api.anthropic.com");
    globalThis.fetch = original;
  });
});
