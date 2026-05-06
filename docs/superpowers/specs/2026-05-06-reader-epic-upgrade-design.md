# Reader Epic Upgrade — Design Spec

**Date:** 2026-05-06
**Branch:** `feature/reader-epic-upgrade`
**Scope:** Single spec, single branch, multiple commits.

**Path convention:** All `src/...` paths in this doc are rooted at `book-reader-extension/`. Backend paths use the explicit `book-reader-api/` prefix.

---

## Goals

Ship a major UX overhaul of the Instant Book Reader extension covering:

1. Multi-theme system (presets + user-defined themes via color picker)
2. Better EPUB chapter/TOC extraction (nested, clean labels)
3. Persistent left sidebar (TOC + Library views) and right sidebar (AI / Highlights / Words)
4. BYOK for AI features (Anthropic, OpenAI, Gemini, OpenRouter) — sign-in stays optional
5. Top nav: thin always-visible strip → click-to-expand (no scroll-hide)
6. PDF: bottom page-thumbnail strip
7. Library experience: progress %, status groups, recent pinned, drag-drop, search, sort

All work occurs on `feature/reader-epic-upgrade`. Each numbered section below is its own commit (or small series).

---

## Non-Goals

- Backend API changes (keep `/ai`, `/highlights`, `/vocabulary` routes as-is)
- Changing the auth provider (Google sign-in stays as one of two AI paths)
- Replacing the design system (`clay-*` classes stay; existing token names preserved — themes override values, not names)
- Mobile / responsive layout (extension is new-tab desktop only)

---

## §1 — Theme System

### 1.1 Approach

`[data-theme="<id>"]` selectors on `<html>`, each block overriding semantic CSS custom properties. Tailwind v4 `@theme` directive resolves them automatically. Custom user themes apply via `setProperty()` on `:root` at runtime.

This pattern was validated against May 2026 best practice — see [Tailwind v4 Multi-Theme Strategy (simonswiss)](https://simonswiss.com/posts/tailwind-v4-multi-theme), [data-theme vs Context (DEV)](https://dev.to/dorshinar/themes-using-css-variables-and-react-context-3e20), [CSS Variables vs Context (Kent C Dodds)](https://www.epicreact.dev/css-variables).

### 1.2 Token taxonomy

**Critical constraint**: Tailwind v4 generates utility classes (`bg-cream`, `text-clay-black`, `border-oat`, `bg-matcha-300`, etc.) directly from the `@theme` block. Renaming or removing those names freezes/breaks the UI codebase-wide.

**Approach**: keep existing token names; treat them as semantic tokens. Themes override the **values**, not the names. No utility class migration needed.

The existing `:root` vars in `index.css` (`--cream`, `--black`, `--white`, `--oat`, `--silver`, `--charcoal`, `--matcha-300`, `--matcha-600`, `--matcha-800`, `--slushie-500`, `--lemon-400`, `--lemon-500`, `--ube-300`, `--ube-800`, `--pomegranate-400`, `--blueberry-800`, `--cool-border`, `--light-frost`, `--shadow-clay`, `--shadow-hover`, `--shadow-hover-sm`) become the semantic layer. Each `[data-theme="<id>"]` block overrides whichever subset it needs. Tokens not overridden inherit from `:root`.

**New tokens added** (don't rename existing):

```
--reader-prose-bg       optional reading column override (sepia uses this)
--pdf-tint              "normal" | "dark" | "sepia"   (drives PDF page color)
```

The `@theme` block in `index.css` is left as-is (every token already maps to a CSS var via `var(--cream)` etc.). Tailwind utility classes continue to resolve at runtime.

**No utility class migration** — `bg-cream`, `text-clay-black`, `border-oat`, accent colors, etc. all keep working unchanged.

### 1.3 Preset registry

15 presets. Each = a `:root[data-theme="<id>"] { /* overrides */ }` block in `src/newtab/themes.css`.

**Specificity guarantee**: presets use `:root[data-theme="..."]` (specificity 0,1,1) — strictly higher than the bare `:root { ... }` light defaults (0,1,0). Theme overrides win regardless of where `themes.css` is imported in `index.css`. The light defaults in `:root` act as the fallback when no `data-theme` attribute is set.

A computed-style test (`tests/themes/cascade.test.ts`) asserts that after `applyTheme("dracula")`, `getComputedStyle(document.documentElement).getPropertyValue('--cream').trim()` returns Dracula's bg color, not the light default. This catches future regressions if anyone adds a later `:root` override.

| ID | Mode | PDF tint | Notes |
|---|---|---|---|
| `light` | light | normal | current default |
| `dark` | dark | dark | current dark |
| `sepia` | light | sepia | warm cream + brown ink |
| `solarized-light` | light | normal | |
| `solarized-dark` | dark | dark | |
| `nord` | dark | dark | |
| `gruvbox-light` | light | sepia | |
| `gruvbox-dark` | dark | dark | |
| `dracula` | dark | dark | |
| `tokyo-night` | dark | dark | |
| `paper` | light | normal | very light, soft contrast |
| `e-ink` | light | normal | grayscale only |
| `rose-pine` | dark | dark | |
| `catppuccin-latte` | light | normal | |
| `catppuccin-mocha` | dark | dark | |

### 1.4 Custom themes

Users build their own from a base preset.

**Storage**: `chrome.storage.local["custom_themes"]: ThemeDef[]`

```ts
type Mode = "light" | "dark";
type PdfTint = "normal" | "dark" | "sepia";

interface ThemeDef {
  id: string;          // "custom-<uuid>"
  name: string;
  mode: Mode;
  baseId: string;      // preset it forked from
  tokens: Partial<SemanticTokens>;  // only overridden fields
  pdfTint: PdfTint;
  createdAt: number;
}

// Theme tokens map to existing CSS var names (so Tailwind utilities keep working).
// Each field's key is the var name without the leading `--` — applied verbatim
// via document.documentElement.style.setProperty('--' + key, value).
// All keys MUST be valid CSS custom-property names (kebab-case where needed).
interface SemanticTokens {
  cream: string;            // page bg
  black: string;            // primary text + solid button bg
  white: string;            // surface (cards, panels)
  oat: string;              // dividers / soft borders
  "oat-light": string;      // nested surface
  silver: string;           // muted text
  charcoal: string;         // strong muted / hover text
  "matcha-300": string;     // success-ish accent
  "matcha-600": string;     // primary accent
  "matcha-800": string;
  "slushie-500": string;    // info accent
  "lemon-400": string;
  "lemon-500": string;
  "ube-300": string;
  "ube-800": string;        // selection / brand purple
  "pomegranate-400": string; // danger
  "blueberry-800": string;
  "light-frost": string;
  // new — only set by some themes:
  "reader-prose-bg"?: string;
}
```

**Activation flow** (`applyTheme(id)`):
1. Clear all prior inline `--*` overrides on `<html>` (track what was set last time so we only clear our own).
2. If `id` matches a preset → set `<html data-theme="<id>">`.
3. If `id` matches a custom theme → set `<html data-theme="<baseId>">` (so unmapped tokens inherit base), then for each entry in `tokens`, `document.documentElement.style.setProperty('--' + key, value)`.
4. Update `<html>` `class` for `dark` (Tailwind `dark:` variants only — see below) based on `mode`.
5. Update `pdfTint` resolution path (see §1.6).

**`.dark` class — strip color overrides**:

Today `index.css` has both:
```css
:root { --cream: ...; --black: ...; --oat: ...; ... }
.dark { --cream: ...; --black: ...; --oat: ...; ... }
```

The `.dark` block conflicts with `[data-theme]` blocks: a dark preset like Nord would have its `--cream` override stomped by `.dark` (or vice versa, depending on cascade source order — fragile).

**Resolution**: `.dark` becomes a Tailwind-variant marker only. **Move all color var overrides out of `.dark`** into `:root[data-theme="dark"]`. The `.dark` selector keeps no `--*` declarations — it exists purely so utilities like `dark:bg-frost` keep working.

Concretely:
```css
:root { /* light defaults */ --cream: #faf9f7; ... }
.dark { /* empty — exists only as Tailwind variant marker */ }
:root[data-theme="dark"]   { --cream: #1a1815; ... }   /* lifted from old .dark block */
:root[data-theme="nord"]   { --cream: #2e3440; ... }
:root[data-theme="dracula"]{ --cream: #282a36; ... }
/* etc. */
```

When activating any dark-mode preset, `applyTheme` sets BOTH `data-theme="<id>"` (for tokens) AND `class="dark"` (for Tailwind variants). They no longer fight because `.dark` doesn't declare colors.

**Theme builder UI** (`ThemeBuilder.tsx`):
- New "Themes" tab in Settings modal
- Grid of presets w/ live preview swatches; click to activate
- "Create custom" button: opens builder modal
- Builder: `<input type="color">` per semantic field, name input, base preset selector, mode toggle, pdf tint segmented control, live preview pane (renders sample text + button + card)
- Save → adds to `custom_themes`, activates
- Edit / delete from grid

### 1.5 Settings shape

`ReaderSettings.theme` ("light" | "dark") deprecated; replaced by `ReaderSettings.themeId: string` plus optional `pdfTintOverride: PdfTint | null` (per-book override → see §1.6).

**Migration** (one-time on settings load):
```ts
if ("theme" in stored && !("themeId" in stored)) {
  stored.themeId = stored.theme === "dark" ? "dark" : "light";
  delete stored.theme;
}
```

### 1.6 PDF tint coupling

Each theme declares `pdfTint`. When PDF viewer mounts, it reads:
```
effectiveTint = settings.pdfTintOverride ?? activeTheme.pdfTint
```

Existing `pdfColorMode` setting becomes `pdfTintOverride: PdfTint | null`.

**Migration** (preserve existing user choice — never silently flip behavior):
- If user had previously customized `pdfColorMode` away from default ("normal") → set `pdfTintOverride = pdfColorMode`. They keep the look they had.
- If `pdfColorMode === "normal"` (default) → set `pdfTintOverride = null` (use theme's tint).
- Always delete the old `pdfColorMode` field after migration.

UI: PDF settings tab gets "Override theme PDF tint" toggle + the existing 3-button segmented control. When toggle off, override is `null`. When on, segmented control sets the override value.

### 1.7 Files

New:
- `src/newtab/lib/themes/types.ts`
- `src/newtab/lib/themes/presets.ts` — `PRESETS: ThemeDef[]`, `getPreset(id)`
- `src/newtab/lib/themes/storage.ts` — load/save custom themes
- `src/newtab/lib/themes/apply.ts` — `applyTheme(id, customs)`
- `src/newtab/hooks/useTheme.ts` — returns `{themeId, setTheme, presets, customs, saveCustom, deleteCustom}`
- `src/newtab/themes.css` — all `[data-theme]` blocks
- `src/newtab/components/ThemeBuilder.tsx`

Modified:
- `src/newtab/index.css` — add new tokens (`--reader-prose-bg`, `--pdf-tint`); `@import "./themes.css"`; **strip color var overrides from `.dark` block** (move to `[data-theme="dark"]` in `themes.css`); leave `.dark {}` empty as Tailwind-variant marker. **Do not rename existing var names** — Tailwind v4 utilities depend on them.
- `src/newtab/lib/storage.ts` — settings shape + migrator
- `src/newtab/components/Settings.tsx` — new "Themes" tab; remove old Theme block from Appearance tab
- `src/newtab/App.tsx` — wire `useTheme()` instead of inline `dark` class toggle

### 1.8 Tests

- `tests/themes/apply.test.ts` — preset switch sets `data-theme`, custom switch sets inline props, mode flag toggles `dark` class
- `tests/themes/migration.test.ts` — old `theme: "dark"` → `themeId: "dark"`

---

## §2 — EPUB TOC Parser

### 2.1 Approach

Two-source: run epubjs `navigation` recursive walk and (when available) manual `nav.xhtml`/`toc.ncx` parse in parallel. Score both with the quality heuristic and pick the winner per §2.3.

### 2.2 Data model

```ts
export interface TocNode {
  id: string;            // stable: tree-path of indices, e.g. "0", "0.0", "0.1.2" — guaranteed unique even when same href appears multiple times or sibling/child point to same XHTML
  label: string;         // cleaned, never empty
  href: string;          // full raw href including fragment
  spineIndex: number;    // index in chapters[]; -1 if can't resolve
  fragment: string | null; // anchor id WITHOUT leading "#" and URL-decoded (e.g. "sec1", "Section 2.1") — used for jumping inside chapter. null if href has no fragment.
  children: TocNode[];
}

export interface ParsedEpub {
  title: string;
  author: string;
  chapters: EpubChapter[];   // existing flat spine — unchanged
  toc: TocNode[];            // NEW — nested
  book: Book;
}
```

`chapters[]` (flat spine) stays — the reader still scrolls by `chapterIndex` = spine index. `toc[]` is purely for navigation UI.

### 2.3 Algorithm

1. **Primary parse — walk navigation**: recursively descend `book.loaded.navigation.toc` → `subitems`. Assign `id` as tree-path (`"0"`, `"0.0"`, `"0.1.2"`).
2. **Resolve spine index**: per node, split href on `#`. The part before `#` (path) is normalized and looked up in the spine href map. The part after `#` is **URL-decoded** via `decodeURIComponent` and stored as `fragment` (without leading `#`); if absent or empty after split, `fragment = null`. If path not found in spine, `spineIndex = -1`.
3. **Clean label**:
   - Trim
   - Drop trailing `.xhtml` / `.html` / `.htm` / `.xml`
   - If label is empty, all-caps single token >30 chars, or pure punctuation → try chapter heading: parse spine HTML for that `spineIndex`, take first `<h1>` / `<h2>` text
   - If still empty → `Chapter <N>` where N = spineIndex + 1 (or generic `Section <pathIndex>` if spineIndex === -1)
4. **Compute quality** (`tocQuality(toc)` returns `{score: number, goodEnough: boolean}`):
   - Score = % of node labels that are NOT (empty / filename-shaped / `Chapter \d+` defaults)
   - `goodEnough` = score ≥ 60% AND total nodes ≥ 1
5. **Fallback parse — always run if available** (don't gate on primary failure; needed to compare):
   - Locate `nav.xhtml` via `book.packaging.navPath` (EPUB3) or `toc.ncx` via `book.packaging.ncxPath` (EPUB2)
   - If neither path available → skip fallback
   - Load raw XML via `book.archive.getText(path)`
   - DOMParser:
     - EPUB3: `<nav epub:type="toc"> ol > li > a` — recursive nested `<ol>` walk
     - EPUB2: `<navMap> navPoint > navLabel/text + content[src]` — recursive
   - Build `TocNode[]`, run same spine-index resolution + label clean (steps 2–3)
   - Compute quality on fallback result
6. **Pick winner**:
   - If fallback unavailable → use primary
   - If only one passes `goodEnough` → use that one
   - If both pass → prefer fallback (cleaner labels in tested cases)
   - If neither passes → use whichever has higher score; if tied, prefer primary (less code path)

### 2.4 Helpers

```ts
// in src/newtab/lib/parsers/toc-quality.ts
function tocQuality(toc: TocNode[]): { score: number; goodEnough: boolean }

// in src/newtab/lib/parsers/toc-progress.ts
type ChapterStatus = "unread" | "current" | "read";
function getChapterStatus(spineIndex: number, position: ReadingPosition | null): ChapterStatus
function flattenToc(toc: TocNode[]): TocNode[]   // for scroll-spy lookup
```

### 2.5 Files

New:
- `src/newtab/lib/parsers/epub-toc-fallback.ts` — `parseTocFromNav`, `parseTocFromNcx`
- `src/newtab/lib/parsers/toc-quality.ts`
- `src/newtab/lib/parsers/toc-progress.ts`

Modified:
- `src/newtab/lib/parsers/epub.ts` — add `toc` to `ParsedEpub`, recursive walker, label cleaner

### 2.6 Tests

- `tests/parsers/epub-toc.test.ts` — fixture epubs (one EPUB3 w/ nested nav, one EPUB2 w/ ncx, one with missing labels triggering fallback)
- `tests/parsers/toc-quality.test.ts` — bad-label detection

---

## §3 — App Shell & Sidebars

### 3.1 Layout

```
┌──────────────────────────────────────────────────┐
│  TopStrip (collapsed) ▼   ← always visible       │  28px
├──┬────────────────────────────────────┬──────────┤
│  │                                    │          │
│  │           Reader                   │          │
│LR│         (full content)             │   RR     │  flex
│  │                                    │          │
│  │                                    │          │
└──┴────────────────────────────────────┴──────────┘
LR = Left Rail (60px icons)         RR = Right Rail (60px icons)
```

When a left-rail icon is clicked, an inline panel opens between the rail and the reader (~280px). Right rail mirrors the behavior on its side. Multiple panels can be open simultaneously (one left + one right).

### 3.2 Component tree

```
<App>
  {/* useAppBootstrap() runs first thing in App: loads settings → applyTheme(themeId), loads BYOK cache, panel state */}
  <AppShell>
    {/* useTheme() inside AppShell exposes setTheme; no separate ThemeProvider component */}
    <TopBar collapsed={topCollapsed} onToggle={...} />
    <div className="flex flex-1">
      <LeftRail activePanel={leftPanel} onActivate={setLeftPanel} />
      <LeftPanel id={leftPanel} onClose={() => setLeftPanel(null)}>
        {leftPanel === "toc"     && <TocPanel ... />}
        {leftPanel === "library" && <LibraryPanel ... />}
      </LeftPanel>
      <main className="flex-1"><Reader ... /></main>   {/* Reader internally renders PdfViewer (which owns pdfDoc + the bottom strip) for PDFs, or the EPUB/TXT renderer */}
      <RightPanel id={rightPanel} onClose={() => setRightPanel(null)}>
        {rightPanel === "ai"         && <AIPanel ... />}
        {rightPanel === "highlights" && <HighlightsPanel ... />}
        {rightPanel === "words"      && <WordsPanel ... />}
      </RightPanel>
      <RightRail activePanel={rightPanel} onActivate={setRightPanel} />
    </div>
    {/* PdfThumbnailStrip renders INSIDE PdfViewer (not here) — see §7.2 */}
    {/* modals: Settings, Library upload (dropped — see §6.3), DictionaryPopup, etc. */}
  </AppShell>
</App>
```

### 3.3 Rail spec

- Width: 60px when visible; rendered as `display: none` when hidden (saves layout space cleanly).
- Visibility per rail is persisted in `ReaderSettings`: `showLeftRail: boolean` (default `true`), `showRightRail: boolean` (default `true`).
- Settings UI: new "Layout" section in **Reader** tab — two `ToggleRow`s ("Show left navigation rail", "Show right tools rail"). Default both on.
- Hiding a rail also forces its panel closed (`leftPanel = null` / `rightPanel = null` in `panel_state`).
- Icons: vertically stacked, ~36px hit area, semantic icon + label tooltip on hover
- Active icon: filled state, accent color, slight inset
- Click active icon again → close panel
- Keyboard: `[` toggles left panel, `]` toggles right panel, `Esc` closes focused panel. Keyboard shortcuts are no-ops if the corresponding rail is hidden.

**Left rail icons (top → bottom)**: TOC, Library, [spacer], Settings (opens modal).

**Right rail icons (top → bottom)**: AI, Highlights, Words, [spacer], User avatar / Sign-in.

### 3.4 Panel spec

- Default width: 280px (per panel; persisted via `panel_state.widths` — see §3.5; no separate storage key)
- Drag-resize handle on inner edge; min 220px, max 460px
- Animation: slide-in from edge (200ms ease-out), fade content 150ms
- Content scrolls independently
- Header: panel title + close X
- Body: scrollable
- Backdrop: none (persistent layout, not modal)

### 3.5 Persistence

Single source of truth:

```ts
chrome.storage.local["panel_state"]: {
  left: PanelId | null;
  right: PanelId | null;
  widths: Partial<Record<PanelId, number>>;
}
```

Restored on mount. Drag-resize updates `widths[panelId]` and writes the whole `panel_state` object back. Open/close updates `left`/`right`.

### 3.6 Files

New:
- `src/newtab/components/AppShell.tsx`
- `src/newtab/components/shell/TopBar.tsx`
- `src/newtab/components/shell/LeftRail.tsx`
- `src/newtab/components/shell/RightRail.tsx`
- `src/newtab/components/shell/Panel.tsx` — generic resizable container
- `src/newtab/components/panels/TocPanel.tsx`
- `src/newtab/components/panels/LibraryPanel.tsx` — replaces `Library.tsx` modal (deleted; see §6)
- `src/newtab/hooks/usePanelState.ts`

Modified:
- `src/newtab/App.tsx` — top-level state (book/auth/settings) only; layout extracted to AppShell
- `src/newtab/components/AIPanel.tsx`, `HighlightsPanel.tsx`, `WordsPanel.tsx` — accept `onClose`, lose modal-ish chrome, fit panel container
- `src/newtab/components/Library.tsx` — **delete** (replaced by `LibraryPanel`)

### 3.7 Tests

- `tests/shell/panel-state.test.ts` — open/close, persistence, mutual exclusion (only one panel per side)
- `tests/shell/rail-visibility.test.ts` — hiding a rail forces its panel closed; keyboard shortcut is a no-op when rail hidden; settings round-trip
- Component smoke tests via vitest + jsdom for AppShell rendering

---

## §4 — Top Nav Collapse

### 4.1 Behavior

Replace the current scroll-driven hover toolbar with a click-to-expand strip.

**Collapsed state** (default, ~28px tall, always visible):
- Left: book title (truncated) + format badge
- Right: chevron-down expand button + reading-time estimate
- No backdrop, no animation on idle

**Expanded state**:
- Drops down to ~120px tall
- Top row: book title + author, format badge. (Library/TOC live in left rail; AI/Highlights/Words and sign-in/avatar live in right rail — no duplication.)
- Bottom row: inline reading controls — font size slider, line-height slider, font-family picker, theme quick-switcher (current theme + "more" → opens Settings → Themes)
- Close X on right
- Click outside or Esc → collapse

The current `pinToolbar` setting is removed; default is "always show collapsed strip", which is functionally what users wanted from pin.

### 4.2 No more scroll-hide

Remove `toolbarHover`, `setToolbarHover`, the `absolute … translate-y-…` block, and all hover-driven visibility.

### 4.3 Files

Modified:
- `src/newtab/components/shell/TopBar.tsx` — new component (replaces inline nav in App.tsx)
- `src/newtab/components/shell/InlineReaderControls.tsx` — slider trio + font picker
- `src/newtab/lib/storage.ts` — drop `pinToolbar`

### 4.4 Tests

- `tests/shell/topbar.test.ts` — collapsed/expanded toggle, keyboard escape, click-outside, slider value updates

---

## §5 — Library Panel (left sidebar, view 2)

### 5.1 Features (all of)

1. Per-book progress %
2. Status groups: **Reading** (progress > 0 && < 100), **Finished** (=100), **Unstarted** (0)
3. Recent pinned at top (3 most-recently-opened, regardless of status)
4. Inline drag-drop add (drop a file anywhere into the panel → upload)
5. Search input (case-insensitive, matches title + author)
6. Sort: recent / title / author. `recent` sorts by `lastOpenedAt` desc; `title` / `author` sort A→Z.

### 5.2 Data needed

`BookMetadata` already has `addedAt`. Add:
- `lastOpenedAt: number` — updated whenever `switchBook` runs

**Progress source of truth**: `chrome.storage.local["pos_<hash>"]` (existing reading positions). No `progress` field on `BookMetadata` — eliminates two-source divergence.

`useBook()` hook already exposes `library`. Extend to provide `progressByHash: Record<string, number>`:
- Computed once on mount: read all `pos_*` keys, map to `{[hash]: position.percentage}`
- Refreshed in two cases: (a) `switchBook` triggers a refetch for that one hash, (b) `chrome.storage.onChanged` listener bumps the entry whenever any `pos_*` key changes (covers cross-tab sync and within-session position updates from `usePosition`).
- The hook returns a stable reference; consumers re-render only when a hash they read actually changes.

### 5.3 UI structure

```
[Search input]                           [Sort ▾]
─────────────────────────────────────────────────
RECENT (max 3)
  📕 Book A      72%   2h ago
  📘 Book B      12%   1d ago
─────────────────────────────────────────────────
READING (n)
  📗 Book C      45%   3d ago
  📕 Book D      88%   1w ago
─────────────────────────────────────────────────
UNSTARTED (n)
  📘 Book E       —    just now
─────────────────────────────────────────────────
FINISHED (n)
  📕 Book F     ✓100%  2w ago
─────────────────────────────────────────────────

[+ Drop or click to add a book]
```

- Dragging a file over the panel highlights the drop region
- Click row → `switchBook(hash)` (panel stays open)
- Hover row → shows trash icon (delete confirm inline, like current)
- Active book row gets accent ring

### 5.4 Files

New:
- `src/newtab/components/panels/LibraryPanel.tsx`

Modified:
- `src/newtab/lib/storage.ts` — add `lastOpenedAt` to `BookMetadata`, persist on `switchBook`
- `src/newtab/hooks/useBook.ts` — expose `progressByHash`, update `lastOpenedAt`

Removed:
- `src/newtab/components/Library.tsx` (modal)

### 5.5 Tests

- `tests/panels/library-grouping.test.ts` — group computation correctness
- `tests/panels/library-search.test.ts` — search filter + sort

---

## §6 — TOC Panel (left sidebar, view 1)

### 6.1 Features

- Nested tree (collapse/expand chevrons on parent nodes)
- Per-chapter dot: empty (unread), filled (read), accent ring (current)
- Scroll-spy: when reader's `chapterIndex` changes, auto-scroll active node into view (smooth, only if not in viewport)
- Click node → `goToTocNode(node)` (see below); no-op if `spineIndex === -1`
- Search input at top — filters tree (collapses unrelated branches, expands matches)

**`goToTocNode(node)` behavior**:
1. If `node.spineIndex !== position.chapterIndex`, call existing `goToChapter(node.spineIndex)` to switch chapter.
2. After chapter content renders, if `node.fragment` is non-null:
   - First try `proseRef.current.querySelector(...)` is **not** used (raw fragments may contain characters like `:`, `.`, spaces, parentheses that break CSS selectors). Use `document.getElementById(node.fragment)` scoped to the prose container by walking the result up via `contains()`.
   - Implementation: `const el = proseRef.current?.ownerDocument.getElementById(node.fragment); if (el && proseRef.current?.contains(el)) el.scrollIntoView({block: "start"})`.
   - **Fallback for legacy `<a name="">` anchors**: if no element found by id, search for `[name]` via attribute selector with proper escaping: `proseRef.current?.querySelector('[name="' + CSS.escape(node.fragment) + '"]')`.
   - All scrolls happen on the next animation frame after content mounts (existing position-restore effect runs first; fragment scroll runs after).
3. If `fragment === null`, scroll to top of chapter (current `goToChapter` behavior).
4. PDFs ignore `fragment` (PDF "chapters" are pages — fragments don't apply).

**Implementation note**: `Reader.tsx` accepts two new optional props:
- `pendingFragment: string | null` — the fragment to scroll to after the next chapter render
- `onPendingFragmentConsumed: () => void` — called by Reader after it has located the anchor (or determined no match exists), so App.tsx can null out its state. Required because `App.tsx` owns the pending-fragment state — Reader has no direct way to clear it without this callback.

`App.tsx` holds `pendingFragment: string | null` in `useState`, set by `goToTocNode`. `Reader`'s effect that handles the fragment scroll calls `onPendingFragmentConsumed()` in its cleanup or after the scroll attempt to prevent re-firing on subsequent renders.

### 6.2 Behavior

- Initial state: all parent nodes collapsed except the path to current chapter
- Persist expand/collapse state per book hash in `chrome.storage.local["toc_state_<hash>"]`
- Empty state (`toc.length === 0`): show flat chapter list (`Chapter 1 … Chapter N`)

### 6.3 Files

New:
- `src/newtab/components/panels/TocPanel.tsx`
- `src/newtab/components/panels/TocNode.tsx` — recursive node renderer

Tests:
- `tests/panels/toc-render.test.ts` — nested rendering, dot states, scroll-spy logic
- `tests/panels/toc-search.test.ts`

---

## §7 — PDF Bottom Thumbnail Strip

### 7.1 Behavior

PDF format only. Renders a horizontal strip below the reader (~120px tall) showing thumbnails of nearby pages. Replaces the in-PDF page-nav buttons (those become a fallback if `pdfShowPageNav` is on).

- Shows current page enlarged (highlighted) + 4 pages on each side
- Click thumbnail → jump page
- Drag-scrub left/right to fast-page-through
- Mousewheel-horizontal to scroll strip
- Toggle visibility via setting `pdfShowThumbnailStrip` (default: on)

### 7.2 Implementation

- **Renders inside `PdfViewer.tsx`** as a child element, not as a sibling outside Reader. PdfViewer owns the `pdfDoc` instance and current page state, so the strip can read both directly without lifting state.
- Layout: PdfViewer becomes a flex column — page area (`flex-1`) on top, `<PdfThumbnailStrip>` (`flex-none`, ~120px tall) at the bottom. Strip hides when `pdfShowThumbnailStrip === false`.
- `PdfThumbnailStrip` props: `pdfDoc: PDFDocumentProxy`, `currentPage: number`, `totalPages: number`, `onJumpToPage: (n: number) => void`.
- Render thumbnails to `<canvas>` at ~120×160 (scale = 0.2)
- Cache rendered canvases by page number (LRU, max 30 entries) via `usePdfThumbnails` hook
- Render only visible thumbnails + 2-page lookahead (intersection observer)

### 7.2.1 Replacement of side-thumbnail sidebar

The current `PdfThumbnails` side panel (`pdfShowThumbnails` setting) is **deleted** and replaced by the bottom strip. Rationale: bottom strip is more discoverable and matches user inspirations (Img 4); side panel was a less-used feature.

**Migration**:
- Delete `pdfShowThumbnails` from `ReaderSettings`
- Delete `PdfThumbnails` component file
- Add `pdfShowThumbnailStrip: boolean` (default `true`) to `ReaderSettings`
- Settings migrator: drop `pdfShowThumbnails`, set `pdfShowThumbnailStrip` to `true` regardless of old value
- The new "Thumbnails Sidebar" toggle in Settings PDF tab → renamed to "Thumbnail Strip"

### 7.3 Files

New:
- `src/newtab/components/pdf/PdfThumbnailStrip.tsx`
- `src/newtab/components/pdf/usePdfThumbnails.ts` — cached canvas renderer

Modified:
- `src/newtab/components/pdf/PdfViewer.tsx` — render `<PdfThumbnailStrip>` as last flex child; pass `pdfDoc`, `currentPage`, `totalPages`, `onJumpToPage` directly; no need to lift state
- `src/newtab/lib/storage.ts` — drop `pdfShowThumbnails`, add `pdfShowThumbnailStrip` (default true), settings migrator

Removed:
- `src/newtab/components/pdf/PdfThumbnails.tsx` (side panel — replaced by bottom strip)

### 7.4 EPUB note

EPUB keeps its current bottom pill scrubber (no thumbnail strip). The pill code stays in `Reader.tsx` unchanged.

---

## §8 — BYOK (Bring Your Own Key)

### 8.1 Providers

| Provider | Default model | Endpoint | Notes |
|---|---|---|---|
| Anthropic | `claude-sonnet-4-6` | `https://api.anthropic.com/v1/messages` | Requires `anthropic-dangerous-direct-browser-access: true` header for browser calls |
| OpenAI | `gpt-5.5` | `https://api.openai.com/v1/chat/completions` | **Use Chat Completions API** (not Responses) for parity w/ OpenRouter and to keep one request shape. OpenAI continues to support Chat Completions for current models. |
| Google | `gemini-3.1-pro-preview` | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | API key as `?key=` query param |
| OpenRouter | `anthropic/claude-sonnet-4.6` | `https://openrouter.ai/api/v1/chat/completions` | OpenAI-compatible request shape |

### 8.2 Storage

`chrome.storage.local["byok"]: ByokConfig`

```ts
type Provider = "anthropic" | "openai" | "google" | "openrouter";

interface ByokConfig {
  activeProvider: Provider | null;
  keys: Partial<Record<Provider, string>>;
  models: Partial<Record<Provider, string>>;   // override default model per provider; if absent, use the default in §8.1
}
```

Plain storage (per user spec). Keys are **never sent to our backend** — they go only to the selected provider's API as request credentials. The extension's `host_permissions` in `manifest.json` must include the four endpoints above so the browser permits these direct calls.

### 8.3 Manifest permissions

Add to `host_permissions`:
```
https://api.anthropic.com/*
https://api.openai.com/*
https://generativelanguage.googleapis.com/*
https://openrouter.ai/*
```

### 8.4 AI client refactor

Current `book-reader-extension/src/newtab/lib/api.ts` exports `aiSummarize`, `aiAsk`, `aiHighlights`, `aiExplain`, `aiTranslate` — each returning an **object** (`{summary}`, `{answer}`, `{highlights}`, `{explanation}`, `{translation, detectedLang?}`). Existing callers (`App.tsx`, `useAI.ts`) destructure those shapes.

**Compatibility rule**: Public exports in `lib/api.ts` keep their **exact current signatures and return shapes**. The router/client layer is internal.

Internal layer:

```ts
// book-reader-extension/src/newtab/lib/ai/types.ts
export type Provider = "anthropic" | "openai" | "google" | "openrouter";
export type Source   = "server" | Provider;

export interface AiClient {
  summarize(text: string): Promise<string>;
  ask(question: string, context: string): Promise<string>;
  highlights(text: string): Promise<string[]>;
  explain(selection: string, context: string): Promise<string>;
  translate(text: string, targetLang: string): Promise<{ text: string; detectedLang?: string }>;
}

// router exposes a factory closed over bookHash; server client uses it for /ai/* calls,
// direct clients ignore. Prevents bookHash from leaking into method signatures.
export function getAiClient(bookHash: string | null): AiClient
```

- `lib/ai/server.ts` — implements `AiClient` by calling current backend `/ai/*` endpoints via shared `lib/http.ts` (see below); unwraps `{summary}` etc. into bare strings/arrays
- `lib/ai/anthropic.ts`, `openai.ts`, `google.ts`, `openrouter.ts` — direct API
- `lib/http.ts` (NEW) — extracts the auth-token + `request<T>()` helper currently buried inside `lib/api.ts`. Exports `setAuthToken`, `getAuthToken`, `isAuthenticated`, `request<T>()`. Both `lib/api.ts` (existing non-AI endpoints: position sync, highlights, vocab, auth) and `lib/ai/server.ts` import from here. This breaks the would-be circular import (`api.ts → router → server.ts → api.ts`) and gives the auth token a single owner.
- `lib/api.ts` reduces to a thin wrapper layer that re-exports `setAuthToken`, `isAuthenticated`, `isOnline` from `lib/http.ts` for compatibility with existing consumers (`useAuth.ts`, etc.); existing call sites importing from `lib/api.ts` keep working with no churn.
- `lib/ai/byok-cache.ts` — module-level cache holding the latest `ByokConfig`. Exports:
  - `getCachedByok(): ByokConfig` — synchronous read; returns `{activeProvider: null, keys: {}, models: {}}` if not yet initialized
  - `setCachedByok(c: ByokConfig): void` — overwrites cache; called by `useByok` whenever config changes
  - `loadByokIntoCache(): Promise<void>` — reads from `chrome.storage.local["byok"]` and calls `setCachedByok`. Invoked once during `useAppBootstrap` BEFORE any AI call is possible. Also rebinds via `chrome.storage.onChanged` so other tabs/windows stay in sync.
- `lib/ai/router.ts` — `getAiClient(bookHash)` — synchronous; reads `getCachedByok()` (from `byok-cache`) and `isAuthenticated()` (from `http`); selection rules:
  1. `getConfiguredProvider(byok)` returns `byok.activeProvider` only if it is non-null AND `byok.keys[byok.activeProvider]` is a non-empty string. Otherwise returns `null`.
  2. If `getConfiguredProvider(byok)` returns a provider → use that direct client.
  3. Else if `isAuthenticated()` → use `server` client.
  4. Else throw `Error("AI not configured")`.

  This fallback is intentional: a user who selected Anthropic but cleared their key gets quietly routed to the server (if signed in), instead of failing. If they're signed-out and have no key, the call throws.

- `lib/ai/byok-helpers.ts` (NEW) — exports `getConfiguredProvider(byok: ByokConfig): Provider | null` so both router and `useAI` use the same definition of "BYOK is actually usable".
- `lib/ai/prompts.ts` — shared prompt templates

`lib/api.ts` keeps its current public exports as thin **wrapper functions** that re-shape:

```ts
export async function aiSummarize(bookHash: string, text: string): Promise<{ summary: string }> {
  return { summary: await getAiClient(bookHash).summarize(text) };
}
export async function aiTranslate(bookHash: string, text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
  const r = await getAiClient(bookHash).translate(text, targetLang);
  return { translation: r.text, detectedLang: r.detectedLang };
}
// ...same pattern for aiAsk, aiHighlights, aiExplain
```

`bookHash` arg is preserved on the wrapper signature and passed to `getAiClient(bookHash)`. The server client closes over it for `/ai/*` routes; direct clients accept it via the factory and ignore.

**`App.tsx` requires no changes** — public API shapes are unchanged.

**`useAI.ts` requires one change**: `available` must reflect actual usability — both that a key exists for the selected provider AND/OR sign-in is active:
```ts
import { useByok } from "../hooks/useByok";
import { getConfiguredProvider } from "../lib/ai/byok-helpers";
import { isAuthenticated } from "../lib/http";
// ...
const byok = useByok();
const available = getConfiguredProvider(byok) !== null || isAuthenticated();
```
Same `getConfiguredProvider` helper as the router — single source of truth for "BYOK works".

The byok-cache module still exists for the router (which is called outside React context).

Each direct provider wraps the same prompts the backend uses. Lift them from `book-reader-api/src/services/ai.ts` and `book-reader-api/src/services/translate.ts` into `lib/ai/prompts.ts` (single source of truth, both extension and backend can import from a shared location later if needed).

### 8.5 Auth interaction

Current `useAuth()` keeps Google sign-in for highlights/vocab cloud sync. AI no longer requires sign-in if BYOK is **configured** (active provider has a non-empty key).

`useAI()` resolves availability:
```ts
available = getConfiguredProvider(byok) !== null || isAuthenticated()
```

`getConfiguredProvider` is defined in §8.4 and returns the active provider only if its key is set. This is the single source of truth — same helper used by the router. Selecting a provider in the UI without entering its key does NOT make AI "available".

**Priority** (matches router rules in §8.4):
1. BYOK if configured (`getConfiguredProvider !== null`) — takes precedence over server
2. Server if signed in
3. Otherwise unavailable

### 8.6 Settings UI

New "AI Keys" tab in Settings modal:
- Section per provider: API key input (`type="password"` w/ show/hide toggle), model picker (curated list per provider, plus "default"), Test button (calls a tiny ping prompt, shows ✓ or error)
- Active provider radio at top
- "Use server (Google sign-in)" radio as fifth option — selecting this when not signed in triggers the sign-in flow inline
- Clear-all-keys button

### 8.7 Files

New:
- `src/newtab/lib/http.ts` — shared HTTP layer + auth-token owner (extracted from current `lib/api.ts`)
- `src/newtab/lib/ai/types.ts`
- `src/newtab/lib/ai/server.ts` — wraps backend `/ai/*` via `lib/http.ts`
- `src/newtab/lib/ai/anthropic.ts`, `openai.ts`, `google.ts`, `openrouter.ts` — direct API clients
- `src/newtab/lib/ai/router.ts` — `getAiClient(bookHash)` factory
- `src/newtab/lib/ai/prompts.ts` — shared prompt templates (lifted from `book-reader-api/src/services/{ai,translate}.ts`)
- `src/newtab/lib/ai/byok-cache.ts` — sync cache for router
- `src/newtab/lib/ai/byok-helpers.ts` — `getConfiguredProvider`
- `src/newtab/components/settings/ByokSettings.tsx`
- `src/newtab/hooks/useByok.ts` — hook keeps `byok-cache` and `chrome.storage.local["byok"]` in sync; subscribes to `chrome.storage.onChanged`

Modified:
- `src/newtab/lib/api.ts` — non-AI exports (auth, position sync, highlights, vocab) re-export from `lib/http.ts` for backward compat. AI exports (`aiSummarize`, `aiAsk`, `aiHighlights`, `aiExplain`, `aiTranslate`) keep their public signatures + return shapes; reimplemented as thin wrappers around `getAiClient(bookHash).<method>()`.
- `src/newtab/hooks/useAI.ts` — derive `available` from `getConfiguredProvider(useByok()) !== null || isAuthenticated()`; AI calls still go through `lib/api.ts` wrappers (no changes required at call sites)
- `src/newtab/components/Settings.tsx` — add "AI Keys" tab
- `book-reader-extension/public/manifest.json` — extend `host_permissions`

### 8.8 Tests

- `tests/ai/router.test.ts` — provider selection logic, fallbacks
- `tests/ai/anthropic.test.ts`, etc. — request shape (mocked `fetch`)
- `tests/ai/openai-endpoint-guard.test.ts` — assert OpenAI client uses `/v1/chat/completions` (not `/v1/responses`) and that the configured default model resolves through Chat Completions. If OpenAI deprecates Chat Completions for `gpt-5.5`+ in the future, this test fails loudly and the spec for §8.1 must be revisited (Responses API has different request/response shapes — non-trivial migration).
- `tests/byok/storage.test.ts` — load/save round-trip, including `models` field

---

## §9 — Cross-cutting

### 9.1 Settings modal restructure

Tabs after this work:
1. **Themes** (new) — preset grid, custom themes, theme builder entry
2. **Reader** — translate-to language; font/size/line-height also configurable here (mirrors inline TopBar controls — same setting backing them)
3. **AI Keys** (new) — BYOK
4. **PDF Viewer** — view mode, override PDF tint, toggles for in-PDF toolbar buttons (those buttons themselves become less important w/ thumbnail strip but stay configurable)

Removed: Appearance tab (its content split across Themes + inline TopBar)

### 9.2 Migration order on mount

```
1. load settings
   - migrate theme: "light" | "dark"  →  themeId
   - migrate pdfColorMode  →  pdfTintOverride (see §1.6)
   - drop pinToolbar
2. load custom themes
3. applyTheme(settings.themeId)
4. load library metadata + lastOpenedAt
5. load panel state
6. load byok config
7. resume current book + position
```

All wrapped in a single `useAppBootstrap()` hook to avoid mount-flash.

### 9.3 Manifest changes

```
host_permissions: + 4 AI endpoints
storage:           unchanged (chrome.storage.local already declared)
permissions:       unchanged
```

### 9.4 File map summary

```
src/newtab/
├── App.tsx                                # trim down — top-level state + AppShell
├── index.css                              # add new tokens, @import themes.css; preserve existing token names
├── themes.css                             # NEW — all [data-theme] blocks
├── components/
│   ├── AppShell.tsx                       # NEW
│   ├── ThemeBuilder.tsx                   # NEW
│   ├── Reader.tsx                         # remove bottom-pill nav code only for PDFs
│   ├── Settings.tsx                       # restructure tabs
│   ├── AIPanel.tsx                        # adapt to Panel container
│   ├── HighlightsPanel.tsx                #   "
│   ├── WordsPanel.tsx                     #   "
│   ├── Library.tsx                        # DELETED
│   ├── shell/
│   │   ├── TopBar.tsx                     # NEW
│   │   ├── LeftRail.tsx                   # NEW
│   │   ├── RightRail.tsx                  # NEW
│   │   ├── Panel.tsx                      # NEW (generic resizable)
│   │   └── InlineReaderControls.tsx       # NEW
│   ├── panels/
│   │   ├── TocPanel.tsx                   # NEW
│   │   ├── TocNode.tsx                    # NEW
│   │   └── LibraryPanel.tsx               # NEW
│   ├── pdf/
│   │   ├── PdfViewer.tsx                  # accept controlled page
│   │   ├── PdfThumbnailStrip.tsx          # NEW
│   │   └── usePdfThumbnails.ts            # NEW
│   └── settings/
│       └── ByokSettings.tsx               # NEW
├── hooks/
│   ├── useTheme.ts                        # NEW
│   ├── useByok.ts                         # NEW
│   ├── usePanelState.ts                   # NEW
│   ├── useAppBootstrap.ts                 # NEW
│   ├── useBook.ts                         # add lastOpenedAt + progressByHash
│   └── useAI.ts                           # use router
└── lib/
    ├── storage.ts                         # settings shape; lastOpenedAt; migrators
    ├── http.ts                             # NEW — auth-token + request<T> (extracted from api.ts)
    ├── api.ts                              # non-AI exports re-export from http.ts; AI exports keep public shapes, wrap getAiClient(bookHash)
    ├── parsers/
    │   ├── epub.ts                         # add toc field
    │   ├── epub-toc-fallback.ts            # NEW
    │   ├── toc-quality.ts                  # NEW
    │   └── toc-progress.ts                 # NEW
    ├── themes/
    │   ├── types.ts                        # NEW
    │   ├── presets.ts                      # NEW
    │   ├── storage.ts                      # NEW
    │   └── apply.ts                        # NEW
    └── ai/
        ├── types.ts                        # NEW
        ├── prompts.ts                      # NEW (lifted from book-reader-api/src/services/{ai,translate}.ts)
        ├── router.ts                       # NEW
        ├── byok-cache.ts                   # NEW — sync cache, subscribed to chrome.storage.onChanged
        ├── byok-helpers.ts                 # NEW — getConfiguredProvider
        ├── server.ts                       # NEW — uses lib/http.ts
        ├── anthropic.ts                    # NEW
        ├── openai.ts                       # NEW
        ├── google.ts                       # NEW
        └── openrouter.ts                   # NEW
```

---

## §10 — Commit plan

Each commit is independently testable; running tests between commits should pass.

1. `feat(themes): add new tokens + themes.css scaffold` — preserves existing token names; introduces `--reader-prose-bg`, `--pdf-tint`; sets up `themes.css` import. No visual change yet.
2. `feat(themes): preset registry + applyTheme + useTheme` — 15 presets, no UI yet
3. `feat(themes): custom theme storage + builder UI` — Themes tab in Settings
4. `feat(epub): nested TOC + fallback parser`
5. `feat(epub): chapter progress + scroll-spy helpers`
6. `feat(shell): AppShell + LeftRail + RightRail + Panel container` — wire existing right-side panels first
7. `feat(toc): TocPanel`
8. `feat(library): LibraryPanel; delete Library modal`
9. `feat(shell): TopBar w/ collapse + inline reader controls`
10. `feat(pdf): PdfThumbnailStrip`
11. `feat(ai): router + provider clients`
12. `feat(byok): ByokSettings + manifest permissions`
13. `chore: remove pinToolbar, dead Appearance tab fields`

---

## §11 — Testing

- `vitest` (already configured) for unit + integration tests
- Component smoke tests via `@testing-library/react` (add if not present)
- Manual test matrix per commit (light/dark/sepia + custom theme; epub with nested TOC + epub w/ flat TOC + epub w/ filename TOC; PDF; with sign-in / with BYOK / with neither)

---

## §12 — Risks

- **Tailwind v4 var resolution**: themes override values of existing token names (e.g. `--cream`, `--matcha-600`) so utility classes (`bg-cream`, `text-matcha-600`) keep working. Risk: a preset omits a token and inherits from `:root` (light defaults) on a dark theme. Mitigation: every preset must override the full set of bg/surface/text/border/accent tokens; lint test enforces this.
- **epubjs internals**: relying on `book.packaging.navPath` and `book.archive.getText()` which are semi-public. Mitigation: feature-detect, fall back to navigation result.
- **Direct API CORS**: Anthropic, OpenAI, Gemini, OpenRouter all support CORS for browser calls in 2026; verify `anthropic-dangerous-direct-browser-access: true` header for Anthropic. If any provider blocks browser calls, route via background service worker.
- **PDF thumbnail memory**: 30-canvas LRU caps memory; for very large PDFs (1000+ pages) this is fine.
- **Migration of `theme` setting**: covered by guarded migrator; tested.

---

## §13 — Out of scope (not in this branch)

- Cloud sync of custom themes
- Theme marketplace / sharing
- Per-book theme overrides (book-specific theme)
- Reading-stats/analytics dashboards
- Audio book / TTS expansion beyond current vocab AudioButton
