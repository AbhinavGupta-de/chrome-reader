import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Stub chrome.* surface used by lib/storage.ts
const chromeStub = {
  storage: {
    local: {
      _store: {} as Record<string, unknown>,
      async get(key: string | string[]) {
        const keys = Array.isArray(key) ? key : [key];
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in (chromeStub.storage.local as any)._store) {
            out[k] = (chromeStub.storage.local as any)._store[k];
          }
        }
        return out;
      },
      async set(items: Record<string, unknown>) {
        Object.assign((chromeStub.storage.local as any)._store, items);
      },
    },
  },
};
(globalThis as any).chrome = chromeStub;
