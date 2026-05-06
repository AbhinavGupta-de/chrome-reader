import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GOOGLE_API_BASE,
  GOOGLE_DEFAULT_MODEL,
  buildGoogleApiUrl,
  createGoogleClient,
} from "../../src/newtab/lib/ai/google";

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

describe("createGoogleClient", () => {
  let restore: () => void;
  let calls: CapturedRequest[];

  beforeEach(() => {
    const installed = installFetchMock({
      candidates: [{ content: { parts: [{ text: "gemini reply" }] } }],
    });
    restore = installed.restore;
    calls = installed.calls;
  });

  afterEach(() => restore());

  it("sendsGenerateContentRequestWithKeyInQueryString", async () => {
    const client = createGoogleClient("AIzaTEST");

    const explanation = await client.explain("foo", "bar");

    expect(explanation).toBe("gemini reply");
    expect(calls[0].url).toBe(buildGoogleApiUrl(GOOGLE_DEFAULT_MODEL, "AIzaTEST"));
    expect(calls[0].url.startsWith(GOOGLE_API_BASE)).toBe(true);
    expect(calls[0].url).toContain("key=AIzaTEST");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.systemInstruction.parts[0].text).toContain("reading assistant");
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[0].parts[0].text).toContain("explain this passage");
  });

  it("urlEncodesApiKeyAndModelName", async () => {
    const url = buildGoogleApiUrl("gemini-3.1-pro-preview", "AIza key with spaces");
    expect(url).toContain("key=AIza%20key%20with%20spaces");
  });
});
