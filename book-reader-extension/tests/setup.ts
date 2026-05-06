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
type ChromeChangeListener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  areaName: string,
) => void;

const onChangedListeners: ChromeChangeListener[] = [];

const chromeStub = {
  storage: {
    local: {
      _store: {} as Record<string, unknown>,
      async get(key: string | string[] | null) {
        const store = (chromeStub.storage.local as any)._store as Record<string, unknown>;
        if (key === null) {
          return { ...store };
        }
        const keys = Array.isArray(key) ? key : [key];
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in store) {
            out[k] = store[k];
          }
        }
        return out;
      },
      async set(items: Record<string, unknown>) {
        const store = (chromeStub.storage.local as any)._store as Record<string, unknown>;
        const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { oldValue: store[key], newValue: value };
          store[key] = value;
        }
        for (const listener of onChangedListeners) {
          listener(changes, "local");
        }
      },
      async remove(key: string | string[]) {
        const store = (chromeStub.storage.local as any)._store as Record<string, unknown>;
        const keys = Array.isArray(key) ? key : [key];
        const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
        for (const k of keys) {
          if (k in store) {
            changes[k] = { oldValue: store[k], newValue: undefined };
            delete store[k];
          }
        }
        for (const listener of onChangedListeners) {
          listener(changes, "local");
        }
      },
    },
    onChanged: {
      addListener(listener: ChromeChangeListener) {
        onChangedListeners.push(listener);
      },
      removeListener(listener: ChromeChangeListener) {
        const idx = onChangedListeners.indexOf(listener);
        if (idx >= 0) onChangedListeners.splice(idx, 1);
      },
    },
  },
};
(globalThis as any).chrome = chromeStub;

/** Test helper: wipe the chrome.storage.local stub between tests. */
export function resetChromeStorageStub(): void {
  (chromeStub.storage.local as any)._store = {};
  onChangedListeners.length = 0;
}
