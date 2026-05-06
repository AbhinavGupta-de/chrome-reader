import { describe, it, expect, beforeEach } from "vitest";
import {
  BYOK_STORAGE_KEY,
  getCachedByok,
  loadByokIntoCache,
  setCachedByok,
  getEmptyByokConfig,
} from "../../src/newtab/lib/ai/byok-cache";
import { getConfiguredProvider } from "../../src/newtab/lib/ai/byok-helpers";
import { resetChromeStorageStub } from "../setup";

beforeEach(() => {
  resetChromeStorageStub();
  setCachedByok(getEmptyByokConfig());
});

describe("byok storage round-trip", () => {
  it("loadsStoredConfigIntoCacheIncludingModelsField", async () => {
    await chrome.storage.local.set({
      [BYOK_STORAGE_KEY]: {
        activeProvider: "anthropic",
        keys: { anthropic: "sk-ant-Z" },
        models: { anthropic: "claude-opus-4-5" },
      },
    });

    await loadByokIntoCache();

    const cached = getCachedByok();
    expect(cached.activeProvider).toBe("anthropic");
    expect(cached.keys.anthropic).toBe("sk-ant-Z");
    expect(cached.models.anthropic).toBe("claude-opus-4-5");
  });

  it("returnsEmptyConfigWhenStorageIsBlank", async () => {
    await loadByokIntoCache();

    const cached = getCachedByok();
    expect(cached.activeProvider).toBeNull();
    expect(cached.keys).toEqual({});
    expect(cached.models).toEqual({});
  });

  it("propagatesStorageOnChangedUpdatesIntoCache", async () => {
    await loadByokIntoCache();

    await chrome.storage.local.set({
      [BYOK_STORAGE_KEY]: {
        activeProvider: "openai",
        keys: { openai: "sk-foo" },
        models: {},
      },
    });

    expect(getCachedByok().activeProvider).toBe("openai");
    expect(getCachedByok().keys.openai).toBe("sk-foo");
  });
});

describe("getConfiguredProvider", () => {
  it("returnsActiveProviderWhenItsKeyIsNonEmpty", () => {
    expect(
      getConfiguredProvider({
        activeProvider: "google",
        keys: { google: "AIza" },
        models: {},
      }),
    ).toBe("google");
  });

  it("returnsNullWhenActiveProviderIsSetButKeyIsMissing", () => {
    expect(
      getConfiguredProvider({
        activeProvider: "google",
        keys: {},
        models: {},
      }),
    ).toBeNull();
  });

  it("returnsNullWhenActiveProviderIsNull", () => {
    expect(
      getConfiguredProvider({
        activeProvider: null,
        keys: { anthropic: "sk-ant-X" },
        models: {},
      }),
    ).toBeNull();
  });

  it("returnsNullWhenKeyExistsButIsEmptyString", () => {
    expect(
      getConfiguredProvider({
        activeProvider: "openrouter",
        keys: { openrouter: "" },
        models: {},
      }),
    ).toBeNull();
  });
});
