import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// jsdom does not implement Range#getBoundingClientRect or
// Range#getClientRects. Provide minimal stubs so hooks/components that
// read selection geometry can run under the test harness.
if (typeof Range !== "undefined") {
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function () {
      return {
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      } as unknown as DOMRectList;
    };
  }
}

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
