import { describe, it, expect, vi, afterEach } from "vitest";
import { OPENAI_API_URL, createOpenAiClient } from "../../src/newtab/lib/ai/openai";

const original = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = original;
});

describe("OpenAI endpoint guard", () => {
  it("usesChatCompletionsEndpointAndNotResponsesApi", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createOpenAiClient("test-key");
    await client.summarize("hi");

    expect(capturedUrl).toBe(OPENAI_API_URL);
    expect(capturedUrl.endsWith("/v1/chat/completions")).toBe(true);
    expect(capturedUrl.includes("/v1/responses")).toBe(false);
  });
});
