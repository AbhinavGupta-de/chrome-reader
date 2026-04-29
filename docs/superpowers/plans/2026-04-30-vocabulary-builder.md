# Vocabulary Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete vocabulary-builder layer to the Chrome book-reader extension: auto-save on every Define, "My Words" sidebar, audio playback (dictionary URL → TTS fallback), Leitner-box flashcard review, fill-in-the-blank quiz, and CSV export. Local-first IndexedDB with full backend sync mirroring the highlights pattern.

**Architecture:** Six features built on a single shared data model (`VocabWord` with `contexts: VocabContext[]` and folded Leitner state). Storage mirrors the highlights pattern — IndexedDB store with sync metadata + new Postgres `vocabulary` table + idempotent client-id upsert. Pure-logic modules (Leitner transitions, CSV escaping) are tested with Vitest. UI reuses existing patterns from the Highlights feature (sidebar, edit popup, AudioButton helper).

**Tech Stack:** React 19, Tailwind 4, Vite, IndexedDB via `idb`, Hono, Drizzle ORM, PostgreSQL, Vitest (already wired), Web Speech API (for TTS fallback).

**Source spec:** `docs/superpowers/specs/2026-04-30-vocabulary-builder-design.md`

**Branch:** `feature/vocabulary-builder` (already created off `feature/reader-text-actions`)

---

## File Structure

### Extension — new files

| Path | Responsibility |
|---|---|
| `src/newtab/lib/vocab/types.ts` | Shared type defs: `VocabWord`, `VocabContext`, `VocabDefinition`, `LeitnerStage` |
| `src/newtab/lib/vocab/leitner.ts` | Pure functions: `intervalForStage(stage)`, `applyRating(state, rating, now)` |
| `src/newtab/lib/vocab/storage.ts` | IndexedDB CRUD: `upsertVocab`, `getVocabByWord`, `listVocab`, `deleteVocab`, `listAllUnsynced`, `markSynced` |
| `src/newtab/lib/vocab/sync.ts` | Backend sync: `pushPendingVocab`, `pullVocab` |
| `src/newtab/lib/vocab/csv.ts` | Pure: `escapeCsvField`, `wordsToCsv`, `downloadCsv` |
| `src/newtab/hooks/useVocab.ts` | React hook returning `{ items, dueCount, save, unsave, applyReview, refresh }` |
| `src/newtab/components/AudioButton.tsx` | Shared 🔊 button: tries audio URL, falls back to `speechSynthesis` |
| `src/newtab/components/WordsPanel.tsx` | Sidebar list with search, sort, filter, multi-select delete, Review/Quiz/Export actions |
| `src/newtab/components/ReviewModal.tsx` | Flashcard UI for Leitner review |
| `src/newtab/components/QuizModal.tsx` | Fill-in-the-blank quiz UI |
| `tests/lib/vocab/leitner.test.ts` | TDD for `applyRating` transitions |
| `tests/lib/vocab/storage.test.ts` | TDD for IDB roundtrip + dedup-merge |
| `tests/lib/vocab/csv.test.ts` | TDD for RFC 4180 escaping |

### Extension — modified files

| Path | Changes |
|---|---|
| `src/newtab/lib/api.ts` | Append `RemoteVocabWord` interface and `listRemoteVocab`, `putRemoteVocab`, `deleteRemoteVocab` |
| `src/newtab/components/popups/DictionaryPopup.tsx` | Auto-save on entry mount, ✓/○ toggle pill, render `<AudioButton>` |
| `src/newtab/App.tsx` | `useVocab()`, `Words` button in nav, `<WordsPanel>`, `<ReviewModal>`, `<QuizModal>` mounts |

### Backend — new files

| Path | Responsibility |
|---|---|
| `book-reader-api/src/services/vocabulary.ts` | DB queries: `listVocabularyForUser`, `upsertVocabulary`, `softDeleteVocabulary` |
| `book-reader-api/src/routes/vocabulary.ts` | Hono routes: GET / PUT / DELETE under auth |

### Backend — modified files

| Path | Changes |
|---|---|
| `book-reader-api/src/db/schema.ts` | Append `vocabulary` table + indexes |
| `book-reader-api/src/index.ts` | Mount `/vocabulary` |

---

## Phase 0 — Foundation (types + pure logic + storage + CSV)

### Task 0.1: Vocab types

**Files:**
- Create: `book-reader-extension/src/newtab/lib/vocab/types.ts`

- [ ] **Step 1: Create the file**

Create `book-reader-extension/src/newtab/lib/vocab/types.ts`:

```ts
export interface VocabContext {
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  sentence: string;
  savedAt: number;
}

export interface VocabDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export type LeitnerStage = 0 | 1 | 2 | 3 | 4 | 5;
export type LeitnerRating = "again" | "hard" | "good" | "easy";

export interface LeitnerState {
  stage: LeitnerStage;
  mastered: boolean;
  nextReviewAt: number;
  lastReviewAt?: number;
  correctStreak: number;
}

export interface VocabWord extends LeitnerState {
  id: string;
  word: string;
  phonetic?: string;
  audioUrl?: string;
  definitions: VocabDefinition[];
  contexts: VocabContext[];
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
  deleted?: boolean;
}
```

- [ ] **Step 2: Build to confirm TS clean**

Run from `book-reader-extension/`:
```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/lib/vocab/types.ts
git commit -m "feat(vocab): add shared types"
```

### Task 0.2: Leitner algorithm (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/lib/vocab/leitner.ts`
- Create: `book-reader-extension/tests/lib/vocab/leitner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `book-reader-extension/tests/lib/vocab/leitner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { intervalForStage, applyRating, FAR_FUTURE } from "../../../src/newtab/lib/vocab/leitner";
import { LeitnerState } from "../../../src/newtab/lib/vocab/types";

const NOW = 1_700_000_000_000;
const DAY = 24 * 3600 * 1000;

function state(overrides: Partial<LeitnerState> = {}): LeitnerState {
  return {
    stage: 0,
    mastered: false,
    nextReviewAt: NOW,
    correctStreak: 0,
    ...overrides,
  };
}

describe("intervalForStage", () => {
  it("returns ms for each stage", () => {
    expect(intervalForStage(0)).toBe(0);
    expect(intervalForStage(1)).toBe(1 * DAY);
    expect(intervalForStage(2)).toBe(3 * DAY);
    expect(intervalForStage(3)).toBe(7 * DAY);
    expect(intervalForStage(4)).toBe(14 * DAY);
    expect(intervalForStage(5)).toBe(30 * DAY);
  });
});

describe("applyRating — Again", () => {
  it("from any stage → stage 1, +1d, streak 0", () => {
    for (const stage of [0, 1, 2, 3, 4, 5] as const) {
      const next = applyRating(state({ stage, correctStreak: 7 }), "again", NOW);
      expect(next.stage).toBe(1);
      expect(next.mastered).toBe(false);
      expect(next.nextReviewAt).toBe(NOW + DAY);
      expect(next.correctStreak).toBe(0);
      expect(next.lastReviewAt).toBe(NOW);
    }
  });
});

describe("applyRating — Hard", () => {
  it("repeats same stage with same interval, streak unchanged", () => {
    const next = applyRating(state({ stage: 3, correctStreak: 5 }), "hard", NOW);
    expect(next.stage).toBe(3);
    expect(next.nextReviewAt).toBe(NOW + 7 * DAY);
    expect(next.correctStreak).toBe(5);
  });

  it("at stage 0 (Hard before any review) bumps to stage 1", () => {
    const next = applyRating(state({ stage: 0 }), "hard", NOW);
    expect(next.stage).toBe(0);
    expect(next.nextReviewAt).toBe(NOW + 0);
  });
});

describe("applyRating — Good", () => {
  it("from stage 0 → stage 1, +1d, streak +1", () => {
    const next = applyRating(state({ stage: 0 }), "good", NOW);
    expect(next.stage).toBe(1);
    expect(next.nextReviewAt).toBe(NOW + 1 * DAY);
    expect(next.correctStreak).toBe(1);
    expect(next.mastered).toBe(false);
  });

  it("from stage 4 → stage 5, +30d, not mastered", () => {
    const next = applyRating(state({ stage: 4 }), "good", NOW);
    expect(next.stage).toBe(5);
    expect(next.nextReviewAt).toBe(NOW + 30 * DAY);
    expect(next.mastered).toBe(false);
  });

  it("from stage 5 → mastered, far-future review", () => {
    const next = applyRating(state({ stage: 5, correctStreak: 4 }), "good", NOW);
    expect(next.mastered).toBe(true);
    expect(next.stage).toBe(5);
    expect(next.nextReviewAt).toBe(FAR_FUTURE);
    expect(next.correctStreak).toBe(5);
  });
});

describe("applyRating — Easy", () => {
  it("from stage 0 → stage 2, +3d", () => {
    const next = applyRating(state({ stage: 0 }), "easy", NOW);
    expect(next.stage).toBe(2);
    expect(next.nextReviewAt).toBe(NOW + 3 * DAY);
  });

  it("from stage 4 → mastered (4+2=6 ≥ 6)", () => {
    const next = applyRating(state({ stage: 4 }), "easy", NOW);
    expect(next.mastered).toBe(true);
    expect(next.stage).toBe(5);
    expect(next.nextReviewAt).toBe(FAR_FUTURE);
  });

  it("from stage 5 → mastered", () => {
    const next = applyRating(state({ stage: 5 }), "easy", NOW);
    expect(next.mastered).toBe(true);
    expect(next.stage).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL (module not found)**

```bash
npm test -- tests/lib/vocab/leitner.test.ts
```

Expected: FAIL — `Failed to resolve import`.

- [ ] **Step 3: Implement leitner.ts**

Create `book-reader-extension/src/newtab/lib/vocab/leitner.ts`:

```ts
import { LeitnerRating, LeitnerStage, LeitnerState } from "./types";

const DAY = 24 * 3600 * 1000;
export const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

const INTERVALS: Record<LeitnerStage, number> = {
  0: 0,
  1: 1 * DAY,
  2: 3 * DAY,
  3: 7 * DAY,
  4: 14 * DAY,
  5: 30 * DAY,
};

export function intervalForStage(stage: LeitnerStage): number {
  return INTERVALS[stage];
}

function clampStage(s: number): LeitnerStage {
  if (s < 0) return 0;
  if (s > 5) return 5;
  return s as LeitnerStage;
}

export function applyRating(prev: LeitnerState, rating: LeitnerRating, now: number): LeitnerState {
  const base = { ...prev, lastReviewAt: now };
  if (rating === "again") {
    return { ...base, stage: 1, mastered: false, nextReviewAt: now + INTERVALS[1], correctStreak: 0 };
  }
  if (rating === "hard") {
    return { ...base, nextReviewAt: now + INTERVALS[prev.stage] };
  }
  const bump = rating === "good" ? 1 : 2;
  if (prev.stage + bump >= 6) {
    return { ...base, stage: 5, mastered: true, nextReviewAt: FAR_FUTURE, correctStreak: prev.correctStreak + 1 };
  }
  const newStage = clampStage(prev.stage + bump);
  return { ...base, stage: newStage, nextReviewAt: now + INTERVALS[newStage], correctStreak: prev.correctStreak + 1 };
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm test -- tests/lib/vocab/leitner.test.ts
```

Expected: PASS, all suites green (≈ 9 tests).

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/vocab/leitner.ts book-reader-extension/tests/lib/vocab/leitner.test.ts
git commit -m "feat(vocab): Leitner box transitions with TDD"
```

### Task 0.3: IndexedDB storage (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/lib/vocab/storage.ts`
- Create: `book-reader-extension/tests/lib/vocab/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `book-reader-extension/tests/lib/vocab/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  upsertVocab,
  getVocabByWord,
  listVocab,
  deleteVocab,
  listAllUnsynced,
  markSynced,
  listDueWords,
} from "../../../src/newtab/lib/vocab/storage";
import { VocabWord, VocabContext } from "../../../src/newtab/lib/vocab/types";

const NOW = 1_700_000_000_000;
const DAY = 24 * 3600 * 1000;

function ctx(overrides: Partial<VocabContext> = {}): VocabContext {
  return {
    bookHash: "bookA",
    bookTitle: "Book A",
    chapterIndex: 0,
    sentence: "an example sentence with the word",
    savedAt: NOW,
    ...overrides,
  };
}

function fixture(overrides: Partial<VocabWord> = {}): VocabWord {
  return {
    id: crypto.randomUUID(),
    word: "elucidate",
    definitions: [{ partOfSpeech: "verb", definition: "make clear" }],
    contexts: [ctx()],
    stage: 0,
    mastered: false,
    nextReviewAt: NOW,
    correctStreak: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("vocab storage", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("book-reader-vocab");
  });

  it("inserts a new word and lists it", async () => {
    const w = fixture();
    await upsertVocab(w);
    const list = await listVocab();
    expect(list).toHaveLength(1);
    expect(list[0].word).toBe("elucidate");
  });

  it("dedupes by word: defining same word twice merges contexts", async () => {
    const a = fixture({ word: "elucidate", contexts: [ctx({ bookHash: "bookA" })] });
    await upsertVocab(a);
    const b = fixture({ id: crypto.randomUUID(), word: "elucidate", contexts: [ctx({ bookHash: "bookB" })] });
    await upsertVocab(b);
    const found = await getVocabByWord("elucidate");
    expect(found).not.toBeNull();
    expect(found!.contexts).toHaveLength(2);
    expect(found!.contexts.map((c) => c.bookHash)).toEqual(["bookA", "bookB"]);
  });

  it("dedupe is case-insensitive", async () => {
    await upsertVocab(fixture({ word: "Elucidate" }));
    const found = await getVocabByWord("elucidate");
    expect(found).not.toBeNull();
    expect(found!.word).toBe("elucidate");
  });

  it("soft-deletes (tombstone) and excludes from listVocab", async () => {
    const w = fixture();
    await upsertVocab(w);
    await deleteVocab(w.id);
    const list = await listVocab();
    expect(list).toHaveLength(0);
  });

  it("listAllUnsynced + markSynced", async () => {
    const w = fixture();
    await upsertVocab(w);
    expect(await listAllUnsynced()).toHaveLength(1);
    await markSynced(w.id, NOW + 1);
    expect(await listAllUnsynced()).toHaveLength(0);
  });

  it("listDueWords returns words with nextReviewAt <= now and not mastered", async () => {
    const due = fixture({ word: "due", nextReviewAt: NOW - 1 });
    const future = fixture({ word: "future", nextReviewAt: NOW + 7 * DAY });
    const mastered = fixture({ word: "done", nextReviewAt: NOW - 1, mastered: true });
    await upsertVocab(due);
    await upsertVocab(future);
    await upsertVocab(mastered);
    const list = await listDueWords(NOW);
    expect(list.map((w) => w.word).sort()).toEqual(["due"]);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

```bash
npm test -- tests/lib/vocab/storage.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement storage.ts**

Create `book-reader-extension/src/newtab/lib/vocab/storage.ts`:

```ts
import { openDB, IDBPDatabase } from "idb";
import { VocabWord } from "./types";

const DB = "book-reader-vocab";
const STORE = "vocab";

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("byWord", "word", { unique: false });
          s.createIndex("byNextReview", "nextReviewAt", { unique: false });
        }
      },
      blocking() {
        dbPromise?.then((d) => d.close()).catch(() => {});
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

function normWord(w: string): string {
  return w.trim().toLowerCase();
}

export async function getVocabByWord(word: string): Promise<VocabWord | null> {
  const db = await getDB();
  const lower = normWord(word);
  const all = (await db.getAllFromIndex(STORE, "byWord", lower)) as VocabWord[];
  return all.find((w) => !w.deleted) ?? null;
}

export async function upsertVocab(input: VocabWord): Promise<VocabWord> {
  const db = await getDB();
  const lower = normWord(input.word);
  const existing = await getVocabByWord(lower);
  const now = Date.now();
  if (existing) {
    const merged: VocabWord = {
      ...existing,
      // append any new contexts not already present
      contexts: dedupeContexts([...existing.contexts, ...input.contexts]),
      // update phonetic / audio / definitions if the new payload has them and existing doesn't
      phonetic: existing.phonetic ?? input.phonetic,
      audioUrl: existing.audioUrl ?? input.audioUrl,
      definitions: existing.definitions.length > 0 ? existing.definitions : input.definitions,
      updatedAt: now,
      syncedAt: undefined,
      deleted: false,
    };
    await db.put(STORE, merged);
    return merged;
  }
  const fresh: VocabWord = { ...input, word: lower, updatedAt: now };
  await db.put(STORE, fresh);
  return fresh;
}

function dedupeContexts(arr: VocabWord["contexts"]): VocabWord["contexts"] {
  const seen = new Set<string>();
  const out: VocabWord["contexts"] = [];
  for (const c of arr) {
    const k = `${c.bookHash}::${c.chapterIndex}::${c.sentence}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

export async function getVocab(id: string): Promise<VocabWord | null> {
  const db = await getDB();
  return ((await db.get(STORE, id)) as VocabWord | undefined) ?? null;
}

export async function listVocab(): Promise<VocabWord[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as VocabWord[];
  return all.filter((w) => !w.deleted);
}

export async function listDueWords(now: number): Promise<VocabWord[]> {
  const all = await listVocab();
  return all
    .filter((w) => !w.mastered && w.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
}

export async function deleteVocab(id: string): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(STORE, id)) as VocabWord | undefined;
  if (!existing) return;
  existing.deleted = true;
  existing.updatedAt = Date.now();
  existing.syncedAt = undefined;
  await db.put(STORE, existing);
}

export async function listAllUnsynced(): Promise<VocabWord[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as VocabWord[];
  return all.filter((w) => !w.syncedAt || w.syncedAt < w.updatedAt);
}

export async function markSynced(id: string, at: number): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(STORE, id)) as VocabWord | undefined;
  if (!existing) return;
  existing.syncedAt = at;
  await db.put(STORE, existing);
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm test -- tests/lib/vocab/storage.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/vocab/storage.ts book-reader-extension/tests/lib/vocab/storage.test.ts
git commit -m "feat(vocab): IndexedDB storage with case-insensitive dedup"
```

### Task 0.4: CSV export (TDD)

**Files:**
- Create: `book-reader-extension/src/newtab/lib/vocab/csv.ts`
- Create: `book-reader-extension/tests/lib/vocab/csv.test.ts`

- [ ] **Step 1: Write failing tests**

Create `book-reader-extension/tests/lib/vocab/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { escapeCsvField, wordsToCsv } from "../../../src/newtab/lib/vocab/csv";
import { VocabWord } from "../../../src/newtab/lib/vocab/types";

const NOW = new Date("2026-04-30T12:00:00Z").getTime();

function fixture(overrides: Partial<VocabWord> = {}): VocabWord {
  return {
    id: "id1",
    word: "elucidate",
    phonetic: "/ɪˈluːsɪdeɪt/",
    definitions: [{ partOfSpeech: "verb", definition: "make clear", example: "She elucidated her point." }],
    contexts: [{ bookHash: "bookA", bookTitle: "Book A", chapterIndex: 2, sentence: "elucidate the dark matter", savedAt: NOW }],
    stage: 3,
    mastered: false,
    nextReviewAt: NOW,
    correctStreak: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("escapeCsvField", () => {
  it("returns plain text unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });
  it("wraps and doubles quotes", () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });
  it("wraps fields containing commas", () => {
    expect(escapeCsvField("a, b")).toBe('"a, b"');
  });
  it("wraps fields containing newlines", () => {
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
  });
});

describe("wordsToCsv", () => {
  it("emits header + one row per word", () => {
    const csv = wordsToCsv([fixture()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Word,Phonetic,Definition,Example,Contexts,FirstSeen,Stage");
    expect(lines).toHaveLength(2);
  });

  it("formats a row correctly with date and stage", () => {
    const csv = wordsToCsv([fixture()]);
    const row = csv.split("\n")[1];
    expect(row).toContain("elucidate");
    expect(row).toContain("/ɪˈluːsɪdeɪt/");
    expect(row).toContain("make clear");
    expect(row).toContain("2026-04-30");
    expect(row).toContain(",3");
  });

  it("renders Mastered as the literal string", () => {
    const csv = wordsToCsv([fixture({ mastered: true, stage: 5 })]);
    const row = csv.split("\n")[1];
    expect(row.endsWith(",Mastered")).toBe(true);
  });

  it("escapes contexts containing quotes / commas / newlines", () => {
    const w = fixture({
      contexts: [
        { bookHash: "b", bookTitle: 'My "Book"', chapterIndex: 1, sentence: "first, line", savedAt: NOW },
        { bookHash: "b", bookTitle: "My Book", chapterIndex: 2, sentence: "second\nline", savedAt: NOW },
      ],
    });
    const csv = wordsToCsv([w]);
    expect(csv).toContain('""My ""Book""""');
    expect(csv).toContain("first, line");
    expect(csv).toContain("second\nline");
  });

  it("emits header alone when no words", () => {
    const csv = wordsToCsv([]);
    expect(csv).toBe("Word,Phonetic,Definition,Example,Contexts,FirstSeen,Stage\n");
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

```bash
npm test -- tests/lib/vocab/csv.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement csv.ts**

Create `book-reader-extension/src/newtab/lib/vocab/csv.ts`:

```ts
import { VocabWord } from "./types";

export function escapeCsvField(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function formatContexts(w: VocabWord): string {
  return w.contexts
    .map((c) => `From "${c.bookTitle}" (ch. ${c.chapterIndex + 1}): …${c.sentence}…`)
    .join("\n");
}

const HEADER = ["Word", "Phonetic", "Definition", "Example", "Contexts", "FirstSeen", "Stage"];

export function wordsToCsv(words: VocabWord[]): string {
  const lines = [HEADER.join(",")];
  for (const w of words) {
    const def = w.definitions[0]?.definition ?? "";
    const ex = w.definitions[0]?.example ?? "";
    const stageCell = w.mastered ? "Mastered" : String(w.stage);
    const row = [
      escapeCsvField(w.word),
      escapeCsvField(w.phonetic ?? ""),
      escapeCsvField(def),
      escapeCsvField(ex),
      escapeCsvField(formatContexts(w)),
      isoDate(w.createdAt),
      stageCell,
    ].join(",");
    lines.push(row);
  }
  // trailing newline so empty list still has a header line ending in \n
  return lines.join("\n") + (words.length === 0 ? "\n" : "");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm test -- tests/lib/vocab/csv.test.ts
```

Expected: PASS, all suites green.

- [ ] **Step 5: Commit**

```bash
git add book-reader-extension/src/newtab/lib/vocab/csv.ts book-reader-extension/tests/lib/vocab/csv.test.ts
git commit -m "feat(vocab): RFC 4180 CSV export with TDD"
```

---

## Phase 1 — Backend

### Task 1.1: Drizzle schema + migration

**Files:**
- Modify: `book-reader-api/src/db/schema.ts`

- [ ] **Step 1: Append the vocabulary table**

In `book-reader-api/src/db/schema.ts`, scroll to the bottom and append:

```ts
import { boolean, index } from "drizzle-orm/pg-core";

export const vocabulary = pgTable(
  "vocabulary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    word: text("word").notNull(),
    phonetic: text("phonetic"),
    audioUrl: text("audio_url"),
    definitions: jsonb("definitions").notNull(),
    contexts: jsonb("contexts").notNull(),
    stage: integer("stage").notNull().default(0),
    mastered: boolean("mastered").notNull().default(false),
    nextReviewAt: timestamp("next_review_at").notNull(),
    lastReviewAt: timestamp("last_review_at"),
    correctStreak: integer("correct_streak").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    uniqueIndex("vocab_user_client_id_idx").on(t.userId, t.clientId),
    index("vocab_user_word_idx").on(t.userId, t.word),
  ]
);
```

If `boolean` and `index` aren't already imported at the top, merge them into the existing `pg-core` import.

- [ ] **Step 2: Generate migration**

Run from `book-reader-api/`:

```bash
npx drizzle-kit generate
```

Expected: a new `0001_*.sql` (or similar) file under `src/db/migrations/`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add book-reader-api/src/db/schema.ts book-reader-api/src/db/migrations/
git commit -m "feat(api): vocabulary table + migration"
```

### Task 1.2: Vocabulary service

**Files:**
- Create: `book-reader-api/src/services/vocabulary.ts`

- [ ] **Step 1: Implement service**

Create `book-reader-api/src/services/vocabulary.ts`:

```ts
import { db } from "../db/index.js";
import { vocabulary } from "../db/schema.js";
import { and, eq, isNull } from "drizzle-orm";

export interface VocabularyInput {
  clientId: string;
  word: string;
  phonetic?: string | null;
  audioUrl?: string | null;
  definitions: unknown;
  contexts: unknown;
  stage: number;
  mastered: boolean;
  nextReviewAt: Date;
  lastReviewAt?: Date | null;
  correctStreak: number;
}

export async function listVocabularyForUser(userId: string) {
  return db
    .select()
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), isNull(vocabulary.deletedAt)));
}

export async function upsertVocabulary(userId: string, input: VocabularyInput) {
  const existing = await db
    .select()
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.clientId, input.clientId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await db
      .update(vocabulary)
      .set({
        word: input.word,
        phonetic: input.phonetic ?? null,
        audioUrl: input.audioUrl ?? null,
        definitions: input.definitions,
        contexts: input.contexts,
        stage: input.stage,
        mastered: input.mastered,
        nextReviewAt: input.nextReviewAt,
        lastReviewAt: input.lastReviewAt ?? null,
        correctStreak: input.correctStreak,
        updatedAt: new Date(),
        deletedAt: null,
      })
      .where(eq(vocabulary.id, existing.id));
    return { id: existing.id, clientId: input.clientId };
  }

  const inserted = await db
    .insert(vocabulary)
    .values({
      userId,
      clientId: input.clientId,
      word: input.word,
      phonetic: input.phonetic ?? null,
      audioUrl: input.audioUrl ?? null,
      definitions: input.definitions,
      contexts: input.contexts,
      stage: input.stage,
      mastered: input.mastered,
      nextReviewAt: input.nextReviewAt,
      lastReviewAt: input.lastReviewAt ?? null,
      correctStreak: input.correctStreak,
    })
    .returning({ id: vocabulary.id });
  return { id: inserted[0].id, clientId: input.clientId };
}

export async function softDeleteVocabulary(userId: string, clientId: string) {
  await db
    .update(vocabulary)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.clientId, clientId)));
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/profitoniumapps/Documents/chromeApps/book-reader-api && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add book-reader-api/src/services/vocabulary.ts
git commit -m "feat(api): vocabulary service with idempotent upsert"
```

### Task 1.3: Vocabulary routes + mount

**Files:**
- Create: `book-reader-api/src/routes/vocabulary.ts`
- Modify: `book-reader-api/src/index.ts`

- [ ] **Step 1: Implement routes**

Create `book-reader-api/src/routes/vocabulary.ts`:

```ts
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import {
  listVocabularyForUser,
  upsertVocabulary,
  softDeleteVocabulary,
  VocabularyInput,
} from "../services/vocabulary.js";
import type { AppVariables } from "../types.js";

const r = new Hono<{ Variables: AppVariables }>();
r.use("/*", authMiddleware);

r.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const rows = await listVocabularyForUser(userId);
  return c.json({ words: rows });
});

r.put("/:clientId", async (c) => {
  const userId = c.get("userId") as string;
  const clientId = c.req.param("clientId");
  const body = await c.req.json<Omit<VocabularyInput, "clientId" | "nextReviewAt" | "lastReviewAt"> & {
    nextReviewAt: number;
    lastReviewAt?: number | null;
  }>();
  const input: VocabularyInput = {
    ...body,
    clientId,
    nextReviewAt: new Date(body.nextReviewAt),
    lastReviewAt: body.lastReviewAt ? new Date(body.lastReviewAt) : null,
  };
  const result = await upsertVocabulary(userId, input);
  return c.json(result);
});

r.delete("/:clientId", async (c) => {
  const userId = c.get("userId") as string;
  const clientId = c.req.param("clientId");
  await softDeleteVocabulary(userId, clientId);
  return c.json({ ok: true });
});

export default r;
```

- [ ] **Step 2: Mount in `src/index.ts`**

In `book-reader-api/src/index.ts`:

Add to imports:
```ts
import vocabularyRoutes from "./routes/vocabulary.js";
```

Add to mount block (alongside other `app.route(...)` calls):
```ts
app.route("/vocabulary", vocabularyRoutes);
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add book-reader-api/src/routes/vocabulary.ts book-reader-api/src/index.ts
git commit -m "feat(api): mount /vocabulary routes (GET/PUT/DELETE)"
```

---

## Phase 2 — Frontend API + sync

### Task 2.1: API client

**Files:**
- Modify: `book-reader-extension/src/newtab/lib/api.ts`

- [ ] **Step 1: Append vocab API calls**

At the bottom of `book-reader-extension/src/newtab/lib/api.ts`, append:

```ts
export interface RemoteVocabWord {
  id: string;
  clientId: string;
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  definitions: unknown;
  contexts: unknown;
  stage: number;
  mastered: boolean;
  nextReviewAt: string;
  lastReviewAt: string | null;
  correctStreak: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export async function listRemoteVocab(): Promise<RemoteVocabWord[]> {
  const r = await request<{ words: RemoteVocabWord[] }>(`/vocabulary`);
  return r.words;
}

export async function putRemoteVocab(
  clientId: string,
  body: {
    word: string;
    phonetic: string | null;
    audioUrl: string | null;
    definitions: unknown;
    contexts: unknown;
    stage: number;
    mastered: boolean;
    nextReviewAt: number;
    lastReviewAt: number | null;
    correctStreak: number;
  }
): Promise<{ id: string; clientId: string }> {
  return request(`/vocabulary/${clientId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRemoteVocab(clientId: string): Promise<void> {
  await request(`/vocabulary/${clientId}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/profitoniumapps/Documents/chromeApps/book-reader-extension && npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/lib/api.ts
git commit -m "feat(vocab): add /vocabulary API client"
```

### Task 2.2: Sync helpers

**Files:**
- Create: `book-reader-extension/src/newtab/lib/vocab/sync.ts`

- [ ] **Step 1: Implement sync**

Create `book-reader-extension/src/newtab/lib/vocab/sync.ts`:

```ts
import { listAllUnsynced, markSynced, upsertVocab, listVocab } from "./storage";
import { VocabWord, VocabContext, VocabDefinition, LeitnerStage } from "./types";
import {
  listRemoteVocab,
  putRemoteVocab,
  deleteRemoteVocab,
  isAuthenticated,
  isOnline,
  RemoteVocabWord,
} from "../api";
import { getVocab } from "./storage";
import { deleteVocab as localDelete } from "./storage";

export async function pushPendingVocab(): Promise<void> {
  if (!isAuthenticated() || !isOnline()) return;
  const pending = await listAllUnsynced();
  for (const w of pending) {
    try {
      if (w.deleted) {
        await deleteRemoteVocab(w.id);
      } else {
        await putRemoteVocab(w.id, {
          word: w.word,
          phonetic: w.phonetic ?? null,
          audioUrl: w.audioUrl ?? null,
          definitions: w.definitions,
          contexts: w.contexts,
          stage: w.stage,
          mastered: w.mastered,
          nextReviewAt: w.nextReviewAt,
          lastReviewAt: w.lastReviewAt ?? null,
          correctStreak: w.correctStreak,
        });
      }
      await markSynced(w.id, Date.now());
    } catch (e) {
      console.warn("vocab sync push failed", w.id, e);
    }
  }
}

export async function pullVocab(): Promise<VocabWord[]> {
  if (!isAuthenticated() || !isOnline()) return listVocab();
  try {
    const remote = await listRemoteVocab();
    for (const r of remote) {
      const local = await getVocab(r.clientId);
      const remoteUpdated = new Date(r.updatedAt).getTime();
      if (local) {
        const isLocalDirty = !local.syncedAt || local.syncedAt < local.updatedAt;
        if (isLocalDirty && local.updatedAt > remoteUpdated) {
          continue; // local newer — keep
        }
      }
      if (r.deletedAt) {
        await localDelete(r.clientId);
        continue;
      }
      const w: VocabWord = {
        id: r.clientId,
        word: r.word,
        phonetic: r.phonetic ?? undefined,
        audioUrl: r.audioUrl ?? undefined,
        definitions: r.definitions as VocabDefinition[],
        contexts: r.contexts as VocabContext[],
        stage: r.stage as LeitnerStage,
        mastered: r.mastered,
        nextReviewAt: new Date(r.nextReviewAt).getTime(),
        lastReviewAt: r.lastReviewAt ? new Date(r.lastReviewAt).getTime() : undefined,
        correctStreak: r.correctStreak,
        createdAt: new Date(r.createdAt).getTime(),
        updatedAt: remoteUpdated,
        syncedAt: Date.now(),
      };
      await upsertVocab(w);
    }
  } catch (e) {
    console.warn("vocab pull failed", e);
  }
  return listVocab();
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/lib/vocab/sync.ts
git commit -m "feat(vocab): push/pull sync helpers"
```

---

## Phase 3 — Hook + AudioButton

### Task 3.1: useVocab hook

**Files:**
- Create: `book-reader-extension/src/newtab/hooks/useVocab.ts`

- [ ] **Step 1: Implement**

Create `book-reader-extension/src/newtab/hooks/useVocab.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VocabWord, VocabContext, VocabDefinition, LeitnerRating } from "../lib/vocab/types";
import {
  listVocab,
  upsertVocab,
  deleteVocab,
  getVocabByWord,
} from "../lib/vocab/storage";
import { pullVocab, pushPendingVocab } from "../lib/vocab/sync";
import { applyRating } from "../lib/vocab/leitner";

export function useVocab() {
  const [items, setItems] = useState<VocabWord[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setItems(await listVocab());
  }, []);

  useEffect(() => {
    pullVocab().then(setItems);
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => pushPendingVocab(), 800);
  }, []);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return items.filter((w) => !w.mastered && w.nextReviewAt <= now).length;
  }, [items]);

  const save = useCallback(
    async (input: {
      word: string;
      phonetic?: string;
      audioUrl?: string;
      definitions: VocabDefinition[];
      context: VocabContext;
    }): Promise<VocabWord> => {
      const now = Date.now();
      const fresh: VocabWord = {
        id: crypto.randomUUID(),
        word: input.word.trim().toLowerCase(),
        phonetic: input.phonetic,
        audioUrl: input.audioUrl,
        definitions: input.definitions,
        contexts: [input.context],
        stage: 0,
        mastered: false,
        nextReviewAt: now,
        correctStreak: 0,
        createdAt: now,
        updatedAt: now,
      };
      const persisted = await upsertVocab(fresh);
      await refresh();
      scheduleSync();
      return persisted;
    },
    [refresh, scheduleSync]
  );

  const unsave = useCallback(
    async (id: string) => {
      await deleteVocab(id);
      await refresh();
      scheduleSync();
    },
    [refresh, scheduleSync]
  );

  const findByWord = useCallback(async (word: string): Promise<VocabWord | null> => {
    return getVocabByWord(word);
  }, []);

  const applyReview = useCallback(
    async (id: string, rating: LeitnerRating): Promise<VocabWord | null> => {
      const all = await listVocab();
      const found = all.find((w) => w.id === id);
      if (!found) return null;
      const newState = applyRating(found, rating, Date.now());
      const updated: VocabWord = {
        ...found,
        ...newState,
        updatedAt: Date.now(),
        syncedAt: undefined,
      };
      await upsertVocab(updated);
      await refresh();
      scheduleSync();
      return updated;
    },
    [refresh, scheduleSync]
  );

  const resetStage = useCallback(
    async (id: string) => {
      const all = await listVocab();
      const found = all.find((w) => w.id === id);
      if (!found) return;
      const reset: VocabWord = {
        ...found,
        stage: 0,
        mastered: false,
        nextReviewAt: Date.now(),
        correctStreak: 0,
        updatedAt: Date.now(),
        syncedAt: undefined,
      };
      await upsertVocab(reset);
      await refresh();
      scheduleSync();
    },
    [refresh, scheduleSync]
  );

  return { items, dueCount, save, unsave, findByWord, applyReview, resetStage, refresh };
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/hooks/useVocab.ts
git commit -m "feat(vocab): useVocab hook with debounced sync and review actions"
```

### Task 3.2: AudioButton component

**Files:**
- Create: `book-reader-extension/src/newtab/components/AudioButton.tsx`

- [ ] **Step 1: Implement**

Create `book-reader-extension/src/newtab/components/AudioButton.tsx`:

```tsx
import React from "react";

interface Props {
  text: string;
  url?: string;
  size?: number; // px
  className?: string;
}

export default function AudioButton({ text, url, size = 14, className = "" }: Props) {
  const play = async () => {
    if (url) {
      try {
        const a = new Audio(url);
        await a.play();
        return;
      } catch {
        // fall through to TTS
      }
    }
    if (typeof speechSynthesis !== "undefined" && text) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  };

  return (
    <button
      onClick={play}
      aria-label={`Pronounce ${text}`}
      title="Pronounce"
      className={`p-1 rounded-[6px] text-silver hover:text-clay-black hover:bg-oat/40 transition-colors ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6v4h2.5L9 13V3L5.5 6H3z" />
        <path d="M11.5 5.5a3 3 0 0 1 0 5" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/components/AudioButton.tsx
git commit -m "feat(vocab): AudioButton with TTS fallback"
```

---

## Phase 4 — DictionaryPopup integration (auto-save + ✓/○ toggle + audio)

### Task 4.1: Auto-save on Define + saved pill + audio

**Files:**
- Modify: `book-reader-extension/src/newtab/components/popups/DictionaryPopup.tsx`
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Modify DictionaryPopup to receive vocab callbacks + saved state**

Replace the entire `book-reader-extension/src/newtab/components/popups/DictionaryPopup.tsx` with:

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { DictEntry } from "../../lib/dictionary";
import { useDismissable } from "../../hooks/useClickOutside";
import AudioButton from "../AudioButton";

interface Props {
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
  selectionText: string;
  contextSentence: string;
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  // Vocab integration
  isSaved: boolean;
  audioUrlFromEntry?: string;
  onAutoSave: (entry: DictEntry, contextSentence: string) => void;
  onUnsave: () => void;
  onClose: () => void;
}

export default function DictionaryPopup(props: Props) {
  const { loading, entry, notFoundWord, rect, selectionText, contextSentence, isSaved, audioUrlFromEntry, onAutoSave, onUnsave, onClose } = props;
  const top = rect.bottom + 8;
  const left = rect.left;
  const ref = useDismissable<HTMLDivElement>(true, onClose);

  // Trigger auto-save once when the dictionary entry resolves successfully.
  const [autoSaveFired, setAutoSaveFired] = useState(false);
  useEffect(() => {
    if (autoSaveFired) return;
    if (loading || !entry) return;
    onAutoSave(entry, contextSentence);
    setAutoSaveFired(true);
  }, [autoSaveFired, loading, entry, contextSentence, onAutoSave]);

  const ttsText = useMemo(() => entry?.word ?? notFoundWord ?? selectionText, [entry, notFoundWord, selectionText]);

  return (
    <div
      ref={ref}
      className="fixed z-50 clay-card !p-3 w-72 max-h-80 overflow-y-auto"
      style={{ top, left }}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{entry?.word ?? notFoundWord ?? "…"}</p>
            <AudioButton text={ttsText} url={audioUrlFromEntry} size={13} />
          </div>
          {entry?.phonetic && <p className="text-xs text-silver">{entry.phonetic}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {entry && (
            <button
              onClick={isSaved ? onUnsave : () => entry && onAutoSave(entry, contextSentence)}
              title={isSaved ? "Saved — click to remove" : "Save"}
              className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                isSaved
                  ? "bg-matcha-300/20 text-matcha-600 border-matcha-300"
                  : "bg-clay-white text-silver border-oat hover:text-clay-black"
              }`}
            >
              {isSaved ? "✓ Saved" : "○ Save"}
            </button>
          )}
          <button onClick={onClose} className="text-silver text-xs px-1">✕</button>
        </div>
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

- [ ] **Step 2: Wire vocab into App.tsx**

In `book-reader-extension/src/newtab/App.tsx`:

a. Add imports near other lib imports:
```tsx
import { useVocab } from "./hooks/useVocab";
import { VocabContext, VocabDefinition } from "./lib/vocab/types";
```

b. Inside `App` body, near the other hooks (e.g. next to `highlights = useHighlights(...)`):
```tsx
const vocab = useVocab();
```

c. Extend the `dict` state shape to include `selectionText` and the saving context. Replace:
```tsx
const [dict, setDict] = useState<{
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
} | null>(null);
```
with:
```tsx
const [dict, setDict] = useState<{
  loading: boolean;
  entry: DictEntry | null;
  notFoundWord: string | null;
  rect: DOMRect;
  selectionText: string;
  contextSentence: string;
  chapterIndex: number;
} | null>(null);
const [savedWordId, setSavedWordId] = useState<string | null>(null);
```

d. Update the `define` action handler. Replace the existing block:
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

with:
```tsx
if (action === "define") {
  // Build a 120-char context window from the chapter text around the selection
  const ctxText = p.chapterText;
  const idx = ctxText.toLowerCase().indexOf(p.text.toLowerCase());
  const sentence = idx >= 0
    ? ctxText.slice(Math.max(0, idx - 60), Math.min(ctxText.length, idx + p.text.length + 60))
    : p.text;
  setDict({
    loading: true,
    entry: null,
    notFoundWord: null,
    rect: p.rect,
    selectionText: p.text,
    contextSentence: sentence,
    chapterIndex: p.chapterIndex,
  });
  setSavedWordId(null);
  defineWord(p.text).then((entry) => {
    setDict({
      loading: false,
      entry,
      notFoundWord: entry ? null : p.text.split(/\s+/)[0] ?? p.text,
      rect: p.rect,
      selectionText: p.text,
      contextSentence: sentence,
      chapterIndex: p.chapterIndex,
    });
  });
  return;
}
```

e. Add an `onAutoSave` and `onUnsave` callback above the JSX, and wire them with the vocab hook. Find the existing `<DictionaryPopup>` render and replace its props block with the version below.

Locate the existing render (looks like):
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

Replace it with:
```tsx
{dict && currentBook && (
  <DictionaryPopup
    loading={dict.loading}
    entry={dict.entry}
    notFoundWord={dict.notFoundWord}
    rect={dict.rect}
    selectionText={dict.selectionText}
    contextSentence={dict.contextSentence}
    bookHash={currentBook.hash}
    bookTitle={currentBook.metadata.title}
    chapterIndex={dict.chapterIndex}
    isSaved={savedWordId !== null}
    audioUrlFromEntry={
      (dict.entry as any)?.phonetics?.find?.((p: any) => p.audio)?.audio
    }
    onAutoSave={async (entry, sentence) => {
      const audio: string | undefined = (entry as any).phonetics?.find?.((p: any) => p.audio)?.audio;
      // dedupe via getVocabByWord — if already in DB, just mark "saved"
      const existing = await vocab.findByWord(entry.word);
      if (existing) {
        // append context then mark saved
        const merged: VocabContext = {
          bookHash: currentBook.hash,
          bookTitle: currentBook.metadata.title,
          chapterIndex: dict.chapterIndex,
          sentence,
          savedAt: Date.now(),
        };
        const defs: VocabDefinition[] = (entry.meanings ?? []).flatMap((m) =>
          m.definitions.map((d) => ({ partOfSpeech: m.partOfSpeech, definition: d.definition, example: d.example }))
        ).slice(0, 3);
        const w = await vocab.save({
          word: entry.word,
          phonetic: entry.phonetic,
          audioUrl: audio,
          definitions: defs.length > 0 ? defs : existing.definitions,
          context: merged,
        });
        setSavedWordId(w.id);
        return;
      }
      const defs: VocabDefinition[] = (entry.meanings ?? []).flatMap((m) =>
        m.definitions.map((d) => ({ partOfSpeech: m.partOfSpeech, definition: d.definition, example: d.example }))
      ).slice(0, 3);
      const w = await vocab.save({
        word: entry.word,
        phonetic: entry.phonetic,
        audioUrl: audio,
        definitions: defs,
        context: {
          bookHash: currentBook.hash,
          bookTitle: currentBook.metadata.title,
          chapterIndex: dict.chapterIndex,
          sentence,
          savedAt: Date.now(),
        },
      });
      setSavedWordId(w.id);
    }}
    onUnsave={async () => {
      if (savedWordId) await vocab.unsave(savedWordId);
      setSavedWordId(null);
    }}
    onClose={() => { setDict(null); setSavedWordId(null); }}
  />
)}
```

- [ ] **Step 3: Build + manual verify**

```bash
npm run build
npm test
```

Expected: build clean; 21+ tests passing (existing 17 + 9 leitner + 6 storage + 6 csv = 38).

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/components/popups/DictionaryPopup.tsx \
        book-reader-extension/src/newtab/App.tsx
git commit -m "feat(vocab): auto-save on Define with ✓/○ pill + audio button"
```

---

## Phase 5 — WordsPanel sidebar

### Task 5.1: WordsPanel component

**Files:**
- Create: `book-reader-extension/src/newtab/components/WordsPanel.tsx`

- [ ] **Step 1: Implement**

Create `book-reader-extension/src/newtab/components/WordsPanel.tsx`:

```tsx
import React, { useMemo, useState } from "react";
import { VocabWord } from "../lib/vocab/types";
import AudioButton from "./AudioButton";
import { wordsToCsv, downloadCsv } from "../lib/vocab/csv";

type SortKey = "recent" | "alpha" | "seen" | "due";

interface Props {
  items: VocabWord[];
  currentBookHash: string | null;
  dueCount: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  onResetStage: (id: string) => void;
  onReview: () => void;
  onQuiz: () => void;
}

export default function WordsPanel({ items, currentBookHash, dueCount, onClose, onDelete, onResetStage, onReview, onQuiz }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [scope, setScope] = useState<"all" | "book">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let arr = items.slice();
    if (scope === "book" && currentBookHash) {
      arr = arr.filter((w) => w.contexts.some((c) => c.bookHash === currentBookHash));
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((w) => w.word.includes(s));
    }
    arr.sort((a, b) => {
      if (sort === "alpha") return a.word.localeCompare(b.word);
      if (sort === "seen") return b.contexts.length - a.contexts.length;
      if (sort === "due") return a.nextReviewAt - b.nextReviewAt;
      return b.createdAt - a.createdAt; // recent
    });
    return arr;
  }, [items, search, sort, scope, currentBookHash]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = () => {
    for (const id of selected) onDelete(id);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const csv = wordsToCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`vocabulary-${date}.csv`, csv);
  };

  return (
    <div className="w-80 border-l border-oat bg-clay-white flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-oat">
        <h3 className="text-sm font-semibold">Words ({items.length})</h3>
        <button onClick={onClose} className="clay-btn-white !p-1.5 !rounded-[8px]">✕</button>
      </div>

      <div className="px-3 py-2 border-b border-oat space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words…"
          className="w-full px-2.5 py-1.5 text-xs rounded-[8px] border border-oat bg-clay-white"
        />
        <div className="flex gap-1.5 text-xs">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="flex-1 px-2 py-1 rounded-[6px] border border-oat bg-clay-white">
            <option value="recent">Recent</option>
            <option value="alpha">A–Z</option>
            <option value="seen">Most seen</option>
            <option value="due">Due first</option>
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value as "all" | "book")} className="flex-1 px-2 py-1 rounded-[6px] border border-oat bg-clay-white">
            <option value="all">All books</option>
            <option value="book" disabled={!currentBookHash}>This book</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onReview}
            disabled={dueCount === 0}
            className="flex-1 clay-btn-solid text-xs !py-1.5 disabled:opacity-50"
          >
            Review {dueCount > 0 && `(${dueCount})`}
          </button>
          <button onClick={onQuiz} disabled={items.length === 0} className="flex-1 clay-btn-white text-xs !py-1.5 disabled:opacity-50">
            Quiz me
          </button>
          <button onClick={exportCsv} disabled={items.length === 0} className="clay-btn-white text-xs !py-1.5 !px-2.5 disabled:opacity-50" title="Export CSV">
            ⤓
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-silver text-center py-6">
            {items.length === 0 ? "No saved words yet — click Define on any word to start." : "No words match."}
          </p>
        )}
        {filtered.map((w) => {
          const isOpen = expanded.has(w.id);
          const isSel = selected.has(w.id);
          const stageLabel = w.mastered ? "✓ Mastered" : `Stage ${w.stage}`;
          return (
            <div key={w.id} className="clay-card !p-2 text-xs">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggleSelect(w.id)}
                  className="mt-1"
                />
                <button onClick={() => toggleExpand(w.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold truncate">{w.word}</span>
                    {w.phonetic && <span className="text-silver text-[10px]">{w.phonetic}</span>}
                  </div>
                  <p className="text-silver text-[11px] truncate mt-0.5">{w.definitions[0]?.definition ?? ""}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-silver">
                      Seen {w.contexts.length}× in {new Set(w.contexts.map((c) => c.bookHash)).size}
                    </span>
                    <span className="text-[10px] text-silver">·</span>
                    <span className="text-[10px] text-silver">{stageLabel}</span>
                  </div>
                </button>
                <AudioButton text={w.word} url={w.audioUrl} size={12} />
              </div>
              {isOpen && (
                <div className="pt-2 mt-2 border-t border-oat space-y-1.5">
                  {w.definitions.map((d, i) => (
                    <div key={i}>
                      <p className="text-silver italic text-[10px]">{d.partOfSpeech}</p>
                      <p>{d.definition}</p>
                      {d.example && <p className="text-silver italic">"{d.example}"</p>}
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-oat">
                    <p className="text-[10px] font-medium text-silver mb-1">Contexts</p>
                    {w.contexts.map((c, i) => (
                      <p key={i} className="text-[11px] mb-0.5">
                        <span className="text-silver">[{c.bookTitle}, ch.{c.chapterIndex + 1}]</span> …{c.sentence}…
                      </p>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button onClick={() => onResetStage(w.id)} className="text-[10px] text-silver hover:text-clay-black">↻ Reset</button>
                    <button onClick={() => onDelete(w.id)} className="text-[10px] text-pomegranate-400">🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="border-t border-oat px-3 py-2 flex items-center justify-between bg-cream">
          <span className="text-xs">{selected.size} selected</span>
          <button onClick={bulkDelete} className="text-xs text-pomegranate-400 font-medium">Delete</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/components/WordsPanel.tsx
git commit -m "feat(vocab): WordsPanel sidebar with search, sort, multi-select, export"
```

### Task 5.2: Wire WordsPanel into App.tsx

**Files:**
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Add the toolbar button + sidebar render**

In `book-reader-extension/src/newtab/App.tsx`:

a. Add import:
```tsx
import WordsPanel from "./components/WordsPanel";
```

b. Add state near other show* states:
```tsx
const [showWords, setShowWords] = useState(false);
const [showReview, setShowReview] = useState(false);
const [showQuiz, setShowQuiz] = useState(false);
```

c. In the top nav buttons block (where `Highlights` button lives), add a new button between `Highlights` and `Settings`:

```tsx
<button
  onClick={() => setShowWords(!showWords)}
  className={`text-xs !py-1.5 !px-3 !rounded-[12px] ${showWords ? "clay-btn-solid" : "clay-btn-white"}`}
>
  Words {vocab.dueCount > 0 && <span className="text-pomegranate-400 ml-0.5">({vocab.dueCount})</span>}
</button>
```

d. Inside the `<div className="flex-1 flex overflow-hidden">` block (where AIPanel and HighlightsPanel are siblings), add:

```tsx
{showWords && (
  <WordsPanel
    items={vocab.items}
    currentBookHash={currentBook?.hash ?? null}
    dueCount={vocab.dueCount}
    onClose={() => setShowWords(false)}
    onDelete={(id) => vocab.unsave(id)}
    onResetStage={(id) => vocab.resetStage(id)}
    onReview={() => setShowReview(true)}
    onQuiz={() => setShowQuiz(true)}
  />
)}
```

(`setShowReview` / `setShowQuiz` will be wired to actual modals in tasks 6.x and 7.x — for now they're declared but unused; modals will land next.)

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean (TS may warn about unused vars `showReview`/`showQuiz` until task 6.2 / 7.2 — that's fine since `noUnusedLocals` is off in tsconfig per project convention).

- [ ] **Step 3: Manual verify**

Reload the extension. Click Define on any word → confirm green ✓ Saved pill appears in popup → close popup → click new **Words** button in nav → sidebar appears, the just-saved word is in the list.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/App.tsx
git commit -m "feat(vocab): wire WordsPanel into top nav with due-count badge"
```

---

## Phase 6 — ReviewModal (flashcards)

### Task 6.1: ReviewModal component

**Files:**
- Create: `book-reader-extension/src/newtab/components/ReviewModal.tsx`

- [ ] **Step 1: Implement**

Create `book-reader-extension/src/newtab/components/ReviewModal.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { VocabWord, LeitnerRating } from "../lib/vocab/types";
import AudioButton from "./AudioButton";

interface Props {
  items: VocabWord[];
  onRate: (id: string, rating: LeitnerRating) => Promise<void>;
  onClose: () => void;
}

const MAX_PER_SESSION = 50;

export default function ReviewModal({ items, onRate, onClose }: Props) {
  const due = useMemo(() => {
    const now = Date.now();
    return items
      .filter((w) => !w.mastered && w.nextReviewAt <= now)
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
      .slice(0, MAX_PER_SESSION);
  }, [items]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = due[index];
  const total = due.length;

  useEffect(() => {
    setRevealed(false);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!revealed && e.key === " ") { e.preventDefault(); setRevealed(true); }
      if (revealed) {
        if (e.key === "1") rate("again");
        if (e.key === "2") rate("hard");
        if (e.key === "3") rate("good");
        if (e.key === "4") rate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, card]);

  const rate = async (rating: LeitnerRating) => {
    if (!card) return;
    await onRate(card.id, rating);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-clay-black/40 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-4">No words due for review right now. Come back tomorrow!</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="fixed inset-0 z-50 bg-clay-black/40 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-2">All caught up.</p>
          <p className="text-xs text-silver mb-4">{total} word{total === 1 ? "" : "s"} reviewed.</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  const firstContext = card.contexts[0];

  return (
    <div className="fixed inset-0 z-50 bg-clay-black/40 flex items-center justify-center px-4">
      <div className="clay-card !p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-silver">{index + 1} / {total} due</span>
          <button onClick={onClose} className="text-silver text-xs hover:text-clay-black">✕</button>
        </div>

        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 className="text-3xl font-semibold">{card.word}</h2>
            <AudioButton text={card.word} url={card.audioUrl} size={18} />
          </div>
          {card.phonetic && <p className="text-sm text-silver">{card.phonetic}</p>}
        </div>

        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="clay-btn-solid w-full text-sm">
            Reveal (Space)
          </button>
        ) : (
          <div>
            <div className="border-t border-oat pt-4 mb-4 space-y-2">
              {card.definitions.slice(0, 3).map((d, i) => (
                <div key={i} className="text-sm">
                  <span className="italic text-silver text-xs">{d.partOfSpeech} </span>
                  <span>{d.definition}</span>
                </div>
              ))}
              {firstContext && (
                <p className="text-xs text-silver mt-2 italic">
                  From "{firstContext.bookTitle}" (ch. {firstContext.chapterIndex + 1}): …{firstContext.sentence}…
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => rate("again")} className="clay-btn-white text-xs !py-2 text-pomegranate-400">Again</button>
              <button onClick={() => rate("hard")} className="clay-btn-white text-xs !py-2">Hard</button>
              <button onClick={() => rate("good")} className="clay-btn-white text-xs !py-2 text-matcha-600">Good</button>
              <button onClick={() => rate("easy")} className="clay-btn-solid text-xs !py-2">Easy</button>
            </div>
            <p className="text-[10px] text-silver text-center mt-2">1 / 2 / 3 / 4</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/components/ReviewModal.tsx
git commit -m "feat(vocab): ReviewModal flashcards with keyboard shortcuts"
```

### Task 6.2: Wire ReviewModal into App.tsx

**Files:**
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Add imports + render**

In `book-reader-extension/src/newtab/App.tsx`:

a. Add import:
```tsx
import ReviewModal from "./components/ReviewModal";
```

b. Just before the closing fragment of the reader-view return (alongside other modal renders), add:

```tsx
{showReview && (
  <ReviewModal
    items={vocab.items}
    onRate={async (id, rating) => { await vocab.applyReview(id, rating); }}
    onClose={() => setShowReview(false)}
  />
)}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Manual verify**

Reload extension. Save a few words via Define. Open Words sidebar. Click **Review**. A modal appears with the first due card. Press Space → definitions reveal. Click Good → next card. Press Esc → modal closes.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/App.tsx
git commit -m "feat(vocab): wire ReviewModal flow"
```

---

## Phase 7 — QuizModal (fill-in-the-blank)

### Task 7.1: QuizModal component

**Files:**
- Create: `book-reader-extension/src/newtab/components/QuizModal.tsx`

- [ ] **Step 1: Implement**

Create `book-reader-extension/src/newtab/components/QuizModal.tsx`:

```tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { VocabWord } from "../lib/vocab/types";

interface Props {
  items: VocabWord[];
  onClose: () => void;
}

const QUESTIONS_PER_SESSION = 10;

interface Question {
  word: VocabWord;
  blanked: string;     // sentence with the word replaced by _____
  answer: string;      // expected lowercase word
}

function buildQuestions(items: VocabWord[]): Question[] {
  const usable = items.filter((w) => !w.deleted && w.contexts.length > 0);
  const shuffled = [...usable].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_SESSION);
  return shuffled.map((w) => {
    const c = w.contexts[Math.floor(Math.random() * w.contexts.length)];
    const re = new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const blanked = c.sentence.replace(re, "_____");
    return { word: w, blanked, answer: w.word.toLowerCase() };
  });
}

export default function QuizModal({ items, onClose }: Props) {
  const questions = useMemo(() => buildQuestions(items), [items]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState<{ correct: boolean } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const q = questions[index];

  useEffect(() => {
    setInput("");
    setSubmitted(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-clay-black/40 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-4">Save some words first — quizzes need at least one saved word.</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="fixed inset-0 z-50 bg-clay-black/40 flex items-center justify-center" onClick={onClose}>
        <div className="clay-card !p-6 max-w-sm text-center">
          <p className="text-sm mb-2">Quiz finished.</p>
          <p className="text-2xl font-semibold mb-4">{score.correct} / {score.total}</p>
          <button onClick={onClose} className="clay-btn-solid text-sm">Done</button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (submitted) {
      setIndex((i) => i + 1);
      return;
    }
    const correct = input.trim().toLowerCase() === q.answer;
    setSubmitted({ correct });
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-clay-black/40 flex items-center justify-center px-4">
      <div className="clay-card !p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-silver">{index + 1} / {questions.length}</span>
          <button onClick={onClose} className="text-silver text-xs hover:text-clay-black">✕</button>
        </div>

        <p className="text-sm leading-relaxed mb-4">{q.blanked}</p>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!submitted}
            placeholder="Type the missing word…"
            className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white"
          />
          {submitted && (
            <div className="mt-3 text-sm">
              {submitted.correct ? (
                <p className="text-matcha-600">✓ Correct</p>
              ) : (
                <p className="text-pomegranate-400">✕ Answer: <strong>{q.answer}</strong></p>
              )}
              <p className="text-xs text-silver mt-1">{q.word.definitions[0]?.definition ?? ""}</p>
            </div>
          )}
          <button type="submit" className="clay-btn-solid w-full text-sm mt-4">
            {submitted ? "Next" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/components/QuizModal.tsx
git commit -m "feat(vocab): QuizModal fill-in-the-blank with sentence context"
```

### Task 7.2: Wire QuizModal into App.tsx

**Files:**
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Add import + render**

In `book-reader-extension/src/newtab/App.tsx`:

a. Import:
```tsx
import QuizModal from "./components/QuizModal";
```

b. Add render alongside ReviewModal:
```tsx
{showQuiz && (
  <QuizModal
    items={vocab.items}
    onClose={() => setShowQuiz(false)}
  />
)}
```

- [ ] **Step 2: Build + manual verify**

```bash
npm run build
```

Reload extension. Save a few words. Open Words sidebar. Click **Quiz me**. Modal shows a sentence with `_____` and an input. Type the word, hit Enter. See correct/incorrect. Hit Enter again → next question.

- [ ] **Step 3: Commit**

```bash
git add book-reader-extension/src/newtab/App.tsx
git commit -m "feat(vocab): wire QuizModal flow"
```

---

## Phase 8 — Sync triggers + polish

### Task 8.1: Pull on sign-in / push on online

**Files:**
- Modify: `book-reader-extension/src/newtab/App.tsx`

- [ ] **Step 1: Add effects near the existing highlight sync triggers**

In `book-reader-extension/src/newtab/App.tsx`, find the existing pair of effects:

```tsx
useEffect(() => {
  if (!user || !currentBook?.hash) return;
  highlights.refresh();
}, [user, currentBook?.hash]);

useEffect(() => {
  const onOnline = () => {
    import("./lib/highlights/sync").then((m) => m.pushPendingHighlights());
  };
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}, []);
```

Add two more effects directly after them:

```tsx
useEffect(() => {
  if (!user) return;
  vocab.refresh();
}, [user]);

useEffect(() => {
  const onOnline = () => {
    import("./lib/vocab/sync").then((m) => m.pushPendingVocab());
  };
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}, []);
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 3: Final test run**

```bash
npm test
```

Expected: all tests passing — existing 17 + 9 leitner + 6 storage + 6 csv = ~38 tests, all green.

- [ ] **Step 4: Commit**

```bash
git add book-reader-extension/src/newtab/App.tsx
git commit -m "feat(vocab): pull on sign-in, push on online"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec section | Implementing task |
|---|---|
| Auto-save on Define (1) | Task 4.1 |
| ✓/○ saved pill toggle | Task 4.1 |
| Words sidebar with search/sort/filter (2) | Tasks 5.1 + 5.2 |
| Multi-select bulk delete | Task 5.1 |
| AudioButton (4): dictionary URL → TTS fallback | Task 3.2; used in 4.1, 5.1, 6.1 |
| Leitner box (3) — 6 stages with rating transitions | Task 0.2 (TDD) |
| ReviewModal flashcards | Tasks 6.1 + 6.2 |
| Fill-in-the-blank QuizModal (5) | Tasks 7.1 + 7.2 |
| CSV export (6) | Task 0.4 (TDD) + 5.1 (button) |
| IDB local-first + dedup-merge | Task 0.3 (TDD) |
| Backend: vocabulary table + routes | Tasks 1.1 / 1.2 / 1.3 |
| Frontend API + sync | Tasks 2.1 / 2.2 |
| useVocab hook | Task 3.1 |
| Pull on sign-in / push on online | Task 8.1 |
| Tests for leitner / storage / csv | 0.2 / 0.3 / 0.4 |

All spec sections covered. No gaps.

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later" anywhere. Every step has full code.

**3. Type consistency:**
- `VocabWord` shape used identically across `types.ts` (Task 0.1), `storage.ts` (0.3), `sync.ts` (2.2), `useVocab.ts` (3.1), all UI components.
- `LeitnerRating = "again" | "hard" | "good" | "easy"` — same in `types.ts`, `leitner.ts`, `useVocab`, `ReviewModal`.
- `getVocabByWord` (storage) is exposed via `vocab.findByWord` (hook) and consumed in `App.tsx` Task 4.1 — names align.
- Backend `vocabulary` table fields match `RemoteVocabWord` interface (Task 2.1) and the PUT body in `putRemoteVocab` (Task 2.1) — `nextReviewAt` is epoch ms on the wire, converted to Date in the route handler (Task 1.3) and back in `pullVocab` (Task 2.2). Round-trip checked.
- `id` (local UUID) is reused as `clientId` on the wire — same idempotency pattern as highlights. Verified across 1.2, 1.3, 2.1, 2.2.

**4. Migration heads-up:** Task 1.1 generates a new migration on top of the existing `0000_dashing_alex_power.sql`. If the previous reader-text-actions PR hasn't merged yet, Task 1.1's migration will be the second file in `migrations/` (numbered `0001_*`). On apply via `drizzle-kit push`, drizzle diffs the live schema against `schema.ts` and only applies what's missing (new `vocabulary` table). The implementer should run `npx drizzle-kit push`, NOT execute the SQL files directly.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-vocabulary-builder.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
