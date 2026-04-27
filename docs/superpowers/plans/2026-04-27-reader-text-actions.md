# Reader Text Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating selection toolbar to the Chrome-extension reader that exposes four text actions on selected text — Highlight (with color picker + persisted), Define (free dictionary API), Translate (Claude-backed, server-side), and Web Search (new tab).

**Architecture:** A new `useSelection` hook tracks the active `Range` from `window.getSelection()` and computes a viewport position. A `SelectionToolbar` component renders above the selection with action buttons. Each action is independent: web-search is client-only; dictionary uses a free public API; translate adds a new authenticated `/ai/translate` Hono route + Claude prompt + cache; highlights persist in IndexedDB and mirror to a new `highlights` table when signed in. Highlights re-anchor by `chapterIndex + plain-text offset + 50 chars of surrounding context`, then are rendered by walking text nodes and wrapping the range in `<mark>`. Scope of v1 is EPUB and TXT; PDF text-layer integration is deferred.

**Tech Stack:** React 19, Tailwind 4, IndexedDB via `idb`, Hono, Drizzle ORM, PostgreSQL, Anthropic SDK, Vitest (added), `api.dictionaryapi.dev` (free, no key).

---

## File Structure

### Extension (`book-reader-extension/`)

**Create:**
- `src/newtab/hooks/useSelection.ts` — tracks selection state + position
- `src/newtab/hooks/useHighlights.ts` — load / mutate / sync highlights
- `src/newtab/components/SelectionToolbar.tsx` — floating action bar
- `src/newtab/components/popups/DictionaryPopup.tsx` — defs + examples
- `src/newtab/components/popups/TranslatePopup.tsx` — translation result
- `src/newtab/components/popups/HighlightEditPopup.tsx` — color + note + delete
- `src/newtab/components/HighlightsPanel.tsx` — sidebar list
- `src/newtab/lib/dictionary.ts` — free dictionary API client
- `src/newtab/lib/highlights/storage.ts` — IndexedDB CRUD for highlights
- `src/newtab/lib/highlights/anchor.ts` — anchor build + DOM range resolution
- `src/newtab/lib/highlights/render.ts` — wrap ranges in `<mark>` after chapter render
- `src/newtab/lib/highlights/sync.ts` — debounced backend sync
- `src/newtab/lib/highlights/types.ts` — shared types
- `tests/setup.ts` — vitest setup (jsdom)
- `tests/lib/dictionary.test.ts`
- `tests/lib/highlights/anchor.test.ts`
- `tests/lib/highlights/storage.test.ts`
- `tests/hooks/useSelection.test.ts`
- `vitest.config.ts`

**Modify:**
- `package.json` — add vitest, jsdom, @testing-library/react, fake-indexeddb; add `test` script
- `public/manifest.json` — add `host_permissions` for dictionary API
- `src/newtab/App.tsx` — render `SelectionToolbar` + `HighlightsPanel`; pass highlights to `Reader`
- `src/newtab/components/Reader.tsx` — replace `onMouseUp` selectedText flow with `useSelection`; render highlights after content paint
- `src/newtab/lib/storage.ts` — add `translateTo` to `ReaderSettings` + default
- `src/newtab/lib/api.ts` — add `aiTranslate` + highlight CRUD calls
- `src/newtab/components/Settings.tsx` — surface `translateTo` selector

### API (`book-reader-api/`)

**Create:**
- `src/services/translate.ts` — Claude translation w/ cache
- `src/routes/highlights.ts` — Hono routes: list / create / update / delete
- `src/services/highlights.ts` — DB queries
- `src/db/migrations/0001_highlights.sql` — `drizzle-kit generate` output

**Modify:**
- `src/db/schema.ts` — add `highlights` table
- `src/services/ai.ts` — re-export translate or add inline (we'll add separate file)
- `src/routes/ai.ts` — add `POST /ai/translate`
- `src/index.ts` — mount `/highlights`
- `src/types.ts` — no change expected, keep eye on `AppVariables`

---

## Phase 0 — Test Harness

### Task 0.1: Add Vitest to the extension

**Files:**
- Modify: `book-reader-extension/package.json`
- Create: `book-reader-extension/vitest.config.ts`
- Create: `book-reader-extension/tests/setup.ts`

- [ ] **Step 1: Add dev deps**

Run from `book-reader-extension/`:

```bash
npm install --save-dev vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 fake-indexeddb@^6
```

- [ ] **Step 2: Add `test` script to `package.json`**

Edit `book-reader-extension/package.json`, replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `book-reader-extension/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

Create `book-reader-extension/tests/setup.ts`:

```ts
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
```

- [ ] **Step 5: Sanity test runs**

Run from `book-reader-extension/`:

```bash
npm test
```

Expected output: `No test files found`. (No tests yet — that's fine. Exit code 0 or message saying no files; either is acceptable proof harness loads.)

- [ ] **Step 6: Commit**

```bash
git add book-reader-extension/package.json book-reader-extension/package-lock.json book-reader-extension/vitest.config.ts book-reader-extension/tests/setup.ts
git commit -m "chore: add vitest harness with jsdom + fake-indexeddb"
```

---

## Phase 1 — Selection Toolbar Foundation

### Task 1.1: `useSelection` hook (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/hooks/useSelection.ts`
- Create: `book-reader-extension/tests/hooks/useSelection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `book-reader-extension/tests/hooks/useSelection.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelection } from "../../src/newtab/hooks/useSelection";

function selectAllInside(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

describe("useSelection", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = "<p>hello world</p>";
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    window.getSelection()?.removeAllRanges();
  });

  it("returns null when nothing is selected", () => {
    const { result } = renderHook(() => useSelection(host));
    expect(result.current).toBeNull();
  });

  it("returns the selected text and a position when a selection exists inside the container", () => {
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    expect(result.current).not.toBeNull();
    expect(result.current!.text).toBe("hello world");
    expect(typeof result.current!.rect.top).toBe("number");
  });

  it("ignores selections outside the container", () => {
    const outside = document.createElement("p");
    outside.textContent = "ignore me";
    document.body.appendChild(outside);
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(outside);
    });
    expect(result.current).toBeNull();
    outside.remove();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run from `book-reader-extension/`:

```bash
npm test -- tests/hooks/useSelection.test.ts
```

Expected: FAIL — `Failed to resolve import "../../src/newtab/hooks/useSelection"`.

- [ ] **Step 3: Implement `useSelection`**

Create `book-reader-extension/src/newtab/hooks/useSelection.ts`:

```ts
import { useEffect, useState, useCallback } from "react";

export interface SelectionState {
  text: string;
  rect: DOMRect;
  range: Range;
}

function readSelection(container: HTMLElement | null): SelectionState | null {
  if (!container) return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  return { text, rect: range.getBoundingClientRect(), range };
}

export function useSelection(container: HTMLElement | null): SelectionState | null {
  const [state, setState] = useState<SelectionState | null>(null);

  const update = useCallback(() => {
    setState(readSelection(container));
  }, [container]);

  useEffect(() => {
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [update]);

  return state;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test -- tests/hooks/useSelection.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/hooks/useSelection.ts book-reader-extension/tests/hooks/useSelection.test.ts
git commit -m "feat(reader): add useSelection hook scoped to a container"
```

### Task 1.2: `SelectionToolbar` component

**Files:**
- Create: `book-reader-extension/src/newtab/components/SelectionToolbar.tsx`

- [ ] **Step 1: Implement component**

Create `book-reader-extension/src/newtab/components/SelectionToolbar.tsx`:

```tsx
import React from "react";

export type ToolbarAction = "highlight" | "define" | "translate" | "search" | "explain";

interface Props {
  rect: DOMRect;
  hasExplain: boolean;
  onAction: (action: ToolbarAction, payload?: { color?: HighlightColor }) => void;
}

export type HighlightColor = "yellow" | "green" | "pink" | "blue";

const COLOR_SWATCH: Record<HighlightColor, string> = {
  yellow: "#fde68a",
  green: "#bbf7d0",
  pink: "#fbcfe8",
  blue: "#bfdbfe",
};

export default function SelectionToolbar({ rect, hasExplain, onAction }: Props) {
  const top = Math.max(window.scrollY + rect.top - 48, window.scrollY + 8);
  const left = window.scrollX + rect.left + rect.width / 2;
  const [showColors, setShowColors] = React.useState(false);

  return (
    <div
      className="absolute z-50 -translate-x-1/2 clay-card flex items-center gap-1 !rounded-[1584px] px-2 py-1 shadow-md"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()} // keep selection alive
    >
      {showColors ? (
        <>
          {(Object.keys(COLOR_SWATCH) as HighlightColor[]).map((c) => (
            <button
              key={c}
              aria-label={`Highlight ${c}`}
              className="w-6 h-6 rounded-full border border-oat"
              style={{ background: COLOR_SWATCH[c] }}
              onClick={() => {
                onAction("highlight", { color: c });
                setShowColors(false);
              }}
            />
          ))}
          <button
            className="text-xs px-2 text-silver"
            onClick={() => setShowColors(false)}
          >
            cancel
          </button>
        </>
      ) : (
        <>
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => setShowColors(true)}>
            Highlight
          </button>
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("define")}>
            Define
          </button>
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("translate")}>
            Translate
          </button>
          <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("search")}>
            Web
          </button>
          {hasExplain && (
            <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("explain")}>
              Explain
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to confirm no TS errors**

Run from `book-reader-extension/`:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/components/SelectionToolbar.tsx
git commit -m "feat(reader): add SelectionToolbar with color picker"
```

### Task 1.3: Wire toolbar into Reader

**Files:**
- Modify: `book-reader-extension/src/newtab/components/Reader.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Replace selection logic in Reader.tsx**

In `book-reader-extension/src/newtab/components/Reader.tsx`, do the following edits:

Replace the existing `onTextSelect` prop type with a richer one. Replace the `interface ReaderProps` block:

```tsx
import { useSelection } from "../hooks/useSelection";
import SelectionToolbar, { ToolbarAction, HighlightColor } from "./SelectionToolbar";

interface ReaderProps {
  book: LoadedBook;
  position: ReadingPosition | null;
  settings: ReaderSettings;
  onPositionChange: (chapterIndex: number, scrollOffset: number, percentage: number) => void;
  onSelectionAction: (
    action: ToolbarAction,
    payload: { text: string; range: Range; rect: DOMRect; color?: HighlightColor; chapterIndex: number; chapterText: string }
  ) => void;
  hasExplain: boolean;
}
```

Replace the destructure of props (the `function Reader({...})` line) with:

```tsx
export default function Reader({ book, position, settings, onPositionChange, onSelectionAction, hasExplain }: ReaderProps) {
```

Delete the existing `handleMouseUp` definition. Add this block right above the `useEffect` that listens for keyboard:

```tsx
const selection = useSelection(contentRef.current);

const dispatchAction = useCallback(
  (action: ToolbarAction, payload?: { color?: HighlightColor }) => {
    if (!selection) return;
    onSelectionAction(action, {
      text: selection.text,
      range: selection.range,
      rect: selection.rect,
      color: payload?.color,
      chapterIndex,
      chapterText: plainText,
    });
    if (action !== "highlight") {
      window.getSelection()?.removeAllRanges();
    }
  },
  [selection, onSelectionAction, chapterIndex, plainText]
);
```

Then on the scrolling container `<div ref={contentRef} ...>` remove the `onMouseUp={handleMouseUp}` attribute.

Finally, just before the closing `</div>` of the outer container (the line `</div>` immediately after the bottom progress block), add:

```tsx
{selection && (
  <SelectionToolbar rect={selection.rect} hasExplain={hasExplain} onAction={dispatchAction} />
)}
```

- [ ] **Step 2: Update App.tsx call sites**

In `book-reader-extension/src/newtab/App.tsx`:

Replace `const handleTextSelect = useCallback(...)` with:

```tsx
const handleSelectionAction = useCallback(
  (action: import("./components/SelectionToolbar").ToolbarAction, p: { text: string; range: Range; rect: DOMRect; color?: import("./components/SelectionToolbar").HighlightColor; chapterIndex: number; chapterText: string }) => {
    setSelectedText(p.text); // keep AIPanel "Explain" working
    if (action === "search") {
      const url = `https://www.google.com/search?q=${encodeURIComponent(p.text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "explain") {
      setShowAI(true);
      return;
    }
    // dictionary / translate / highlight handled in later tasks
  },
  []
);
```

Replace the `<Reader ...>` JSX prop list with:

```tsx
<Reader
  book={currentBook}
  position={position}
  settings={settings}
  onPositionChange={handlePositionChange}
  onSelectionAction={handleSelectionAction}
  hasExplain={ai.available}
/>
```

- [ ] **Step 3: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 4: Manual test**

Load `book-reader-extension/dist/` in `chrome://extensions` (Developer mode). Open an EPUB / TXT, select text. Confirm:
- Toolbar appears above selection.
- Clicking "Web" opens a Google search tab with selected text.
- Other buttons do nothing yet (no error).

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/components/Reader.tsx book-reader-extension/src/newtab/App.tsx
git commit -m "feat(reader): replace onMouseUp with selection toolbar; wire web search"
```

---

## Phase 2 — Dictionary

### Task 2.1: Manifest host permissions

**Files:**
- Modify: `book-reader-extension/public/manifest.json`

- [ ] **Step 1: Add dictionary host**

Edit `book-reader-extension/public/manifest.json`. Replace `"host_permissions"` line with:

```json
"host_permissions": [
  "https://*.googleapis.com/*",
  "https://api.dictionaryapi.dev/*"
]
```

- [ ] **Step 2: Commit**

```bash
git add book-reader-extension/public/manifest.json
git commit -m "chore: allow dictionaryapi.dev host"
```

### Task 2.2: Dictionary API client (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/lib/dictionary.ts`
- Create: `book-reader-extension/tests/lib/dictionary.test.ts`

- [ ] **Step 1: Write failing tests**

Create `book-reader-extension/tests/lib/dictionary.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineWord, parseEntries } from "../../src/newtab/lib/dictionary";

const FIXTURE = [
  {
    word: "book",
    phonetic: "/bʊk/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          { definition: "A written or printed work.", example: "I read a book." },
          { definition: "A long written work." },
        ],
      },
      {
        partOfSpeech: "verb",
        definitions: [{ definition: "Reserve in advance." }],
      },
    ],
  },
];

describe("parseEntries", () => {
  it("returns word, phonetic, and grouped meanings", () => {
    const out = parseEntries(FIXTURE as any);
    expect(out).not.toBeNull();
    expect(out!.word).toBe("book");
    expect(out!.phonetic).toBe("/bʊk/");
    expect(out!.meanings).toHaveLength(2);
    expect(out!.meanings[0].partOfSpeech).toBe("noun");
    expect(out!.meanings[0].definitions[0].definition).toBe("A written or printed work.");
    expect(out!.meanings[0].definitions[0].example).toBe("I read a book.");
  });

  it("returns null for empty array", () => {
    expect(parseEntries([])).toBeNull();
  });
});

describe("defineWord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the API with the first lowercased word and returns parsed entries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(FIXTURE), { status: 200 })
    );
    const result = await defineWord("Book Reader");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/book"
    );
    expect(result?.word).toBe("book");
  });

  it("returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    expect(await defineWord("xyzqq")).toBeNull();
  });

  it("strips punctuation from the lookup token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(FIXTURE), { status: 200 })
    );
    await defineWord('"Hello," she said.');
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/hello"
    );
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test -- tests/lib/dictionary.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dictionary.ts`**

Create `book-reader-extension/src/newtab/lib/dictionary.ts`:

```ts
export interface DictDefinition {
  definition: string;
  example?: string;
}

export interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
}

export interface DictEntry {
  word: string;
  phonetic?: string;
  meanings: DictMeaning[];
}

interface RawEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
}

export function parseEntries(raw: RawEntry[]): DictEntry | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  const phonetic = first.phonetic ?? first.phonetics?.find((p) => p.text)?.text;
  return {
    word: first.word,
    phonetic,
    meanings: first.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.map((d) => ({
        definition: d.definition,
        example: d.example,
      })),
    })),
  };
}

function firstWord(text: string): string {
  const cleaned = text.replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim();
  return cleaned.split(/\s+/)[0]?.toLowerCase() ?? "";
}

export async function defineWord(text: string): Promise<DictEntry | null> {
  const word = firstWord(text);
  if (!word) return null;
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as RawEntry[];
  return parseEntries(json);
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test -- tests/lib/dictionary.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/dictionary.ts book-reader-extension/tests/lib/dictionary.test.ts
git commit -m "feat(reader): add dictionary API client with parser tests"
```

### Task 2.3: Dictionary popup UI

**Files:**
- Create: `book-reader-extension/src/newtab/components/popups/DictionaryPopup.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Implement popup**

Create `book-reader-extension/src/newtab/components/popups/DictionaryPopup.tsx`:

```tsx
import React from "react";
import { DictEntry } from "../../lib/dictionary";

interface Props {
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
  onClose: () => void;
}

export default function DictionaryPopup({ loading, entry, notFoundWord, rect, onClose }: Props) {
  const top = window.scrollY + rect.bottom + 8;
  const left = window.scrollX + rect.left;
  return (
    <div
      className="absolute z-50 clay-card !p-3 w-72 max-h-80 overflow-y-auto"
      style={{ top, left }}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-semibold">{entry?.word ?? notFoundWord ?? "…"}</p>
          {entry?.phonetic && <p className="text-xs text-silver">{entry.phonetic}</p>}
        </div>
        <button onClick={onClose} className="text-silver text-xs">✕</button>
      </div>
      {loading && <p className="text-xs text-silver">Looking up…</p>}
      {!loading && !entry && notFoundWord && (
        <p className="text-xs text-silver">No definition found for "{notFoundWord}".</p>
      )}
      {entry?.meanings.map((m, i) => (
        <div key={i} className="mb-2">
          <p className="text-xs italic text-silver mb-0.5">{m.partOfSpeech}</p>
          {m.definitions.slice(0, 3).map((d, j) => (
            <div key={j} className="text-xs mb-1">
              <p>{d.definition}</p>
              {d.example && <p className="text-silver italic mt-0.5">"{d.example}"</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire dictionary action in App.tsx**

In `book-reader-extension/src/newtab/App.tsx`:

Add imports:

```tsx
import DictionaryPopup from "./components/popups/DictionaryPopup";
import { defineWord, DictEntry } from "./lib/dictionary";
```

Add state near the other `useState` lines:

```tsx
const [dict, setDict] = useState<{
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
} | null>(null);
```

In `handleSelectionAction`, replace the `// dictionary / translate / highlight handled in later tasks` line with:

```tsx
if (action === "define") {
  setDict({ loading: true, entry: null, notFoundWord: null, rect: p.rect });
  defineWord(p.text).then((entry) => {
    setDict({
      loading: false,
      entry,
      notFoundWord: entry ? null : p.text.split(/\s+/)[0] ?? p.text,
      rect: p.rect,
    });
  });
  return;
}
```

Inside the JSX, just before the closing fragment of the reader return (right after `<Settings ... />` block), add:

```tsx
{dict && (
  <DictionaryPopup
    loading={dict.loading}
    entry={dict.entry}
    notFoundWord={dict.notFoundWord}
    rect={dict.rect}
    onClose={() => setDict(null)}
  />
)}
```

- [ ] **Step 3: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 4: Manual test**

Reload extension. Select a word, click Define. Confirm popup shows definition or "no definition" fallback.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/components/popups/DictionaryPopup.tsx book-reader-extension/src/newtab/App.tsx
git commit -m "feat(reader): wire Define action to floating dictionary popup"
```

---

## Phase 3 — Translate

### Task 3.1: Backend translate service

**Files:**
- Create: `book-reader-api/src/services/translate.ts`

- [ ] **Step 1: Implement service**

Create `book-reader-api/src/services/translate.ts`:

```ts
import { chat, anthropic } from "../lib/anthropic.js";
import { db } from "../db/index.js";
import { aiCache } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export function isAIAvailable(): boolean {
  return anthropic !== null;
}

function hashRequest(...parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("::")).digest("hex");
}

export async function translateText(
  userId: string,
  bookHash: string,
  text: string,
  targetLang: string
): Promise<{ translation: string; detectedLang?: string }> {
  const reqHash = hashRequest("translate", targetLang, text.slice(0, 4000));

  const cached = await db
    .select()
    .from(aiCache)
    .where(
      and(
        eq(aiCache.userId, userId),
        eq(aiCache.bookHash, bookHash),
        eq(aiCache.requestType, "translate"),
        eq(aiCache.requestHash, reqHash)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (cached) return cached.response as { translation: string; detectedLang?: string };

  const raw = await chat(
    "You are a precise translator. Reply with ONLY a single JSON object of shape {\"detectedLang\":\"<bcp47>\",\"translation\":\"...\"}. No prose, no code fences.",
    `Translate the following text to ${targetLang}:\n\n${text.slice(0, 4000)}`
  );

  let parsed: { translation: string; detectedLang?: string };
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
    if (typeof parsed.translation !== "string") throw new Error("missing translation");
  } catch {
    parsed = { translation: raw.trim() };
  }

  await db.insert(aiCache).values({
    userId,
    bookHash,
    requestType: "translate",
    requestHash: reqHash,
    response: parsed,
  });
  return parsed;
}
```

- [ ] **Step 2: Commit**

```bash
git add book-reader-api/src/services/translate.ts
git commit -m "feat(api): add Claude-backed translation service with cache"
```

### Task 3.2: `/ai/translate` route

**Files:**
- Modify: `book-reader-api/src/routes/ai.ts`

- [ ] **Step 1: Add translate import + route**

In `book-reader-api/src/routes/ai.ts`:

After the existing service imports, add:

```ts
import { translateText } from "../services/translate.js";
```

Just before `export default ai;`, insert:

```ts
ai.post("/translate", async (c) => {
  const userId = c.get("userId") as string;
  const { bookHash, text, targetLang } = await c.req.json<{
    bookHash: string;
    text: string;
    targetLang: string;
  }>();

  if (!bookHash || !text || !targetLang) {
    return c.json({ error: "bookHash, text, and targetLang are required" }, 400);
  }

  try {
    const result = await translateText(userId, bookHash, text, targetLang);
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Translation failed";
    return c.json({ error: msg }, 500);
  }
});
```

- [ ] **Step 2: Build API**

Run from `book-reader-api/`:

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Smoke test the route**

Run from `book-reader-api/`:

```bash
npm run dev
```

In a second terminal, with a JWT (call `/auth/google` or grab one the extension produced):

```bash
curl -X POST http://localhost:3000/ai/translate \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"bookHash":"smoketest","text":"Hello, world","targetLang":"es"}'
```

Expected: JSON `{"translation":"Hola, mundo", ...}` (or similar Spanish output). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add book-reader-api/src/routes/ai.ts
git commit -m "feat(api): expose POST /ai/translate"
```

### Task 3.3: Frontend translate plumbing

**Files:**
- Modify: `book-reader-extension/src/newtab/lib/api.ts`
- Modify: `book-reader-extension/src/newtab/lib/storage.ts`
- Modify: `book-reader-extension/src/newtab/components/Settings.tsx`

- [ ] **Step 1: Add `aiTranslate` API call**

In `book-reader-extension/src/newtab/lib/api.ts`, append to the bottom:

```ts
export async function aiTranslate(
  bookHash: string,
  text: string,
  targetLang: string
): Promise<{ translation: string; detectedLang?: string }> {
  return request("/ai/translate", {
    method: "POST",
    body: JSON.stringify({ bookHash, text, targetLang }),
  });
}
```

- [ ] **Step 2: Add `translateTo` to settings**

In `book-reader-extension/src/newtab/lib/storage.ts`, add `translateTo: string;` to `ReaderSettings` interface and `translateTo: "en",` to `DEFAULT_SETTINGS`.

- [ ] **Step 3: Surface in Settings UI**

In `book-reader-extension/src/newtab/components/Settings.tsx`, add a new control. Locate any existing `<select>` block (e.g. fontFamily) and append after it:

```tsx
<label className="block text-xs text-silver mb-1 mt-3">Translate to</label>
<select
  value={settings.translateTo}
  onChange={(e) => onChange({ ...settings, translateTo: e.target.value })}
  className="w-full clay-input text-sm"
>
  <option value="en">English</option>
  <option value="es">Spanish</option>
  <option value="fr">French</option>
  <option value="de">German</option>
  <option value="it">Italian</option>
  <option value="pt">Portuguese</option>
  <option value="hi">Hindi</option>
  <option value="ja">Japanese</option>
  <option value="zh">Chinese</option>
  <option value="ar">Arabic</option>
</select>
```

(If `clay-input` class doesn't exist, fall back to existing input styling used in this file.)

- [ ] **Step 4: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/api.ts book-reader-extension/src/newtab/lib/storage.ts book-reader-extension/src/newtab/components/Settings.tsx
git commit -m "feat(reader): expose translateTo in settings + aiTranslate API"
```

### Task 3.4: Translate popup + wire action

**Files:**
- Create: `book-reader-extension/src/newtab/components/popups/TranslatePopup.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Create popup**

Create `book-reader-extension/src/newtab/components/popups/TranslatePopup.tsx`:

```tsx
import React from "react";

interface Props {
  loading: boolean;
  source: string;
  translation: string | null;
  error: string | null;
  targetLang: string;
  rect: DOMRect;
  onClose: () => void;
}

export default function TranslatePopup({ loading, source, translation, error, targetLang, rect, onClose }: Props) {
  const top = window.scrollY + rect.bottom + 8;
  const left = window.scrollX + rect.left;
  return (
    <div className="absolute z-50 clay-card !p-3 w-80" style={{ top, left }}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs text-silver">→ {targetLang}</p>
        <button onClick={onClose} className="text-silver text-xs">✕</button>
      </div>
      <p className="text-xs text-silver italic mb-2 line-clamp-3">"{source}"</p>
      {loading && <p className="text-xs text-silver">Translating…</p>}
      {error && <p className="text-xs text-pomegranate-400">{error}</p>}
      {translation && <p className="text-sm">{translation}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire in App.tsx**

In `book-reader-extension/src/newtab/App.tsx`:

Add imports:

```tsx
import TranslatePopup from "./components/popups/TranslatePopup";
import { aiTranslate } from "./lib/api";
```

Add state near the others:

```tsx
const [translate, setTranslate] = useState<{
  loading: boolean;
  source: string;
  translation: string | null;
  error: string | null;
  targetLang: string;
  rect: DOMRect;
} | null>(null);
```

In `handleSelectionAction`, append before the closing `}` of the callback body:

```tsx
if (action === "translate") {
  if (!currentBook) return;
  if (!ai.available) {
    setTranslate({ loading: false, source: p.text, translation: null, error: "Sign in to translate", targetLang: settings.translateTo, rect: p.rect });
    return;
  }
  setTranslate({ loading: true, source: p.text, translation: null, error: null, targetLang: settings.translateTo, rect: p.rect });
  aiTranslate(currentBook.hash, p.text, settings.translateTo)
    .then((r) =>
      setTranslate({ loading: false, source: p.text, translation: r.translation, error: null, targetLang: settings.translateTo, rect: p.rect })
    )
    .catch((e) =>
      setTranslate({ loading: false, source: p.text, translation: null, error: e instanceof Error ? e.message : "Failed", targetLang: settings.translateTo, rect: p.rect })
    );
  return;
}
```

Update the dependency list of the `useCallback` to include `currentBook`, `ai.available`, `settings.translateTo`.

In JSX, near the `DictionaryPopup` rendering, add:

```tsx
{translate && (
  <TranslatePopup
    loading={translate.loading}
    source={translate.source}
    translation={translate.translation}
    error={translate.error}
    targetLang={translate.targetLang}
    rect={translate.rect}
    onClose={() => setTranslate(null)}
  />
)}
```

- [ ] **Step 3: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 4: Manual test**

Sign in. Select text, click Translate. Confirm Spanish (or chosen language) appears.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/components/popups/TranslatePopup.tsx book-reader-extension/src/newtab/App.tsx
git commit -m "feat(reader): wire Translate action with floating popup"
```

---

## Phase 4 — Highlights

### Task 4.1: Highlight types + DB schema

**Files:**
- Create: `book-reader-extension/src/newtab/lib/highlights/types.ts`
- Modify: `book-reader-api/src/db/schema.ts`

- [ ] **Step 1: Create shared types in extension**

Create `book-reader-extension/src/newtab/lib/highlights/types.ts`:

```ts
export type HighlightColor = "yellow" | "green" | "pink" | "blue";

export interface HighlightAnchor {
  chapterIndex: number;
  startOffset: number;       // index in plain-text
  length: number;            // length in plain-text
  contextBefore: string;     // up to 50 chars before
  contextAfter: string;      // up to 50 chars after
}

export interface Highlight {
  id: string;                // uuid v4
  bookHash: string;
  anchor: HighlightAnchor;
  text: string;              // selected text snapshot
  color: HighlightColor;
  note?: string;
  createdAt: number;         // epoch ms
  updatedAt: number;
  syncedAt?: number;         // last successful sync
  deleted?: boolean;         // tombstone for sync
}
```

- [ ] **Step 2: Add Drizzle schema**

In `book-reader-api/src/db/schema.ts`, append:

```ts
export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),       // uuid from client (idempotency)
    bookHash: text("book_hash").notNull(),
    chapterIndex: integer("chapter_index").notNull(),
    startOffset: integer("start_offset").notNull(),
    length: integer("length").notNull(),
    contextBefore: text("context_before").notNull().default(""),
    contextAfter: text("context_after").notNull().default(""),
    text: text("text").notNull(),
    color: text("color").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    uniqueIndex("user_client_id_idx").on(table.userId, table.clientId),
  ]
);
```

- [ ] **Step 3: Generate + apply migration**

Run from `book-reader-api/`:

```bash
npx drizzle-kit generate
```

Expected: a new SQL file under `drizzle/` (or wherever `drizzle.config.ts` points).

Apply it (use whatever the project uses to push migrations — check `package.json`; if `drizzle-kit push`, run):

```bash
npx drizzle-kit push
```

Expected: `highlights` table created.

- [ ] **Step 4: Commit**

```bash
git add book-reader-api/src/db/schema.ts book-reader-api/drizzle book-reader-extension/src/newtab/lib/highlights/types.ts
git commit -m "feat(highlights): add Highlight types + drizzle schema"
```

### Task 4.2: Anchor builder + range resolver (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/lib/highlights/anchor.ts`
- Create: `book-reader-extension/tests/lib/highlights/anchor.test.ts`

- [ ] **Step 1: Write failing tests**

Create `book-reader-extension/tests/lib/highlights/anchor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAnchor, resolveAnchor, anchorRangeFromDom } from "../../../src/newtab/lib/highlights/anchor";

describe("buildAnchor", () => {
  it("captures offsets and bounded context", () => {
    const plain = "The quick brown fox jumps over the lazy dog";
    const anchor = buildAnchor(plain, 10, 5, 0); // "brown"
    expect(anchor.startOffset).toBe(10);
    expect(anchor.length).toBe(5);
    expect(anchor.contextBefore).toBe("The quick ");
    expect(anchor.contextAfter).toBe(" fox jumps over the lazy dog");
  });

  it("clamps context to 50 chars", () => {
    const plain = "x".repeat(100) + "TARGET" + "y".repeat(100);
    const anchor = buildAnchor(plain, 100, 6, 0);
    expect(anchor.contextBefore.length).toBe(50);
    expect(anchor.contextAfter.length).toBe(50);
  });
});

describe("resolveAnchor", () => {
  const plain = "The quick brown fox jumps over the lazy dog";

  it("finds the same offset by direct match", () => {
    const anchor = { chapterIndex: 0, startOffset: 10, length: 5, contextBefore: "The quick ", contextAfter: " fox jumps" };
    expect(resolveAnchor(plain, anchor)).toEqual({ startOffset: 10, length: 5 });
  });

  it("re-finds after content shifts (extra prefix)", () => {
    const shifted = "INTRO. " + plain;
    const anchor = { chapterIndex: 0, startOffset: 10, length: 5, contextBefore: "The quick ", contextAfter: " fox jumps" };
    expect(resolveAnchor(shifted, anchor)).toEqual({ startOffset: 17, length: 5 });
  });

  it("returns null when context cannot be located", () => {
    const anchor = { chapterIndex: 0, startOffset: 10, length: 5, contextBefore: "ZZZ ", contextAfter: " QQQ" };
    expect(resolveAnchor(plain, anchor)).toBeNull();
  });
});

describe("anchorRangeFromDom", () => {
  it("returns a Range spanning the resolved offsets", () => {
    const host = document.createElement("div");
    host.innerHTML = "<p>The quick <b>brown</b> fox</p>";
    document.body.appendChild(host);
    try {
      // plain text length 18: "The quick brown fox"
      const r = anchorRangeFromDom(host, 10, 5);
      expect(r).not.toBeNull();
      expect(r!.toString()).toBe("brown");
    } finally {
      host.remove();
    }
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test -- tests/lib/highlights/anchor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement anchor module**

Create `book-reader-extension/src/newtab/lib/highlights/anchor.ts`:

```ts
import { HighlightAnchor } from "./types";

const CTX = 50;

export function buildAnchor(
  plainText: string,
  startOffset: number,
  length: number,
  chapterIndex: number
): HighlightAnchor {
  return {
    chapterIndex,
    startOffset,
    length,
    contextBefore: plainText.slice(Math.max(0, startOffset - CTX), startOffset),
    contextAfter: plainText.slice(startOffset + length, startOffset + length + CTX),
  };
}

export function resolveAnchor(
  plainText: string,
  anchor: Pick<HighlightAnchor, "startOffset" | "length" | "contextBefore" | "contextAfter">
): { startOffset: number; length: number } | null {
  // Try direct offset match first.
  const at = plainText.slice(anchor.startOffset, anchor.startOffset + anchor.length);
  const before = plainText.slice(Math.max(0, anchor.startOffset - CTX), anchor.startOffset);
  if (before.endsWith(anchor.contextBefore.slice(-Math.min(CTX, anchor.contextBefore.length)))) {
    return { startOffset: anchor.startOffset, length: anchor.length };
  }
  // Fallback: search for contextBefore + (anything length-wide) + contextAfter.
  if (anchor.contextBefore.length === 0 && anchor.contextAfter.length === 0) {
    return null;
  }
  const probe = anchor.contextBefore;
  let from = 0;
  while (from <= plainText.length) {
    const idx = probe.length > 0 ? plainText.indexOf(probe, from) : 0;
    if (idx === -1) return null;
    const candidateStart = idx + probe.length;
    const candidateEnd = candidateStart + anchor.length;
    const after = plainText.slice(candidateEnd, candidateEnd + anchor.contextAfter.length);
    if (after === anchor.contextAfter || (anchor.contextAfter.length === 0 && candidateEnd <= plainText.length)) {
      return { startOffset: candidateStart, length: anchor.length };
    }
    if (probe.length === 0) return null;
    from = idx + 1;
  }
  // ensure linter happy
  void at;
  return null;
}

export function anchorRangeFromDom(
  container: HTMLElement,
  startOffset: number,
  length: number
): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  const targetEnd = startOffset + length;

  let n: Node | null = walker.nextNode();
  while (n) {
    const t = n as Text;
    const len = t.data.length;
    if (!startNode && consumed + len > startOffset) {
      startNode = t;
      startNodeOffset = startOffset - consumed;
    }
    if (startNode && consumed + len >= targetEnd) {
      endNode = t;
      endNodeOffset = targetEnd - consumed;
      break;
    }
    consumed += len;
    n = walker.nextNode();
  }
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

export function offsetsFromRange(
  container: HTMLElement,
  range: Range
): { startOffset: number; length: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let start = -1;
  let end = -1;
  let n: Node | null = walker.nextNode();
  while (n) {
    const t = n as Text;
    const len = t.data.length;
    if (t === range.startContainer) start = consumed + range.startOffset;
    if (t === range.endContainer) {
      end = consumed + range.endOffset;
      break;
    }
    consumed += len;
    n = walker.nextNode();
  }
  if (start === -1 || end === -1 || end <= start) return null;
  return { startOffset: start, length: end - start };
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test -- tests/lib/highlights/anchor.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/highlights/anchor.ts book-reader-extension/tests/lib/highlights/anchor.test.ts
git commit -m "feat(highlights): anchor build, resolution, and DOM range mapping with tests"
```

### Task 4.3: Highlight IndexedDB storage (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/lib/highlights/storage.ts`
- Create: `book-reader-extension/tests/lib/highlights/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `book-reader-extension/tests/lib/highlights/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  putHighlight,
  listHighlights,
  deleteHighlight,
  listAllUnsynced,
  markSynced,
} from "../../../src/newtab/lib/highlights/storage";
import { Highlight } from "../../../src/newtab/lib/highlights/types";

function fixture(overrides: Partial<Highlight> = {}): Highlight {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    bookHash: "bookA",
    anchor: { chapterIndex: 0, startOffset: 0, length: 4, contextBefore: "", contextAfter: "" },
    text: "test",
    color: "yellow",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("highlights storage", () => {
  beforeEach(async () => {
    // wipe DB between tests
    indexedDB.deleteDatabase("book-reader-highlights");
  });

  it("persists and lists highlights by book", async () => {
    const a = fixture({ bookHash: "bookA" });
    const b = fixture({ bookHash: "bookB" });
    await putHighlight(a);
    await putHighlight(b);
    const list = await listHighlights("bookA");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(a.id);
  });

  it("deletes a highlight (tombstone)", async () => {
    const h = fixture();
    await putHighlight(h);
    await deleteHighlight(h.id);
    const list = await listHighlights(h.bookHash);
    expect(list).toHaveLength(0);
  });

  it("lists unsynced and marks synced", async () => {
    const h = fixture();
    await putHighlight(h);
    const pending = await listAllUnsynced();
    expect(pending).toHaveLength(1);
    await markSynced(h.id, Date.now());
    expect(await listAllUnsynced()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test -- tests/lib/highlights/storage.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement storage**

Create `book-reader-extension/src/newtab/lib/highlights/storage.ts`:

```ts
import { openDB, IDBPDatabase } from "idb";
import { Highlight } from "./types";

const DB = "book-reader-highlights";
const STORE = "highlights";

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("byBook", "bookHash", { unique: false });
        s.createIndex("byUnsynced", "syncedAt", { unique: false });
      }
    },
  });
}

export async function putHighlight(h: Highlight): Promise<void> {
  const db = await getDB();
  await db.put(STORE, h);
}

export async function getHighlight(id: string): Promise<Highlight | null> {
  const db = await getDB();
  return ((await db.get(STORE, id)) as Highlight | undefined) ?? null;
}

export async function listHighlights(bookHash: string): Promise<Highlight[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex(STORE, "byBook", bookHash)) as Highlight[];
  return all.filter((h) => !h.deleted).sort((a, b) => a.anchor.chapterIndex - b.anchor.chapterIndex || a.anchor.startOffset - b.anchor.startOffset);
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(STORE, id)) as Highlight | undefined;
  if (!existing) return;
  existing.deleted = true;
  existing.updatedAt = Date.now();
  existing.syncedAt = undefined;
  await db.put(STORE, existing);
}

export async function listAllUnsynced(): Promise<Highlight[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as Highlight[];
  return all.filter((h) => !h.syncedAt || h.syncedAt < h.updatedAt);
}

export async function markSynced(id: string, at: number): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(STORE, id)) as Highlight | undefined;
  if (!existing) return;
  existing.syncedAt = at;
  await db.put(STORE, existing);
}

export async function purgeTombstones(): Promise<void> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as Highlight[];
  for (const h of all) {
    if (h.deleted && h.syncedAt) await db.delete(STORE, h.id);
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test -- tests/lib/highlights/storage.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/highlights/storage.ts book-reader-extension/tests/lib/highlights/storage.test.ts
git commit -m "feat(highlights): IndexedDB storage with sync metadata"
```

### Task 4.4: Backend highlights routes

**Files:**
- Create: `book-reader-api/src/services/highlights.ts`
- Create: `book-reader-api/src/routes/highlights.ts`
- Modify: `book-reader-api/src/index.ts`

- [ ] **Step 1: Implement service**

Create `book-reader-api/src/services/highlights.ts`:

```ts
import { db } from "../db/index.js";
import { highlights } from "../db/schema.js";
import { and, eq, isNull } from "drizzle-orm";

export interface HighlightInput {
  clientId: string;
  bookHash: string;
  chapterIndex: number;
  startOffset: number;
  length: number;
  contextBefore: string;
  contextAfter: string;
  text: string;
  color: string;
  note?: string | null;
}

export async function listHighlightsForBook(userId: string, bookHash: string) {
  return db
    .select()
    .from(highlights)
    .where(
      and(
        eq(highlights.userId, userId),
        eq(highlights.bookHash, bookHash),
        isNull(highlights.deletedAt)
      )
    );
}

export async function upsertHighlight(userId: string, input: HighlightInput) {
  const existing = await db
    .select()
    .from(highlights)
    .where(and(eq(highlights.userId, userId), eq(highlights.clientId, input.clientId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await db
      .update(highlights)
      .set({
        chapterIndex: input.chapterIndex,
        startOffset: input.startOffset,
        length: input.length,
        contextBefore: input.contextBefore,
        contextAfter: input.contextAfter,
        text: input.text,
        color: input.color,
        note: input.note ?? null,
        updatedAt: new Date(),
        deletedAt: null,
      })
      .where(eq(highlights.id, existing.id));
    return { id: existing.id, clientId: input.clientId };
  }

  const inserted = await db
    .insert(highlights)
    .values({
      userId,
      clientId: input.clientId,
      bookHash: input.bookHash,
      chapterIndex: input.chapterIndex,
      startOffset: input.startOffset,
      length: input.length,
      contextBefore: input.contextBefore,
      contextAfter: input.contextAfter,
      text: input.text,
      color: input.color,
      note: input.note ?? null,
    })
    .returning({ id: highlights.id });
  return { id: inserted[0].id, clientId: input.clientId };
}

export async function softDeleteHighlight(userId: string, clientId: string) {
  await db
    .update(highlights)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(highlights.userId, userId), eq(highlights.clientId, clientId)));
}
```

- [ ] **Step 2: Implement routes**

Create `book-reader-api/src/routes/highlights.ts`:

```ts
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  listHighlightsForBook,
  upsertHighlight,
  softDeleteHighlight,
  HighlightInput,
} from "../services/highlights.js";
import type { AppVariables } from "../types.js";

const r = new Hono<{ Variables: AppVariables }>();
r.use("/*", authMiddleware);

r.get("/:bookHash", async (c) => {
  const userId = c.get("userId") as string;
  const bookHash = c.req.param("bookHash");
  const rows = await listHighlightsForBook(userId, bookHash);
  return c.json({ highlights: rows });
});

r.put("/:bookHash/:clientId", async (c) => {
  const userId = c.get("userId") as string;
  const bookHash = c.req.param("bookHash");
  const clientId = c.req.param("clientId");
  const body = await c.req.json<Omit<HighlightInput, "clientId" | "bookHash">>();
  const result = await upsertHighlight(userId, { ...body, clientId, bookHash });
  return c.json(result);
});

r.delete("/:bookHash/:clientId", async (c) => {
  const userId = c.get("userId") as string;
  const clientId = c.req.param("clientId");
  await softDeleteHighlight(userId, clientId);
  return c.json({ ok: true });
});

export default r;
```

- [ ] **Step 3: Mount in `index.ts`**

In `book-reader-api/src/index.ts`:

Add import:

```ts
import highlightRoutes from "./routes/highlights.js";
```

Add mount line below existing `app.route(...)` lines:

```ts
app.route("/highlights", highlightRoutes);
```

- [ ] **Step 4: Type-check**

```bash
cd book-reader-api && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test**

Start `npm run dev`. With a JWT:

```bash
curl -X PUT http://localhost:3000/highlights/bookA/$(uuidgen) \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"chapterIndex":0,"startOffset":10,"length":5,"contextBefore":"The quick ","contextAfter":" fox","text":"brown","color":"yellow"}'
```

Expected: `{"id":"...","clientId":"..."}`. Then:

```bash
curl http://localhost:3000/highlights/bookA -H "Authorization: Bearer $JWT"
```

Expected: list with one entry.

- [ ] **Step 6: Commit**

```bash
git add book-reader-api/src/services/highlights.ts book-reader-api/src/routes/highlights.ts book-reader-api/src/index.ts
git commit -m "feat(api): highlights CRUD with idempotent client-id upsert"
```

### Task 4.5: Frontend API + sync wrapper

**Files:**
- Modify: `book-reader-extension/src/newtab/lib/api.ts`
- Create: `book-reader-extension/src/newtab/lib/highlights/sync.ts`

- [ ] **Step 1: Add API calls**

In `book-reader-extension/src/newtab/lib/api.ts`, append:

```ts
export interface RemoteHighlight {
  id: string;
  clientId: string;
  bookHash: string;
  chapterIndex: number;
  startOffset: number;
  length: number;
  contextBefore: string;
  contextAfter: string;
  text: string;
  color: string;
  note: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export async function listRemoteHighlights(bookHash: string): Promise<RemoteHighlight[]> {
  const r = await request<{ highlights: RemoteHighlight[] }>(`/highlights/${bookHash}`);
  return r.highlights;
}

export async function putRemoteHighlight(
  bookHash: string,
  clientId: string,
  body: {
    chapterIndex: number;
    startOffset: number;
    length: number;
    contextBefore: string;
    contextAfter: string;
    text: string;
    color: string;
    note?: string | null;
  }
): Promise<{ id: string; clientId: string }> {
  return request(`/highlights/${bookHash}/${clientId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRemoteHighlight(bookHash: string, clientId: string): Promise<void> {
  await request(`/highlights/${bookHash}/${clientId}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Create sync helper**

Create `book-reader-extension/src/newtab/lib/highlights/sync.ts`:

```ts
import {
  listAllUnsynced,
  markSynced,
  putHighlight,
  listHighlights,
} from "./storage";
import { Highlight } from "./types";
import {
  listRemoteHighlights,
  putRemoteHighlight,
  deleteRemoteHighlight,
  isAuthenticated,
  isOnline,
} from "../api";

export async function pushPendingHighlights(): Promise<void> {
  if (!isAuthenticated() || !isOnline()) return;
  const pending = await listAllUnsynced();
  for (const h of pending) {
    try {
      if (h.deleted) {
        await deleteRemoteHighlight(h.bookHash, h.id);
      } else {
        await putRemoteHighlight(h.bookHash, h.id, {
          chapterIndex: h.anchor.chapterIndex,
          startOffset: h.anchor.startOffset,
          length: h.anchor.length,
          contextBefore: h.anchor.contextBefore,
          contextAfter: h.anchor.contextAfter,
          text: h.text,
          color: h.color,
          note: h.note ?? null,
        });
      }
      await markSynced(h.id, Date.now());
    } catch {
      // leave unsynced; will retry next cycle
    }
  }
}

export async function pullHighlightsForBook(bookHash: string): Promise<Highlight[]> {
  if (!isAuthenticated() || !isOnline()) return listHighlights(bookHash);
  try {
    const remote = await listRemoteHighlights(bookHash);
    for (const r of remote) {
      const local: Highlight = {
        id: r.clientId,
        bookHash: r.bookHash,
        anchor: {
          chapterIndex: r.chapterIndex,
          startOffset: r.startOffset,
          length: r.length,
          contextBefore: r.contextBefore,
          contextAfter: r.contextAfter,
        },
        text: r.text,
        color: r.color as Highlight["color"],
        note: r.note ?? undefined,
        createdAt: new Date(r.updatedAt).getTime(),
        updatedAt: new Date(r.updatedAt).getTime(),
        syncedAt: Date.now(),
      };
      await putHighlight(local);
    }
  } catch {
    // ignore; fall through to local
  }
  return listHighlights(bookHash);
}
```

- [ ] **Step 3: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/lib/api.ts book-reader-extension/src/newtab/lib/highlights/sync.ts
git commit -m "feat(highlights): API client + push/pull sync helpers"
```

### Task 4.6: `useHighlights` hook

**Files:**
- Create: `book-reader-extension/src/newtab/hooks/useHighlights.ts`

- [ ] **Step 1: Implement**

Create `book-reader-extension/src/newtab/hooks/useHighlights.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { Highlight, HighlightAnchor, HighlightColor } from "../lib/highlights/types";
import {
  listHighlights,
  putHighlight,
  deleteHighlight,
} from "../lib/highlights/storage";
import { pullHighlightsForBook, pushPendingHighlights } from "../lib/highlights/sync";

export function useHighlights(bookHash: string | null) {
  const [items, setItems] = useState<Highlight[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!bookHash) return setItems([]);
    setItems(await listHighlights(bookHash));
  }, [bookHash]);

  useEffect(() => {
    if (!bookHash) return;
    pullHighlightsForBook(bookHash).then(setItems);
  }, [bookHash]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => pushPendingHighlights(), 800);
  }, []);

  const create = useCallback(
    async (text: string, color: HighlightColor, anchor: HighlightAnchor): Promise<Highlight> => {
      if (!bookHash) throw new Error("no book");
      const now = Date.now();
      const h: Highlight = {
        id: crypto.randomUUID(),
        bookHash,
        anchor,
        text,
        color,
        createdAt: now,
        updatedAt: now,
      };
      await putHighlight(h);
      await refresh();
      scheduleSync();
      return h;
    },
    [bookHash, refresh, scheduleSync]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Highlight, "color" | "note">>) => {
      const found = items.find((x) => x.id === id);
      if (!found) return;
      const updated: Highlight = { ...found, ...patch, updatedAt: Date.now(), syncedAt: undefined };
      await putHighlight(updated);
      await refresh();
      scheduleSync();
    },
    [items, refresh, scheduleSync]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteHighlight(id);
      await refresh();
      scheduleSync();
    },
    [refresh, scheduleSync]
  );

  return { items, create, update, remove, refresh };
}
```

- [ ] **Step 2: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/hooks/useHighlights.ts
git commit -m "feat(highlights): useHighlights hook with debounced sync"
```

### Task 4.7: Render highlights in Reader

**Files:**
- Create: `book-reader-extension/src/newtab/lib/highlights/render.ts`
- Modify: `book-reader-extension/src/newtab/components/Reader.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Create render util**

Create `book-reader-extension/src/newtab/lib/highlights/render.ts`:

```ts
import { Highlight } from "./types";
import { anchorRangeFromDom, resolveAnchor } from "./anchor";

export const COLOR_BG: Record<string, string> = {
  yellow: "rgba(253,224,71,0.55)",
  green: "rgba(134,239,172,0.55)",
  pink: "rgba(244,114,182,0.45)",
  blue: "rgba(147,197,253,0.55)",
};

export function clearHighlights(container: HTMLElement) {
  container.querySelectorAll("mark[data-hl]").forEach((el) => {
    const parent = el.parentNode!;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  });
}

export function renderHighlights(
  container: HTMLElement,
  plainText: string,
  chapterIndex: number,
  highlights: Highlight[],
  onClick: (id: string, rect: DOMRect) => void
): void {
  clearHighlights(container);
  for (const h of highlights) {
    if (h.anchor.chapterIndex !== chapterIndex) continue;
    const offsets = resolveAnchor(plainText, h.anchor);
    if (!offsets) continue;
    const range = anchorRangeFromDom(container, offsets.startOffset, offsets.length);
    if (!range) continue;
    try {
      const mark = document.createElement("mark");
      mark.setAttribute("data-hl", h.id);
      mark.style.background = COLOR_BG[h.color] ?? COLOR_BG.yellow;
      mark.style.borderRadius = "2px";
      mark.style.padding = "0 1px";
      mark.style.cursor = "pointer";
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick(h.id, mark.getBoundingClientRect());
      });
      range.surroundContents(mark);
    } catch {
      // surroundContents fails when range crosses element boundaries; skip those
    }
  }
}
```

- [ ] **Step 2: Wire into Reader**

In `book-reader-extension/src/newtab/components/Reader.tsx`:

Update the props interface to include highlights:

```tsx
import { Highlight } from "../lib/highlights/types";
import { renderHighlights, clearHighlights } from "../lib/highlights/render";

interface ReaderProps {
  book: LoadedBook;
  position: ReadingPosition | null;
  settings: ReaderSettings;
  highlights: Highlight[];
  onPositionChange: (chapterIndex: number, scrollOffset: number, percentage: number) => void;
  onSelectionAction: (
    action: ToolbarAction,
    payload: { text: string; range: Range; rect: DOMRect; color?: HighlightColor; chapterIndex: number; chapterText: string }
  ) => void;
  onHighlightClick: (id: string, rect: DOMRect) => void;
  hasExplain: boolean;
}
```

Update the function signature accordingly:

```tsx
export default function Reader({
  book, position, settings, highlights, onPositionChange, onSelectionAction, onHighlightClick, hasExplain,
}: ReaderProps) {
```

Add a ref for the inner content host. Find the `<div className="prose-reader" dangerouslySetInnerHTML={{ __html: content }} />` line and:
1. Add a ref:

```tsx
const proseRef = useRef<HTMLDivElement>(null);
```

2. Replace the prose div with:

```tsx
<div ref={proseRef} className="prose-reader" dangerouslySetInnerHTML={{ __html: content }} />
```

After the `useEffect` that restores scroll, add:

```tsx
useEffect(() => {
  if (!proseRef.current) return;
  if (book.format === "pdf") return;
  // Defer to after render paints
  requestAnimationFrame(() => {
    if (!proseRef.current) return;
    renderHighlights(proseRef.current, plainText, chapterIndex, highlights, onHighlightClick);
  });
  return () => {
    if (proseRef.current) clearHighlights(proseRef.current);
  };
}, [content, highlights, plainText, chapterIndex, book.format, onHighlightClick]);
```

- [ ] **Step 3: Wire highlights in App.tsx**

In `book-reader-extension/src/newtab/App.tsx`:

Add imports:

```tsx
import { useHighlights } from "./hooks/useHighlights";
import { buildAnchor, offsetsFromRange } from "./lib/highlights/anchor";
```

Inside `App`, add:

```tsx
const highlights = useHighlights(currentBook?.hash ?? null);
const [editing, setEditing] = useState<{ id: string; rect: DOMRect } | null>(null);
```

In `handleSelectionAction`, append before the closing brace of the callback:

```tsx
if (action === "highlight") {
  if (!currentBook) return;
  // Need plain-text offsets — Reader gave us the rendered Range; recompute from the prose container.
  const proseEl = (p.range.commonAncestorContainer.parentElement?.closest(".prose-reader")
    ?? document.querySelector(".prose-reader")) as HTMLElement | null;
  if (!proseEl) return;
  const offs = offsetsFromRange(proseEl, p.range);
  if (!offs) return;
  const anchor = buildAnchor(p.chapterText, offs.startOffset, offs.length, p.chapterIndex);
  const color = (p.color ?? "yellow");
  highlights.create(p.text, color, anchor);
  window.getSelection()?.removeAllRanges();
  return;
}
```

Pass highlights down to `<Reader>`:

```tsx
<Reader
  book={currentBook}
  position={position}
  settings={settings}
  highlights={highlights.items}
  onPositionChange={handlePositionChange}
  onSelectionAction={handleSelectionAction}
  onHighlightClick={(id, rect) => setEditing({ id, rect })}
  hasExplain={ai.available}
/>
```

- [ ] **Step 4: Build**

```bash
cd book-reader-extension && npm run build
```

Expected: success.

- [ ] **Step 5: Manual test**

Reload extension. Select text → Highlight → pick yellow. Confirm:
- Yellow background appears around the text.
- Reload tab; still there.
- Switch chapters and back; still there.

- [ ] **Step 6: Commit**

```bash
git add book-reader-extension/src/newtab/lib/highlights/render.ts book-reader-extension/src/newtab/components/Reader.tsx book-reader-extension/src/newtab/App.tsx
git commit -m "feat(highlights): render persisted highlights in reader DOM"
```

### Task 4.8: Edit popup (color, note, delete)

**Files:**
- Create: `book-reader-extension/src/newtab/components/popups/HighlightEditPopup.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Create popup**

Create `book-reader-extension/src/newtab/components/popups/HighlightEditPopup.tsx`:

```tsx
import React, { useState } from "react";
import { Highlight, HighlightColor } from "../../lib/highlights/types";

const COLORS: HighlightColor[] = ["yellow", "green", "pink", "blue"];
const SWATCH: Record<HighlightColor, string> = {
  yellow: "#fde68a", green: "#bbf7d0", pink: "#fbcfe8", blue: "#bfdbfe",
};

interface Props {
  highlight: Highlight;
  rect: DOMRect;
  onChangeColor: (c: HighlightColor) => void;
  onChangeNote: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function HighlightEditPopup({ highlight, rect, onChangeColor, onChangeNote, onDelete, onClose }: Props) {
  const top = window.scrollY + rect.bottom + 6;
  const left = window.scrollX + rect.left;
  const [note, setNote] = useState(highlight.note ?? "");

  return (
    <div className="absolute z-50 clay-card !p-3 w-72" style={{ top, left }}>
      <div className="flex justify-between mb-2">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChangeColor(c)}
              className={`w-5 h-5 rounded-full border ${highlight.color === c ? "border-clay-black" : "border-oat"}`}
              style={{ background: SWATCH[c] }}
              aria-label={c}
            />
          ))}
        </div>
        <button onClick={onClose} className="text-silver text-xs">✕</button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onChangeNote(note)}
        placeholder="Add a note…"
        rows={3}
        className="w-full text-xs p-2 border border-oat rounded-[8px] bg-clay-white"
      />
      <div className="flex justify-end mt-2">
        <button onClick={onDelete} className="text-xs text-pomegranate-400">Delete</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire in App.tsx**

In `book-reader-extension/src/newtab/App.tsx`:

Add import:

```tsx
import HighlightEditPopup from "./components/popups/HighlightEditPopup";
```

Where the JSX returns the reader view, near the other popups, add:

```tsx
{editing && (() => {
  const h = highlights.items.find((x) => x.id === editing.id);
  if (!h) return null;
  return (
    <HighlightEditPopup
      highlight={h}
      rect={editing.rect}
      onChangeColor={(c) => highlights.update(h.id, { color: c })}
      onChangeNote={(n) => highlights.update(h.id, { note: n })}
      onDelete={() => { highlights.remove(h.id); setEditing(null); }}
      onClose={() => setEditing(null)}
    />
  );
})()}
```

- [ ] **Step 3: Build + manual test**

```bash
cd book-reader-extension && npm run build
```

Reload extension. Click an existing highlight. Confirm color picker, note save (blur), and delete all work.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/components/popups/HighlightEditPopup.tsx book-reader-extension/src/newtab/App.tsx
git commit -m "feat(highlights): edit popup with color, note, delete"
```

### Task 4.9: Highlights sidebar

**Files:**
- Create: `book-reader-extension/src/newtab/components/HighlightsPanel.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Create sidebar**

Create `book-reader-extension/src/newtab/components/HighlightsPanel.tsx`:

```tsx
import React from "react";
import { Highlight } from "../lib/highlights/types";

const SWATCH: Record<string, string> = {
  yellow: "#fde68a", green: "#bbf7d0", pink: "#fbcfe8", blue: "#bfdbfe",
};

interface Props {
  items: Highlight[];
  onJump: (h: Highlight) => void;
  onClose: () => void;
}

export default function HighlightsPanel({ items, onJump, onClose }: Props) {
  return (
    <div className="w-80 border-l border-oat bg-clay-white flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-oat">
        <h3 className="text-sm font-semibold">Highlights ({items.length})</h3>
        <button onClick={onClose} className="clay-btn-white !p-1.5 !rounded-[8px]">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-silver text-center py-6">No highlights yet. Select text and pick a color.</p>
        )}
        {items.map((h) => (
          <button
            key={h.id}
            onClick={() => onJump(h)}
            className="w-full text-left clay-card !p-2.5 hover:bg-cream"
          >
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: SWATCH[h.color] }} />
              <div className="min-w-0">
                <p className="text-xs line-clamp-3">{h.text}</p>
                {h.note && <p className="text-[11px] text-silver italic mt-1 line-clamp-2">{h.note}</p>}
                <p className="text-[10px] text-silver mt-1">Ch. {h.anchor.chapterIndex + 1}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire panel into App.tsx**

In `book-reader-extension/src/newtab/App.tsx`:

Add import:

```tsx
import HighlightsPanel from "./components/HighlightsPanel";
```

Add state:

```tsx
const [showHighlights, setShowHighlights] = useState(false);
```

In the toolbar nav (where AI / Library / Settings buttons live), add a new button before `Settings`:

```tsx
<button
  onClick={() => setShowHighlights(!showHighlights)}
  className={`text-xs !py-1.5 !px-3 !rounded-[12px] ${showHighlights ? "clay-btn-solid" : "clay-btn-white"}`}
>
  Highlights
</button>
```

Inside the `<div className="flex-1 flex overflow-hidden">` block (where AIPanel lives), add a sibling:

```tsx
{showHighlights && currentBook && (
  <HighlightsPanel
    items={highlights.items}
    onJump={(h) => updatePosition(h.anchor.chapterIndex, 0, (h.anchor.chapterIndex / 1) * 0)}
    onClose={() => setShowHighlights(false)}
  />
)}
```

Note: the `onJump` should call into the existing position update. If `updatePosition` lives inside `usePosition`, the existing `handlePositionChange` handler is what to call. Replace `onJump` body with:

```tsx
onJump={(h) => handlePositionChange(h.anchor.chapterIndex, 0, 0)}
```

- [ ] **Step 3: Build + manual test**

```bash
cd book-reader-extension && npm run build
```

Reload, click Highlights button, confirm list shows; click an item — jumps to that chapter.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/components/HighlightsPanel.tsx book-reader-extension/src/newtab/App.tsx
git commit -m "feat(highlights): sidebar list with jump-to-chapter"
```

### Task 4.10: Sync on sign-in / online

**Files:**
- Modify: `book-reader-extension/src/newtab/hooks/useAuth.ts`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Trigger pull on sign-in**

In `book-reader-extension/src/newtab/App.tsx`, near the `useHighlights` call, add an effect:

```tsx
useEffect(() => {
  if (!user || !currentBook?.hash) return;
  // user just (re)appeared; refresh from remote
  highlights.refresh();
}, [user, currentBook?.hash]);
```

- [ ] **Step 2: Push pending on `online` event**

Append at the bottom of `App` body, before the early-return checks:

```tsx
useEffect(() => {
  const onOnline = () => {
    import("./lib/highlights/sync").then((m) => m.pushPendingHighlights());
  };
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}, []);
```

- [ ] **Step 3: Manual test**

1. Sign in. Create a highlight. Check `curl /highlights/<bookHash>` returns it.
2. Sign out, reload tab; highlights remain (local).
3. Toggle airplane mode (or DevTools Offline), create a new highlight, go online. Check API receives it on next sync tick.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/App.tsx
git commit -m "feat(highlights): pull on sign-in, push on online"
```

---

## Phase 5 — Cross-cutting polish

### Task 5.1: Hide toolbar actions that need auth when unavailable

**Files:**
- Modify: `book-reader-extension/src/newtab/components/SelectionToolbar.tsx`
- Modify: `book-reader-extension/src/newtab/components/Reader.tsx`

- [ ] **Step 1: Add `aiAvailable` prop to toolbar**

In `SelectionToolbar.tsx`, change `Props` to add `aiAvailable: boolean`. In the rendered button list, conditionally render Translate only when `aiAvailable`:

```tsx
{aiAvailable && (
  <button className="text-xs !py-1 !px-2 clay-btn-white" onClick={() => onAction("translate")}>
    Translate
  </button>
)}
```

- [ ] **Step 2: Pipe through Reader**

In `Reader.tsx`, add `aiAvailable: boolean;` to props (alias of `hasExplain` for now — they're the same condition). Pass `aiAvailable={hasExplain}` to `<SelectionToolbar />`.

- [ ] **Step 3: Build + commit**

```bash
cd book-reader-extension && npm run build
git add book-reader-extension/src/newtab/components/SelectionToolbar.tsx book-reader-extension/src/newtab/components/Reader.tsx
git commit -m "polish(toolbar): hide Translate when unauthenticated"
```

### Task 5.2: Document the new features in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add bullets to Features section**

In `/Users/profitoniumapps/Documents/chromeApps/README.md`, replace the `## Features` section bullet list with:

```markdown
## Features

- **Multi-format support:** EPUB, PDF, TXT
- **Clean reading UI:** Light, Dark, and Sepia themes
- **Reading position sync:** Local-first with background sync to backend
- **AI Assistant (Claude):** Chapter summaries, Q&A, key highlights, passage explanation
- **Selection toolbar:** Highlight (4 colors, persisted + synced), Define (free dictionary), Translate (Claude), Web Search
- **Google Sign-In:** Secure authentication
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: list selection-toolbar features"
```

---

## Self-Review

**Spec coverage**

| Requirement | Implementing task |
| --- | --- |
| Tap-to-define with free dictionary | Tasks 2.1–2.3 |
| Translate selection | Tasks 3.1–3.4 |
| Highlight (color, persisted, list, edit) | Tasks 4.1–4.10 |
| Web search selection | Task 1.3 (handleSelectionAction "search") |
| Floating toolbar UX (shared) | Tasks 1.1–1.3 |
| Tests for pure logic | Tasks 0.1, 1.1, 2.2, 4.2, 4.3 |
| Settings for translate target language | Task 3.3 |
| Auth-gated where applicable | Tasks 3.1–3.4 (translate), 4.4–4.10 (highlights sync), 5.1 (UI) |
| Manifest hosts for new domains | Task 2.1 |

**Placeholder scan:** No "TBD", "implement later", or empty steps. Each step has either a complete code block, an exact command, or a concrete edit description with full code.

**Type consistency:**
- `HighlightColor`: defined in `SelectionToolbar.tsx` and `lib/highlights/types.ts`. Both must stay aligned. The toolbar imports the type — fine.
  - Note for the implementing engineer: in Task 1.2 the `HighlightColor` is defined in `SelectionToolbar.tsx`. In Task 4.1 the same type is created in `lib/highlights/types.ts`. **Action item for executor:** when reaching Task 4.1, change `SelectionToolbar.tsx` to `import { HighlightColor } from "../lib/highlights/types"` and remove the local definition; this keeps the single source of truth.
- `Highlight.id` (client uuid) is the same value as the `clientId` field on the API. The frontend always sends/expects the same id; the API uses it as an idempotency key.
- `ToolbarAction` includes `"highlight" | "define" | "translate" | "search" | "explain"` — all five are dispatched in `App.tsx`.
- `aiTranslate` in `lib/api.ts` matches request shape to `routes/ai.ts` `/translate` body.
- `putRemoteHighlight` body matches `HighlightInput` minus `clientId`/`bookHash` (URL-supplied).

**PDF scope:** Plan explicitly defers PDF text-layer integration. Reader.tsx uses `book.format === "pdf"` early-return; the highlight render effect early-returns on PDF. Selection toolbar will not appear inside `<PdfViewer>` since `useSelection` is bound to the EPUB/TXT scroll container only. Acceptable for v1.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-reader-text-actions.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
