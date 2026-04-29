# Vocabulary Builder — Design Spec

**Status:** Approved through brainstorming, ready for implementation plan.
**Date:** 2026-04-30
**Branch:** `feature/vocabulary-builder` (off `feature/reader-text-actions`)

## Context

The reader extension already lets users click-to-Define a word from any selected text. The popup shows the meaning and disappears — the word is forgotten as soon as the popup closes. Defining a word is *not* the same as learning it; learning needs the word kept around, reviewed over time, and tested in context.

This spec adds a complete vocabulary-builder layer on top of the existing Define feature. Six pieces ship together: auto-save on Define, a "My Words" sidebar, audio playback, Leitner-box flashcard review, fill-in-the-blank quiz mode, and CSV export.

## Goals

1. Every word the user defines is captured automatically — zero friction.
2. The user can browse, search, sort, and clean their saved words from one panel.
3. Every word is reviewable over a meaningful schedule (Leitner box) so it actually sticks.
4. Words are tested *in their original sentences* (fill-in-the-blank) — the most effective vocabulary recall format.
5. Saved words sync to the backend so reinstalling Chrome doesn't wipe weeks of work.
6. Users can take their data out as CSV (Anki / Notion / Excel compatible).

## Non-goals

- No image cards, no drawings, no LaTeX, no rich text in cards.
- No social features, sharing decks, or community word lists.
- No translation overlays — the existing Translate flow is separate.
- No SM-2 / FSRS algorithm in v1 — Leitner box only.
- No iOS / mobile work — the backend table is shared but the iOS Flipside app is out of scope here.

## User journey

You're reading. You hit a word, click **Define**. The popup opens with the meaning and a green ✓ "Saved" pill — the word was auto-saved. You can click that pill to unsave (rare). You close the popup. Next day at the kitchen table, you click **Words** in the top nav. You see every word you've saved across all books, with definitions, audio buttons, and counts ("seen 3 times"). You hit **Review** → flashcards in Leitner schedule. You hit **Quiz me** → fill-in-the-blank using the original sentence with the word blanked out. You hit **Export** → CSV downloads.

Five entry points: Define popup → save indicator. Words sidebar → list. Review button → flashcards. Quiz me → fill-in-blank. Export → CSV.

## Data model

One entry per `(user × word)`. Auto-save dedupes by lowercasing the word; if it exists, the new sentence is appended to a `contexts` array; otherwise a new entry is inserted with the dictionary snapshot.

```ts
// book-reader-extension/src/newtab/lib/vocab/types.ts
export interface VocabContext {
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  sentence: string;          // ~120 chars around the saved word
  savedAt: number;
}

export interface VocabDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export type LeitnerStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface VocabWord {
  id: string;                // uuid
  word: string;              // lowercased, trimmed (dedup key)
  phonetic?: string;
  audioUrl?: string;         // from dictionaryapi.dev when available
  definitions: VocabDefinition[];   // top 1–3 from the API, snapshot
  contexts: VocabContext[];          // accumulates over time
  // Leitner state — folded into the same record
  stage: LeitnerStage;       // 0 = new (due now), 5 = about to graduate
  mastered: boolean;         // true after exiting stage 5 with "Good"/"Easy"
  nextReviewAt: number;      // epoch ms; new words are due immediately
  lastReviewAt?: number;
  correctStreak: number;     // stats only, used for "seen N×" display
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
  deleted?: boolean;         // tombstone for sync
}
```

**Storage:**
- **Local:** new IndexedDB store `vocab` keyed by `id`, with index `byWord` on lowercase `word` (dedup lookup) and `byNextReview` on `nextReviewAt` (review queue).
- **Backend:** new Postgres `vocabulary` table mirroring the shape — same idempotent upsert pattern as `highlights` (`clientId` = client uuid, unique per `(userId, clientId)`). `definitions` and `contexts` as `jsonb`. The local `id` is sent as `clientId` to the API, identical to the highlights pattern.

## UI surfaces

### 1. DictionaryPopup additions
- Green ✓ **Saved** pill next to the word title. Clicking toggles to ○ **Save** (unsaves the entry, soft delete).
- 🔊 audio button next to the phonetic.

### 2. "Words" button in top nav
- New button between **Highlights** and **Settings**.
- Shows a numeric badge when there are review-eligible words: `Words (12)`. Badge counts entries with `nextReviewAt <= now && !mastered && !deleted`.

### 3. WordsPanel sidebar
- Top: search box (filters by word substring) + sort selector (Recent saves / A–Z / Most seen / Due first) + filter chip (All books / This book).
- Each row: word, phonetic, top definition (truncated), 🔊, "seen N× in M books" pill, stage indicator (small numeric box 1-5 or "✓ Mastered").
- Click a row → expand inline to show all definitions and all contexts (one line each, with book name and chapter).
- Row hover actions: 🗑 delete, **↻ reset stage** (back to stage 0, `nextReviewAt = now`).
- Multi-select: checkbox in each row → footer "Delete N" button.
- Top-right buttons: **Review**, **Quiz me**, **Export CSV**. **Review** is disabled when 0 words are due.

### 4. ReviewModal (flashcards)
- Full-screen-ish modal, one card at a time.
- Front: word + phonetic + 🔊. Large.
- "Reveal" button → back shows all definitions and the first context sentence (`From "Book Title" (ch. N): …elucidate the dark matter problem…`).
- Bottom: **Again / Hard / Good / Easy** buttons. Applies Leitner transition (next section).
- Progress: "3 / 12 due today."
- After last card: "All caught up." with "Done" button.

### 5. QuizModal (fill-in-the-blank)
- Picks 10 random words from the user's deck that have at least one context (skip new entries with no contexts yet — though every saved entry has at least one).
- Shows the chosen context sentence with the target word replaced by `_____`.
- Text input, submit on Enter or button click.
- Reveals correct/incorrect + the full definition. **Next** button advances.
- Acceptance: case-insensitive exact match against `word`. (No fuzzy matching in v1.)
- After 10: shows summary ("8/10 correct"). No SRS state changes — quiz is for self-test only.

### 6. AudioButton (shared component)
- `<AudioButton text={word} url={audioUrl} />`.
- On click: tries `new Audio(url).play()` if `url`; on failure or absence, falls back to `speechSynthesis.speak(new SpeechSynthesisUtterance(text))` with `lang = "en-US"`.
- Used in DictionaryPopup, WordsPanel rows, ReviewModal, QuizModal.

## Leitner box algorithm

Six stages. New words enter at stage 0 (`nextReviewAt = createdAt`, due immediately).

| Stage | Interval to next review | Description |
|---|---|---|
| 0 | now | New, never reviewed |
| 1 | +1 day | Just learned |
| 2 | +3 days | Familiar |
| 3 | +7 days | Sticking |
| 4 | +14 days | Solid |
| 5 | +30 days | About to graduate |
| ✓ Mastered | — (out of rotation) | `mastered = true` |

**Rating → transition** (pure function `applyRating(state, rating, now) → state`):

- **Again** → `stage = 1`, `nextReviewAt = now + 1d`, `correctStreak = 0`. (Never reset to 0; 0 is reserved for "never reviewed".)
- **Hard** → `stage` unchanged, `nextReviewAt = now + intervalForStage(stage)`, `correctStreak` unchanged.
- **Good** → if `stage + 1 >= 6`, set `mastered = true`, `stage = 5`, `nextReviewAt = Number.MAX_SAFE_INTEGER`. Otherwise `stage = stage + 1`, `nextReviewAt = now + intervalForStage(newStage)`. `correctStreak += 1`.
- **Easy** → if `stage + 2 >= 6`, set `mastered = true`, `stage = 5`, `nextReviewAt = Number.MAX_SAFE_INTEGER`. Otherwise `stage = stage + 2`, `nextReviewAt = now + intervalForStage(newStage)`. `correctStreak += 1`.

**Due-today query:** `nextReviewAt <= now && !mastered && !deleted`. Sorted oldest-due first. Hard cap of 50 cards/session.

## CSV export

Pure client. One row per non-deleted word. Order: most-recently-saved first.

```
Word,Phonetic,Definition,Example,Contexts,FirstSeen,Stage
elucidate,/ɪˈluːsɪdeɪt/,"make (something) clear; explain.","She elucidated her arguments well.","From ""The Dark Matter Problem"" (ch. 3): …elucidate the dark matter problem…",2026-04-30,3
```

- `Definition` = first definition's `definition` text.
- `Example` = first definition's `example` (or empty).
- `Contexts` = newline-joined `From "BookTitle" (ch. N): …sentence…` entries. Properly RFC 4180 escaped (double-quote-wrapped, embedded `"` doubled, internal newlines preserved).
- `FirstSeen` = ISO date of `createdAt`.
- `Stage` = numeric `0`–`5`, or literal `Mastered`.

Filename: `vocabulary-YYYY-MM-DD.csv`. Triggered via `<a download>` blob URL.

## Backend

### Drizzle schema additions (`book-reader-api/src/db/schema.ts`)

```ts
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

### Routes (`book-reader-api/src/routes/vocabulary.ts`)

Mirrors `routes/highlights.ts`:

- `GET /vocabulary` → `{ words: VocabRow[] }` for the authenticated user, excluding tombstoned rows.
- `PUT /vocabulary/:clientId` → idempotent upsert. Body matches `VocabWord` minus `id`/`syncedAt`/`deleted`. If a row exists for `(userId, clientId)`, server merges by replacing fields (client is source of truth for its own data; `contexts` array is replaced wholesale because the client has the latest accumulation).
- `DELETE /vocabulary/:clientId` → soft delete (`deletedAt = now`).

Authentication via the existing `authMiddleware`.

### Frontend sync (`book-reader-extension/src/newtab/lib/vocab/sync.ts`)

Mirror of `lib/highlights/sync.ts`:

- `pushPendingVocab()` — for each unsynced/dirty entry, PUT to `/vocabulary/:id`; mark `syncedAt`.
- `pullVocab()` — GET `/vocabulary`, write each into local IDB; only overwrite local if local isn't dirty (`!syncedAt || syncedAt >= updatedAt`).

Triggered on sign-in (pull), on every save / Leitner update / delete (debounced push), and on `online` event (push).

## Tests

Vitest unit tests:

- `tests/lib/vocab/leitner.test.ts` — pure-function tests for `applyRating(state, rating, now)`. Cover all 4 ratings × 6 stages = 24 transitions, plus the mastered transition out of stage 4 via Easy.
- `tests/lib/vocab/storage.test.ts` — IndexedDB round-trip, dedup-on-save (defining same word twice merges contexts), tombstone delete, due-today index lookup.
- `tests/lib/vocab/csv.test.ts` — RFC 4180 escape correctness for words/contexts containing commas, quotes, and newlines.

UI surfaces tested manually after build (consistent with existing project convention).

## Files to create / modify

### New (extension)
- `src/newtab/lib/vocab/types.ts`
- `src/newtab/lib/vocab/leitner.ts`
- `src/newtab/lib/vocab/storage.ts`
- `src/newtab/lib/vocab/sync.ts`
- `src/newtab/lib/vocab/csv.ts`
- `src/newtab/hooks/useVocab.ts`
- `src/newtab/components/AudioButton.tsx`
- `src/newtab/components/WordsPanel.tsx`
- `src/newtab/components/ReviewModal.tsx`
- `src/newtab/components/QuizModal.tsx`
- `tests/lib/vocab/leitner.test.ts`
- `tests/lib/vocab/storage.test.ts`
- `tests/lib/vocab/csv.test.ts`

### Modified (extension)
- `src/newtab/components/popups/DictionaryPopup.tsx` — auto-save on mount, ✓/○ toggle pill, AudioButton.
- `src/newtab/App.tsx` — useVocab hook, Words sidebar render, Review/Quiz modal mounts, top-nav button.

### New (backend)
- `book-reader-api/src/services/vocabulary.ts`
- `book-reader-api/src/routes/vocabulary.ts`

### Modified (backend)
- `book-reader-api/src/db/schema.ts` — add `vocabulary` table.
- `book-reader-api/src/index.ts` — mount `/vocabulary`.

## Out of scope / explicit deferrals

- No SM-2 / FSRS algorithm (Leitner only in v1).
- No image-occlusion or cloze cards.
- No bulk import (only export).
- No iOS Flipside integration (the backend table is reusable later).
- No translation in vocabulary entries — only the source-language definition.
- No PDF text-layer scope — Define already works on PDF, so this comes along automatically.
