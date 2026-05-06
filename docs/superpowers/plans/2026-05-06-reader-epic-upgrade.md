# Reader Epic Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multi-theme support, nested EPUB TOC, sidebar layout, BYOK AI, and TopBar collapse to the Instant Book Reader extension on branch `feature/reader-epic-upgrade`.

**Architecture:** CSS-variable-driven themes (`:root[data-theme="..."]`), React shell with thin icon rails + slide-out panels, strategy-pattern AI router with provider-specific clients, single-source `lib/http.ts` for auth-token + `request<T>`, single-source `panel_state` storage.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vite, Vitest, jsdom, epubjs, pdfjs-dist, chrome.storage.local.

**Spec:** `docs/superpowers/specs/2026-05-06-reader-epic-upgrade-design.md` (authoritative — read before each phase).

**Path convention:** all `src/...` paths are rooted at `book-reader-extension/`. Backend: `book-reader-api/`.

**Working dir for all commands:** `book-reader-extension/`.

**Quality bar (Uncle Bob clean code):**
- Function names describe what they do, not how (e.g. `applyTheme`, not `setVars`)
- Variable names describe their content (e.g. `activePresetId`, not `id`)
- Functions ≤ ~30 lines; ≤ 3 args
- Single responsibility per file/module
- No magic numbers (use named constants)
- No commented-out code
- Tests: arrange/act/assert, one assertion per concept, descriptive names like `appliesDarkPresetByDataAttribute`
- No `any` unless interfacing with untyped third-party — and then narrow at the boundary
- Errors thrown with actionable messages

---

## File Structure

The plan adds these directories under `src/newtab/`:

```
components/
├── shell/        TopBar, LeftRail, RightRail, Panel
├── panels/       TocPanel, TocNode, LibraryPanel
├── pdf/          PdfThumbnailStrip + hook
└── settings/     ByokSettings, ThemeBuilder, ThemeGrid

hooks/
├── useTheme.ts
├── useByok.ts
├── usePanelState.ts
└── useAppBootstrap.ts

lib/
├── http.ts                    auth-token + request<T>, extracted from api.ts
├── themes/
│   ├── types.ts
│   ├── presets.ts             15 ThemeDef[]
│   ├── storage.ts             load/save custom themes
│   └── apply.ts               applyTheme()
├── parsers/
│   ├── epub-toc-fallback.ts
│   ├── toc-quality.ts
│   └── toc-progress.ts
└── ai/
    ├── types.ts
    ├── prompts.ts             lifted from book-reader-api/src/services/{ai,translate}.ts
    ├── server.ts              uses lib/http.ts
    ├── anthropic.ts
    ├── openai.ts
    ├── google.ts
    ├── openrouter.ts
    ├── router.ts              getAiClient(bookHash)
    ├── byok-cache.ts          sync cache subscribed to storage.onChanged
    └── byok-helpers.ts        getConfiguredProvider

themes.css                     all :root[data-theme="..."] blocks
```

Modified existing files: `index.css`, `App.tsx`, `Reader.tsx`, `Settings.tsx`, `lib/storage.ts`, `lib/api.ts`, `hooks/useAI.ts`, `hooks/useBook.ts`, `lib/parsers/epub.ts`, `components/pdf/PdfViewer.tsx`, `public/manifest.json`. Deleted: `Library.tsx` (modal), `components/pdf/PdfThumbnails.tsx`.

---

## Phase 0 — Branch & Test Setup

### Task 0.1: Confirm branch
- [ ] Confirm on `feature/reader-epic-upgrade`. Run `git branch --show-current`. Expected: `feature/reader-epic-upgrade`.

### Task 0.2: Verify test infra works
- [ ] Run `npm test` in `book-reader-extension/`. Expected: existing tests pass.

### Task 0.3: Pre-create test directories used across phases
- [ ] `mkdir -p tests/themes tests/parsers tests/panels tests/shell tests/ai tests/byok tests/pdf tests/storage tests/components tests/hooks`. Idempotent — keeps later "Add file" steps free of mkdir noise.

---

## Phase 1 — Theme System (spec §1, commits 1-3)

### Task 1.1: Create theme type definitions

**Files:** Create `src/newtab/lib/themes/types.ts`.

- [ ] **Step 1: Write the file**

```ts
// src/newtab/lib/themes/types.ts

export type ThemeMode = "light" | "dark";
export type PdfTint = "normal" | "dark" | "sepia";

/**
 * Theme tokens map directly to CSS custom property names (without leading `--`).
 * Each key MUST be a valid CSS custom-property name (kebab-case where needed).
 * Themes override the *values* of existing tokens; names are never renamed
 * because Tailwind v4 utilities (bg-cream, text-clay-black, etc.) depend on them.
 */
export interface ThemeTokens {
  cream: string;
  black: string;
  white: string;
  oat: string;
  "oat-light": string;
  silver: string;
  charcoal: string;
  "dark-charcoal": string;
  "cool-border": string;
  "matcha-300": string;
  "matcha-600": string;
  "matcha-800": string;
  "slushie-500": string;
  "lemon-400": string;
  "lemon-500": string;
  "ube-300": string;
  "ube-800": string;
  "pomegranate-400": string;
  "blueberry-800": string;
  "light-frost": string;
  "shadow-clay": string;
  "shadow-hover": string;
  "shadow-hover-sm": string;
  "reader-prose-bg"?: string;
}

export interface BuiltInThemeDef {
  readonly id: string;
  readonly name: string;
  readonly mode: ThemeMode;
  readonly pdfTint: PdfTint;
  readonly isCustom: false;
}

export interface CustomThemeDef {
  readonly id: string;          // "custom-<uuid>"
  readonly name: string;
  readonly mode: ThemeMode;
  readonly pdfTint: PdfTint;
  readonly baseId: string;      // preset this was forked from
  readonly tokens: Partial<ThemeTokens>;
  readonly createdAt: number;
  readonly isCustom: true;
}

export type ThemeDef = BuiltInThemeDef | CustomThemeDef;
```

- [ ] **Step 2: Verify file compiles**

Run `npx tsc --noEmit -p tsconfig.json`. Expected: no errors.

### Task 1.2: Define preset registry (TDD)

**Files:** Create `tests/themes/presets.test.ts`, `src/newtab/lib/themes/presets.ts`.

- [ ] **Step 1: Write failing test**

```ts
// tests/themes/presets.test.ts
import { describe, it, expect } from "vitest";
import { THEME_PRESETS, getPresetById, isKnownPresetId } from "../../src/newtab/lib/themes/presets";

describe("theme presets", () => {
  it("registers exactly 15 presets", () => {
    expect(THEME_PRESETS).toHaveLength(15);
  });

  it("includes the canonical light and dark presets", () => {
    expect(isKnownPresetId("light")).toBe(true);
    expect(isKnownPresetId("dark")).toBe(true);
  });

  it("returns undefined for unknown preset ids", () => {
    expect(getPresetById("nonexistent")).toBeUndefined();
  });

  it("each preset id is unique", () => {
    const ids = THEME_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a non-empty human-readable name", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it("declares each preset as a built-in (not custom)", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.isCustom).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run `npx vitest run tests/themes/presets.test.ts`. Expected: import error (file doesn't exist).

- [ ] **Step 3: Implement presets registry**

```ts
// src/newtab/lib/themes/presets.ts
import type { BuiltInThemeDef } from "./types";

const preset = (
  id: string,
  name: string,
  mode: "light" | "dark",
  pdfTint: "normal" | "dark" | "sepia",
): BuiltInThemeDef => ({ id, name, mode, pdfTint, isCustom: false });

export const THEME_PRESETS: ReadonlyArray<BuiltInThemeDef> = [
  preset("light", "Light", "light", "normal"),
  preset("dark", "Dark", "dark", "dark"),
  preset("sepia", "Sepia", "light", "sepia"),
  preset("solarized-light", "Solarized Light", "light", "normal"),
  preset("solarized-dark", "Solarized Dark", "dark", "dark"),
  preset("nord", "Nord", "dark", "dark"),
  preset("gruvbox-light", "Gruvbox Light", "light", "sepia"),
  preset("gruvbox-dark", "Gruvbox Dark", "dark", "dark"),
  preset("dracula", "Dracula", "dark", "dark"),
  preset("tokyo-night", "Tokyo Night", "dark", "dark"),
  preset("paper", "Paper", "light", "normal"),
  preset("e-ink", "E-Ink", "light", "normal"),
  preset("rose-pine", "Rosé Pine", "dark", "dark"),
  preset("catppuccin-latte", "Catppuccin Latte", "light", "normal"),
  preset("catppuccin-mocha", "Catppuccin Mocha", "dark", "dark"),
] as const;

const PRESET_INDEX: ReadonlyMap<string, BuiltInThemeDef> = new Map(
  THEME_PRESETS.map((p) => [p.id, p]),
);

export function getPresetById(id: string): BuiltInThemeDef | undefined {
  return PRESET_INDEX.get(id);
}

export function isKnownPresetId(id: string): boolean {
  return PRESET_INDEX.has(id);
}
```

- [ ] **Step 4: Run test, expect pass**

Run `npx vitest run tests/themes/presets.test.ts`. Expected: 6 tests pass.

### Task 1.3: Custom theme storage (TDD)

**Files:** Create `tests/themes/storage.test.ts`, `src/newtab/lib/themes/storage.ts`.

- [ ] **Step 1: Write failing test**

```ts
// tests/themes/storage.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  CUSTOM_THEMES_STORAGE_KEY,
} from "../../src/newtab/lib/themes/storage";
import type { CustomThemeDef } from "../../src/newtab/lib/themes/types";

const makeChromeStorageStub = () => {
  const store: Record<string, unknown> = {};
  return {
    store,
    api: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (patch: Record<string, unknown>) => {
        Object.assign(store, patch);
      }),
    },
  };
};

beforeEach(() => {
  const { api } = makeChromeStorageStub();
  // @ts-expect-error stub
  globalThis.chrome = { storage: { local: api } };
});

const sampleCustomTheme: CustomThemeDef = {
  id: "custom-abc",
  name: "My Theme",
  mode: "dark",
  pdfTint: "dark",
  baseId: "dark",
  tokens: { cream: "#101010" },
  createdAt: 1_700_000_000_000,
  isCustom: true,
};

describe("custom theme storage", () => {
  it("returns an empty list when no themes are stored", async () => {
    expect(await loadCustomThemes()).toEqual([]);
  });

  it("persists a saved theme and returns it on next load", async () => {
    await saveCustomTheme(sampleCustomTheme);
    const themes = await loadCustomThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0]).toEqual(sampleCustomTheme);
  });

  it("replaces an existing theme when saving with the same id", async () => {
    await saveCustomTheme(sampleCustomTheme);
    await saveCustomTheme({ ...sampleCustomTheme, name: "Renamed" });
    const themes = await loadCustomThemes();
    expect(themes).toHaveLength(1);
    expect(themes[0].name).toBe("Renamed");
  });

  it("removes a theme by id", async () => {
    await saveCustomTheme(sampleCustomTheme);
    await deleteCustomTheme(sampleCustomTheme.id);
    expect(await loadCustomThemes()).toEqual([]);
  });

  it("uses the documented storage key", () => {
    expect(CUSTOM_THEMES_STORAGE_KEY).toBe("custom_themes");
  });
});
```

- [ ] **Step 2: Run test, expect import failure**

- [ ] **Step 3: Implement storage**

```ts
// src/newtab/lib/themes/storage.ts
import type { CustomThemeDef } from "./types";

export const CUSTOM_THEMES_STORAGE_KEY = "custom_themes";

async function readStoredThemes(): Promise<CustomThemeDef[]> {
  const raw = await chrome.storage.local.get(CUSTOM_THEMES_STORAGE_KEY);
  const stored = raw[CUSTOM_THEMES_STORAGE_KEY];
  if (!Array.isArray(stored)) return [];
  return stored as CustomThemeDef[];
}

async function writeStoredThemes(themes: CustomThemeDef[]): Promise<void> {
  await chrome.storage.local.set({ [CUSTOM_THEMES_STORAGE_KEY]: themes });
}

export async function loadCustomThemes(): Promise<CustomThemeDef[]> {
  return readStoredThemes();
}

export async function saveCustomTheme(theme: CustomThemeDef): Promise<void> {
  const existing = await readStoredThemes();
  const withoutDuplicate = existing.filter((t) => t.id !== theme.id);
  await writeStoredThemes([...withoutDuplicate, theme]);
}

export async function deleteCustomTheme(themeId: string): Promise<void> {
  const existing = await readStoredThemes();
  await writeStoredThemes(existing.filter((t) => t.id !== themeId));
}
```

- [ ] **Step 4: Run test, expect pass**

### Task 1.4: themes.css with 15 preset blocks

**Files:** Create `src/newtab/themes.css`.

The file holds one `:root[data-theme="<id>"]` block per preset. Specificity (0,1,1) beats `:root` (0,1,0), so order doesn't matter.

Use real palettes from each theme's official site. Below: light, dark, sepia, dracula full; the rest follow the same shape.

- [ ] **Step 1: Write themes.css**

```css
/* src/newtab/themes.css
   Each block overrides the values of existing tokens declared in :root.
   Token NAMES are never changed — Tailwind utilities (bg-cream, text-clay-black, etc.) depend on them.
   :root[data-theme="..."] specificity (0,1,1) > :root (0,1,0) — overrides win regardless of import order. */

/* ---------- Light (default; here for completeness; same values as :root) ---------- */
:root[data-theme="light"] {
  --cream: #faf9f7;
  --black: #000000;
  --white: #ffffff;
  --oat: #dad4c8;
  --oat-light: #eee9df;
  --silver: #9f9b93;
  --charcoal: #55534e;
  --light-frost: #eff1f3;
  --reader-prose-bg: transparent;
}

/* ---------- Dark (lifted from old .dark block — every old override comes with it) ---------- */
:root[data-theme="dark"] {
  --cream: #1a1815;
  --black: #f0ede8;
  --white: #242220;
  --oat: #3d3a35;
  --oat-light: #2e2b27;
  --silver: #7a766e;
  --charcoal: #a09c94;
  --dark-charcoal: #c0bdb7;
  --cool-border: #3d3a35;
  --light-frost: #2e2b27;
  --shadow-clay: rgba(0,0,0,0.25) 0px 1px 1px, rgba(255,255,255,0.03) 0px -1px 1px inset, rgba(0,0,0,0.15) 0px -0.5px 1px;
  --shadow-hover: rgba(0,0,0,0.5) -7px 7px;
  --shadow-hover-sm: rgba(0,0,0,0.3) -3px 3px;
  --reader-prose-bg: transparent;
}

/*
 * IMPORTANT: every other dark-mode preset (solarized-dark, nord, gruvbox-dark, dracula,
 * tokyo-night, rose-pine, catppuccin-mocha) MUST also re-declare --dark-charcoal,
 * --cool-border, and the --shadow-* tokens or its borders/shadows will inherit
 * the light :root defaults and look wrong on a dark page background.
 * The actual themes.css written to disk includes those overrides — the plan is summarized.
 */

/* ---------- Sepia ---------- */
:root[data-theme="sepia"] {
  --cream: #f4ecd8;
  --black: #5b4636;
  --white: #fbf3df;
  --oat: #d8c8a8;
  --oat-light: #ebe0c4;
  --silver: #9c8b73;
  --charcoal: #6c5840;
  --light-frost: #ebe0c4;
  --reader-prose-bg: #f4ecd8;
}

/* ---------- Solarized Light ---------- */
:root[data-theme="solarized-light"] {
  --cream: #fdf6e3;
  --black: #073642;
  --white: #eee8d5;
  --oat: #93a1a1;
  --oat-light: #eee8d5;
  --silver: #93a1a1;
  --charcoal: #586e75;
  --light-frost: #eee8d5;
}

/* ---------- Solarized Dark ---------- */
:root[data-theme="solarized-dark"] {
  --cream: #002b36;
  --black: #eee8d5;
  --white: #073642;
  --oat: #586e75;
  --oat-light: #073642;
  --silver: #657b83;
  --charcoal: #93a1a1;
  --light-frost: #073642;
}

/* ---------- Nord ---------- */
:root[data-theme="nord"] {
  --cream: #2e3440;
  --black: #eceff4;
  --white: #3b4252;
  --oat: #4c566a;
  --oat-light: #434c5e;
  --silver: #81a1c1;
  --charcoal: #d8dee9;
  --light-frost: #434c5e;
  --matcha-600: #88c0d0;
  --ube-800: #b48ead;
}

/* ---------- Gruvbox Light ---------- */
:root[data-theme="gruvbox-light"] {
  --cream: #fbf1c7;
  --black: #3c3836;
  --white: #f2e5bc;
  --oat: #d5c4a1;
  --oat-light: #ebdbb2;
  --silver: #928374;
  --charcoal: #504945;
  --light-frost: #ebdbb2;
}

/* ---------- Gruvbox Dark ---------- */
:root[data-theme="gruvbox-dark"] {
  --cream: #282828;
  --black: #ebdbb2;
  --white: #3c3836;
  --oat: #504945;
  --oat-light: #32302f;
  --silver: #928374;
  --charcoal: #d5c4a1;
  --light-frost: #32302f;
  --matcha-600: #b8bb26;
}

/* ---------- Dracula ---------- */
:root[data-theme="dracula"] {
  --cream: #282a36;
  --black: #f8f8f2;
  --white: #44475a;
  --oat: #6272a4;
  --oat-light: #44475a;
  --silver: #6272a4;
  --charcoal: #bd93f9;
  --light-frost: #44475a;
  --matcha-600: #50fa7b;
  --pomegranate-400: #ff5555;
  --ube-800: #bd93f9;
}

/* ---------- Tokyo Night ---------- */
:root[data-theme="tokyo-night"] {
  --cream: #1a1b26;
  --black: #c0caf5;
  --white: #24283b;
  --oat: #414868;
  --oat-light: #1f2335;
  --silver: #565f89;
  --charcoal: #a9b1d6;
  --light-frost: #1f2335;
  --matcha-600: #9ece6a;
}

/* ---------- Paper ---------- */
:root[data-theme="paper"] {
  --cream: #ffffff;
  --black: #222222;
  --white: #fafafa;
  --oat: #e5e5e5;
  --oat-light: #f5f5f5;
  --silver: #999999;
  --charcoal: #555555;
  --light-frost: #f5f5f5;
}

/* ---------- E-Ink ---------- */
:root[data-theme="e-ink"] {
  --cream: #f5f5f0;
  --black: #1a1a1a;
  --white: #ffffff;
  --oat: #d0d0d0;
  --oat-light: #e8e8e8;
  --silver: #888888;
  --charcoal: #404040;
  --light-frost: #e8e8e8;
  --matcha-600: #404040; /* grayscale */
  --ube-800: #404040;
}

/* ---------- Rosé Pine ---------- */
:root[data-theme="rose-pine"] {
  --cream: #191724;
  --black: #e0def4;
  --white: #1f1d2e;
  --oat: #403d52;
  --oat-light: #26233a;
  --silver: #6e6a86;
  --charcoal: #908caa;
  --light-frost: #26233a;
  --matcha-600: #9ccfd8;
  --ube-800: #c4a7e7;
}

/* ---------- Catppuccin Latte ---------- */
:root[data-theme="catppuccin-latte"] {
  --cream: #eff1f5;
  --black: #4c4f69;
  --white: #e6e9ef;
  --oat: #bcc0cc;
  --oat-light: #ccd0da;
  --silver: #6c6f85;
  --charcoal: #5c5f77;
  --light-frost: #ccd0da;
}

/* ---------- Catppuccin Mocha ---------- */
:root[data-theme="catppuccin-mocha"] {
  --cream: #1e1e2e;
  --black: #cdd6f4;
  --white: #313244;
  --oat: #45475a;
  --oat-light: #181825;
  --silver: #6c7086;
  --charcoal: #a6adc8;
  --light-frost: #181825;
  --matcha-600: #a6e3a1;
}
```

- [ ] **Step 2: Verify the file is well-formed CSS**

Run `npx vite build` (or just typecheck — CSS is bundled untouched). Expected: no errors.

### Task 1.5: Update index.css — strip `.dark` colors, import themes.css

**Files:** Modify `src/newtab/index.css`.

- [ ] **Step 1: Edit index.css**

Replace the existing `.dark { ... }` block (which currently declares color vars) and add an `@import "./themes.css"` line:

```css
/* near the top, after @import url(... fonts ...) and @import "tailwindcss"; */
@import "./themes.css";

/* ... existing :root { ... } block stays as-is ... */

/* Replace the entire existing .dark { ... } block with this empty marker.
   Color overrides for dark mode are now in :root[data-theme="dark"] in themes.css. */
.dark {
  /* Tailwind dark: variant marker only — no color declarations.
     :root[data-theme="dark"] in themes.css owns dark-mode token values. */
}

/* Add the new tokens that themes can declare */
:root {
  --reader-prose-bg: transparent;
  --pdf-tint: normal;
}
```

(Be careful: `@import` rules must come after `@import url(...)` font import but can be either before or after Tailwind's import — placing it after Tailwind keeps cascade predictable.)

- [ ] **Step 2: Run a smoke test**

```bash
npx vite build
```

Expected: build completes; output references `themes.css` content inlined.

### Task 1.6: applyTheme implementation (TDD)

**Files:** Create `tests/themes/apply.test.ts`, `src/newtab/lib/themes/apply.ts`.

- [ ] **Step 1: Write failing test**

```ts
// tests/themes/apply.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "../../src/newtab/lib/themes/apply";
import { THEME_PRESETS } from "../../src/newtab/lib/themes/presets";
import type { CustomThemeDef } from "../../src/newtab/lib/themes/types";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
});

describe("applyTheme", () => {
  it("sets data-theme attribute for a preset", () => {
    applyTheme("dark", []);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggles the dark class for dark-mode presets", () => {
    applyTheme("dracula", []);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class for light-mode presets", () => {
    document.documentElement.classList.add("dark");
    applyTheme("sepia", []);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back to the light preset for an unknown id", () => {
    applyTheme("not-a-real-theme", []);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies inline custom-theme tokens via setProperty", () => {
    const custom: CustomThemeDef = {
      id: "custom-1",
      name: "Test",
      mode: "dark",
      pdfTint: "dark",
      baseId: "dark",
      tokens: { cream: "#abcdef", "matcha-600": "#123456" },
      createdAt: 0,
      isCustom: true,
    };
    applyTheme(custom.id, [custom]);
    const html = document.documentElement;
    expect(html.getAttribute("data-theme")).toBe("dark"); // base
    expect(html.style.getPropertyValue("--cream")).toBe("#abcdef");
    expect(html.style.getPropertyValue("--matcha-600")).toBe("#123456");
  });

  it("clears prior inline tokens when switching from custom to preset", () => {
    const custom: CustomThemeDef = {
      id: "custom-1",
      name: "T",
      mode: "dark",
      pdfTint: "dark",
      baseId: "dark",
      tokens: { cream: "#abcdef" },
      createdAt: 0,
      isCustom: true,
    };
    applyTheme(custom.id, [custom]);
    applyTheme("light", [custom]);
    expect(document.documentElement.style.getPropertyValue("--cream")).toBe("");
  });

  it("sets --pdf-tint inline so PDF viewer can read it", () => {
    applyTheme("sepia", []);
    expect(document.documentElement.style.getPropertyValue("--pdf-tint").trim()).toBe("sepia");
  });

  it("registers all 15 presets without throwing", () => {
    for (const preset of THEME_PRESETS) {
      expect(() => applyTheme(preset.id, [])).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run test, expect import failure**

- [ ] **Step 3: Implement applyTheme**

```ts
// src/newtab/lib/themes/apply.ts
import { getPresetById, isKnownPresetId } from "./presets";
import type { CustomThemeDef, ThemeDef, ThemeTokens, PdfTint } from "./types";

const FALLBACK_PRESET_ID = "light";

const APPLIED_INLINE_TOKEN_KEYS_ATTR = "data-applied-inline-tokens";

function findThemeById(themeId: string, customThemes: ReadonlyArray<CustomThemeDef>): ThemeDef | undefined {
  if (isKnownPresetId(themeId)) return getPresetById(themeId);
  return customThemes.find((theme) => theme.id === themeId);
}

function clearPreviouslyAppliedInlineTokens(html: HTMLElement): void {
  const previous = html.getAttribute(APPLIED_INLINE_TOKEN_KEYS_ATTR);
  if (!previous) return;
  for (const key of previous.split(",").filter(Boolean)) {
    html.style.removeProperty(`--${key}`);
  }
  html.removeAttribute(APPLIED_INLINE_TOKEN_KEYS_ATTR);
}

function applyInlineTokens(html: HTMLElement, tokens: Partial<ThemeTokens>): void {
  const appliedKeys: string[] = [];
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== "string") continue;
    html.style.setProperty(`--${key}`, value);
    appliedKeys.push(key);
  }
  if (appliedKeys.length > 0) {
    html.setAttribute(APPLIED_INLINE_TOKEN_KEYS_ATTR, appliedKeys.join(","));
  }
}

function applyDataThemeAttribute(html: HTMLElement, dataThemeValue: string): void {
  html.setAttribute("data-theme", dataThemeValue);
}

function applyDarkClass(html: HTMLElement, mode: "light" | "dark"): void {
  html.classList.toggle("dark", mode === "dark");
}

function applyPdfTint(html: HTMLElement, tint: PdfTint): void {
  html.style.setProperty("--pdf-tint", tint);
}

/**
 * Activates a theme by id. Side-effects on document.documentElement only.
 *
 * @param themeId  Either a built-in preset id or a custom theme id.
 * @param customThemes  All currently-saved custom themes (so the function is pure with respect to storage).
 */
export function applyTheme(themeId: string, customThemes: ReadonlyArray<CustomThemeDef>): void {
  const html = document.documentElement;
  const theme = findThemeById(themeId, customThemes) ?? getPresetById(FALLBACK_PRESET_ID)!;

  clearPreviouslyAppliedInlineTokens(html);

  if (theme.isCustom) {
    applyDataThemeAttribute(html, theme.baseId);
    applyInlineTokens(html, theme.tokens);
  } else {
    applyDataThemeAttribute(html, theme.id);
  }

  applyDarkClass(html, theme.mode);
  applyPdfTint(html, theme.pdfTint);
}
```

- [ ] **Step 4: Run test, expect pass**

### Task 1.7: Cascade specificity test

**Files:** Create `tests/themes/cascade.test.ts`.

This test loads `themes.css` into jsdom and asserts that `applyTheme("dracula")` actually changes the computed `--cream` value. Catches future regressions where someone adds a later `:root` rule that stomps the theme.

- [ ] **Step 1: Write test**

```ts
// tests/themes/cascade.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyTheme } from "../../src/newtab/lib/themes/apply";

// NOTE: package.json declares "type": "module", so __dirname is undefined under
// Vitest's ESM runner. Resolve from process.cwd() (which Vitest sets to the
// package root — the directory containing vitest.config.ts).
const PROJECT_ROOT = process.cwd();
const THEMES_CSS_PATH = resolve(PROJECT_ROOT, "src/newtab/themes.css");

beforeAll(() => {
  const baseCss = `
    :root {
      --cream: #faf9f7;
      --black: #000000;
    }
    .dark { /* empty marker */ }
  `;
  const themesCss = readFileSync(THEMES_CSS_PATH, "utf8");
  const style = document.createElement("style");
  style.textContent = baseCss + "\n" + themesCss;
  document.head.appendChild(style);
});

const computedCream = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue("--cream").trim();

describe("theme cascade", () => {
  it("uses the light :root default when no theme is active", () => {
    document.documentElement.removeAttribute("data-theme");
    expect(computedCream()).toBe("#faf9f7");
  });

  it("dracula overrides --cream regardless of cascade order", () => {
    applyTheme("dracula", []);
    expect(computedCream()).toBe("#282a36");
  });

  it("nord overrides --cream", () => {
    applyTheme("nord", []);
    expect(computedCream()).toBe("#2e3440");
  });

  it("returns to the light default when light is reapplied", () => {
    applyTheme("dracula", []);
    applyTheme("light", []);
    expect(computedCream()).toBe("#faf9f7");
  });
});
```

- [ ] **Step 2: Run test, expect pass**

If `getComputedStyle` doesn't pick up the `:root[data-theme]` selector under jsdom, switch the assertion to read `style.cssRules` and verify the rule exists, OR mark the test `it.skipIf(!features)` with a comment. (jsdom 25 supports `:root[data-theme]` matching.)

### Task 1.8: Add settings shape + migrators (TDD)

**Files:** Modify `src/newtab/lib/storage.ts`. Create `tests/storage/settings-migration.test.ts`.

- [ ] **Step 1: Write failing migration test**

```ts
// tests/storage/settings-migration.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "../../src/newtab/lib/storage";

const stubChromeStorage = (initial: Record<string, unknown>) => {
  const store: Record<string, unknown> = { ...initial };
  // @ts-expect-error
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (patch: Record<string, unknown>) => {
          Object.assign(store, patch);
        }),
      },
    },
  };
  return store;
};

describe("settings migration", () => {
  it("migrates legacy `theme: 'dark'` to `themeId: 'dark'`", async () => {
    stubChromeStorage({
      [SETTINGS_STORAGE_KEY]: { theme: "dark", fontSize: 18, lineHeight: 1.8 },
    });
    const settings = await getSettings();
    expect(settings.themeId).toBe("dark");
    expect("theme" in settings).toBe(false);
  });

  it("migrates legacy `theme: 'light'` to `themeId: 'light'`", async () => {
    stubChromeStorage({
      [SETTINGS_STORAGE_KEY]: { theme: "light" },
    });
    expect((await getSettings()).themeId).toBe("light");
  });

  it("migrates pdfColorMode === 'normal' to pdfTintOverride === null", async () => {
    stubChromeStorage({
      [SETTINGS_STORAGE_KEY]: { pdfColorMode: "normal" },
    });
    const settings = await getSettings();
    expect(settings.pdfTintOverride).toBeNull();
  });

  it("migrates pdfColorMode !== 'normal' to a matching pdfTintOverride", async () => {
    stubChromeStorage({
      [SETTINGS_STORAGE_KEY]: { pdfColorMode: "sepia" },
    });
    expect((await getSettings()).pdfTintOverride).toBe("sepia");
  });

  it("drops the deprecated pinToolbar field", async () => {
    stubChromeStorage({
      [SETTINGS_STORAGE_KEY]: { pinToolbar: true },
    });
    const settings = await getSettings();
    expect("pinToolbar" in settings).toBe(false);
  });

  it("drops the deprecated pdfShowThumbnails field and adds pdfShowThumbnailStrip default", async () => {
    stubChromeStorage({
      [SETTINGS_STORAGE_KEY]: { pdfShowThumbnails: true },
    });
    const settings = await getSettings();
    expect("pdfShowThumbnails" in settings).toBe(false);
    expect(settings.pdfShowThumbnailStrip).toBe(true);
  });

  it("returns DEFAULT_SETTINGS when storage is empty", async () => {
    stubChromeStorage({});
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

- [ ] **Step 3: Update storage.ts**

Open `src/newtab/lib/storage.ts`. Replace the `ReaderSettings` interface, `DEFAULT_SETTINGS`, and `getSettings` block. Keep `saveSettings` API. Export `SETTINGS_STORAGE_KEY` for tests.

```ts
// inside src/newtab/lib/storage.ts — replace settings region

export type PdfViewMode = "single" | "continuous" | "spread";
export type PdfTint = "normal" | "dark" | "sepia";

export interface ReaderSettings {
  themeId: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  translateTo: string;
  showLeftRail: boolean;
  showRightRail: boolean;
  pdfViewMode: PdfViewMode;
  pdfTintOverride: PdfTint | null;
  pdfShowThumbnailStrip: boolean;
  pdfShowViewMode: boolean;
  pdfShowPageNav: boolean;
  pdfShowColorMode: boolean;
  pdfShowZoom: boolean;
}

export const SETTINGS_STORAGE_KEY = "reader_settings";

export const DEFAULT_SETTINGS: ReaderSettings = {
  themeId: "light",
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: "'DM Sans', Arial, sans-serif",
  translateTo: "en",
  showLeftRail: true,
  showRightRail: true,
  pdfViewMode: "continuous",
  pdfTintOverride: null,
  pdfShowThumbnailStrip: true,
  pdfShowViewMode: true,
  pdfShowPageNav: true,
  pdfShowColorMode: true,
  pdfShowZoom: true,
};

interface LegacySettings {
  theme?: "light" | "dark";
  pinToolbar?: boolean;
  pdfColorMode?: "normal" | "dark" | "sepia";
  pdfShowThumbnails?: boolean;
}

function migrateLegacy(stored: Partial<ReaderSettings> & LegacySettings): Partial<ReaderSettings> {
  const migrated: Partial<ReaderSettings> = { ...stored };

  if (typeof stored.theme === "string" && !("themeId" in stored)) {
    migrated.themeId = stored.theme;
  }
  delete (migrated as LegacySettings).theme;

  if ("pinToolbar" in migrated) {
    delete (migrated as LegacySettings).pinToolbar;
  }

  if ("pdfColorMode" in stored) {
    migrated.pdfTintOverride = stored.pdfColorMode === "normal" ? null : stored.pdfColorMode!;
    delete (migrated as LegacySettings).pdfColorMode;
  }

  if ("pdfShowThumbnails" in migrated) {
    delete (migrated as LegacySettings).pdfShowThumbnails;
    if (!("pdfShowThumbnailStrip" in migrated)) {
      migrated.pdfShowThumbnailStrip = true;
    }
  }

  return migrated;
}

export async function saveSettings(settings: ReaderSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
}

function hasLegacyFields(stored: Partial<ReaderSettings> & LegacySettings): boolean {
  return (
    "theme" in stored ||
    "pinToolbar" in stored ||
    "pdfColorMode" in stored ||
    "pdfShowThumbnails" in stored
  );
}

export async function getSettings(): Promise<ReaderSettings> {
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  const stored = result[SETTINGS_STORAGE_KEY] as (Partial<ReaderSettings> & LegacySettings) | undefined;
  if (!stored) return DEFAULT_SETTINGS;

  const merged: ReaderSettings = { ...DEFAULT_SETTINGS, ...migrateLegacy(stored) };

  // Persist the migrated shape back to storage so legacy fields are physically removed.
  // Without this, every getSettings call re-cleans the same legacy keys forever, and any
  // direct chrome.storage.local read (e.g. background script, devtools, debugging session)
  // still sees the old fields. Fire-and-forget — caller doesn't need to await.
  if (hasLegacyFields(stored)) {
    void saveSettings(merged);
  }

  return merged;
}
```

- [ ] **Step 4: Run test, expect pass**

### Task 1.9: useTheme hook

**Files:** Create `src/newtab/hooks/useTheme.ts`.

```ts
// src/newtab/hooks/useTheme.ts
import { useCallback, useEffect, useState } from "react";
import { applyTheme } from "../lib/themes/apply";
import { THEME_PRESETS, getPresetById, isKnownPresetId } from "../lib/themes/presets";
import {
  loadCustomThemes,
  saveCustomTheme as persistCustomTheme,
  deleteCustomTheme as removeCustomTheme,
} from "../lib/themes/storage";
import type { BuiltInThemeDef, CustomThemeDef, ThemeDef } from "../lib/themes/types";

export interface UseThemeResult {
  activeThemeId: string;
  presets: ReadonlyArray<BuiltInThemeDef>;
  customThemes: ReadonlyArray<CustomThemeDef>;
  setThemeId: (id: string) => void;
  saveCustomTheme: (theme: CustomThemeDef) => Promise<void>;
  deleteCustomTheme: (id: string) => Promise<void>;
  resolveTheme: (id: string) => ThemeDef | undefined;
}

export function useTheme(initialThemeId: string): UseThemeResult {
  const [activeThemeId, setActiveThemeId] = useState(initialThemeId);
  const [customThemes, setCustomThemes] = useState<CustomThemeDef[]>([]);

  useEffect(() => {
    loadCustomThemes().then(setCustomThemes);
  }, []);

  useEffect(() => {
    applyTheme(activeThemeId, customThemes);
  }, [activeThemeId, customThemes]);

  const resolveTheme = useCallback(
    (id: string): ThemeDef | undefined => {
      if (isKnownPresetId(id)) return getPresetById(id);
      return customThemes.find((theme) => theme.id === id);
    },
    [customThemes],
  );

  const setThemeId = useCallback((id: string) => setActiveThemeId(id), []);

  const saveCustomTheme = useCallback(async (theme: CustomThemeDef) => {
    await persistCustomTheme(theme);
    setCustomThemes(await loadCustomThemes());
  }, []);

  const deleteCustomTheme = useCallback(async (id: string) => {
    await removeCustomTheme(id);
    setCustomThemes(await loadCustomThemes());
  }, []);

  return {
    activeThemeId,
    presets: THEME_PRESETS,
    customThemes,
    setThemeId,
    saveCustomTheme,
    deleteCustomTheme,
    resolveTheme,
  };
}
```

### Task 1.10: ThemeBuilder component

**Files:** Create `src/newtab/components/settings/ThemeBuilder.tsx`.

The builder is opened from the Themes settings tab. Props: base preset, existing custom theme (if editing), onSave, onCancel.

Provide one `<input type="color">` per editable token, a name field, a base preset selector, mode toggle, pdf tint segmented control, and a live preview pane.

- [ ] **Step 1: Implement component**

```tsx
// src/newtab/components/settings/ThemeBuilder.tsx
import React, { useMemo, useState } from "react";
import type {
  BuiltInThemeDef,
  CustomThemeDef,
  PdfTint,
  ThemeMode,
  ThemeTokens,
} from "../../lib/themes/types";
import { THEME_PRESETS, getPresetById } from "../../lib/themes/presets";

interface ThemeBuilderProps {
  initialBaseId?: string;
  existing?: CustomThemeDef;
  presets: ReadonlyArray<BuiltInThemeDef>;
  onSave: (theme: CustomThemeDef) => Promise<void> | void;
  onCancel: () => void;
}

const EDITABLE_TOKEN_KEYS: ReadonlyArray<keyof ThemeTokens> = [
  "cream",
  "black",
  "white",
  "oat",
  "silver",
  "charcoal",
  "matcha-600",
  "ube-800",
  "pomegranate-400",
];

// Must include EVERY key in ThemeTokens — Record<keyof ThemeTokens, ...> is exhaustive.
const TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
  cream: "Page background",
  black: "Body text",
  white: "Surface",
  oat: "Border",
  "oat-light": "Nested surface",
  silver: "Muted text",
  charcoal: "Strong text",
  "dark-charcoal": "Strong text (hover)",
  "cool-border": "Cool border",
  "matcha-300": "Accent (soft)",
  "matcha-600": "Accent (primary)",
  "matcha-800": "Accent (deep)",
  "slushie-500": "Info",
  "lemon-400": "Warn (soft)",
  "lemon-500": "Warn",
  "ube-300": "Highlight (purple soft)",
  "ube-800": "Highlight (purple)",
  "pomegranate-400": "Danger",
  "blueberry-800": "Highlight (blue)",
  "light-frost": "Frost",
  "shadow-clay": "Card shadow",
  "shadow-hover": "Hover shadow",
  "shadow-hover-sm": "Hover shadow (small)",
  "reader-prose-bg": "Reader column bg",
};

const PDF_TINT_OPTIONS: ReadonlyArray<PdfTint> = ["normal", "dark", "sepia"];

const generateCustomThemeId = (): string =>
  `custom-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

export default function ThemeBuilder({
  initialBaseId = "light",
  existing,
  presets,
  onSave,
  onCancel,
}: ThemeBuilderProps) {
  const [name, setName] = useState(existing?.name ?? "My Theme");
  const [baseId, setBaseId] = useState(existing?.baseId ?? initialBaseId);
  const [mode, setMode] = useState<ThemeMode>(existing?.mode ?? getPresetById(initialBaseId)?.mode ?? "light");
  const [pdfTint, setPdfTint] = useState<PdfTint>(existing?.pdfTint ?? "normal");
  const [tokens, setTokens] = useState<Partial<ThemeTokens>>(existing?.tokens ?? {});

  const previewStyle = useMemo<React.CSSProperties>(
    () =>
      Object.fromEntries(
        Object.entries(tokens).map(([key, value]) => [`--${key}`, value as string]),
      ) as React.CSSProperties,
    [tokens],
  );

  const handleTokenChange = (key: keyof ThemeTokens, value: string) =>
    setTokens((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    const theme: CustomThemeDef = {
      id: existing?.id ?? generateCustomThemeId(),
      name: name.trim() || "Untitled Theme",
      mode,
      pdfTint,
      baseId,
      tokens,
      createdAt: existing?.createdAt ?? Date.now(),
      isCustom: true,
    };
    await onSave(theme);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="clay-label mb-1 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white text-clay-black"
        />
      </div>

      <div>
        <label className="clay-label mb-1 block">Base preset</label>
        <select
          value={baseId}
          onChange={(e) => setBaseId(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-[8px] border border-oat bg-clay-white text-clay-black"
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        {(["light", "dark"] as ThemeMode[]).map((candidateMode) => (
          <button
            key={candidateMode}
            onClick={() => setMode(candidateMode)}
            className={`flex-1 py-2 rounded-[8px] border ${
              mode === candidateMode ? "border-clay-black clay-shadow" : "border-oat"
            }`}
          >
            {candidateMode}
          </button>
        ))}
      </div>

      <div>
        <label className="clay-label mb-1 block">PDF tint</label>
        <div className="flex gap-2">
          {PDF_TINT_OPTIONS.map((tintOption) => (
            <button
              key={tintOption}
              onClick={() => setPdfTint(tintOption)}
              className={`flex-1 py-2 text-xs rounded-[8px] border ${
                pdfTint === tintOption ? "border-clay-black clay-shadow" : "border-oat"
              }`}
            >
              {tintOption}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="clay-label">Colors</label>
        {EDITABLE_TOKEN_KEYS.map((tokenKey) => (
          <div key={tokenKey} className="flex items-center justify-between gap-3">
            <span className="text-sm">{TOKEN_LABELS[tokenKey]}</span>
            <input
              type="color"
              value={(tokens[tokenKey] as string) ?? "#000000"}
              onChange={(e) => handleTokenChange(tokenKey, e.target.value)}
              className="w-10 h-8 rounded border border-oat"
            />
          </div>
        ))}
      </div>

      <div
        className="clay-card p-4 !rounded-[12px]"
        style={previewStyle}
      >
        <p className="clay-label mb-1">Preview</p>
        <p className="text-sm">The quick brown fox jumps over the lazy dog.</p>
        <button className="clay-btn-solid text-xs mt-2">Sample button</button>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="clay-btn-white text-sm">Cancel</button>
        <button onClick={handleSubmit} className="clay-btn-solid text-sm">Save theme</button>
      </div>
    </div>
  );
}
```

### Task 1.11: ThemeGrid component

**Files:** Create `src/newtab/components/settings/ThemeGrid.tsx`.

```tsx
// src/newtab/components/settings/ThemeGrid.tsx
import React from "react";
import type { BuiltInThemeDef, CustomThemeDef } from "../../lib/themes/types";

interface ThemeGridProps {
  presets: ReadonlyArray<BuiltInThemeDef>;
  customThemes: ReadonlyArray<CustomThemeDef>;
  activeThemeId: string;
  onSelect: (id: string) => void;
  onCreateCustom: () => void;
  onEditCustom: (theme: CustomThemeDef) => void;
  onDeleteCustom: (id: string) => void;
}

export default function ThemeGrid({
  presets,
  customThemes,
  activeThemeId,
  onSelect,
  onCreateCustom,
  onEditCustom,
  onDeleteCustom,
}: ThemeGridProps) {
  return (
    <div className="space-y-5">
      <section>
        <p className="clay-label mb-2">Presets</p>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              data-theme={preset.id}
              className={`flex flex-col items-start gap-1 p-3 rounded-[12px] border bg-cream text-clay-black ${
                activeThemeId === preset.id ? "border-clay-black clay-shadow" : "border-oat"
              }`}
            >
              <span className="text-sm font-medium">{preset.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-silver">{preset.mode}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="clay-label">Custom themes</p>
          <button onClick={onCreateCustom} className="clay-btn-white text-xs">+ New</button>
        </div>
        {customThemes.length === 0 ? (
          <p className="text-xs text-silver">No custom themes yet — click “New” to create one.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {customThemes.map((customTheme) => (
              <div
                key={customTheme.id}
                className={`flex items-center justify-between gap-2 p-3 rounded-[12px] border ${
                  activeThemeId === customTheme.id ? "border-clay-black clay-shadow" : "border-oat"
                }`}
              >
                <button onClick={() => onSelect(customTheme.id)} className="flex-1 text-left text-sm font-medium truncate">
                  {customTheme.name}
                </button>
                <div className="flex gap-1">
                  <button onClick={() => onEditCustom(customTheme)} className="text-xs text-silver hover:text-clay-black">Edit</button>
                  <button onClick={() => onDeleteCustom(customTheme.id)} className="text-xs text-pomegranate-400">Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

### Task 1.12: Wire Themes tab into Settings

**Files:** Modify `src/newtab/components/Settings.tsx`.

**IMPORTANT:** Settings.tsx currently references the legacy fields (`settings.theme`, `settings.pinToolbar`, `settings.pdfColorMode`, `settings.pdfShowThumbnails`) that Task 1.8 removes from `ReaderSettings`. Until those references are updated, the project will not type-check. **All four field rename/remove/replace edits below MUST land in this same task as Task 1.8** (or in a same-commit pair) so the build never breaks mid-phase.

- [ ] **Step 1: Add a "themes" section to `SECTIONS`** — add it as the first entry (before "appearance"). Reuse a paint-bucket SVG icon (use any inline SVG matching `clay` style — example below).
- [ ] **Step 2: Remove the existing "Theme" block from the Appearance tab.** Themes are owned by the new Themes tab.
- [ ] **Step 3: Replace `settings.pinToolbar` references** (the "Pin Toolbar" toggle row in the Reader tab) — delete that toggle entirely. Behaviour replacement (always-visible thin strip) lands in Phase 3 (TopBar).
- [ ] **Step 4: Replace `settings.pdfColorMode` references** with `settings.pdfTintOverride`. The PDF tab "Page Colors" segmented control sets `pdfTintOverride` when "Override theme PDF tint" is on, else null. Add the override toggle row above the segmented control.
- [ ] **Step 5: Replace `settings.pdfShowThumbnails`** with `settings.pdfShowThumbnailStrip` (rename label too, "Thumbnail Strip"). The full bottom-strip implementation lands in Phase 4; in Phase 1 the toggle just persists the new field.
- [ ] **Step 6: Inside the new themes content branch, render `<ThemeGrid>` and conditionally `<ThemeBuilder>` modal-style.**
- [ ] **Step 7: Pass through props from a new `Settings` prop: `theme: UseThemeResult`** so the parent (App) owns theme state.

**Appearance tab survives Phase 1.** Per spec §9.1 the final tab list drops Appearance entirely (font/size/line-height move to inline TopBar controls). That removal lands in **Phase 3 Task 3.4** (TopBar) once the inline controls exist. Until then, font/size/line-height stay in the Appearance tab — deleting it in Phase 1 would orphan those settings with no UI to drive them.

```tsx
// example wiring inside Settings.tsx (sketch — keep existing structure intact)
import ThemeGrid from "./settings/ThemeGrid";
import ThemeBuilder from "./settings/ThemeBuilder";
import type { UseThemeResult } from "../hooks/useTheme";
import type { CustomThemeDef } from "../lib/themes/types";

interface SettingsProps {
  // ...existing
  theme: UseThemeResult;
}

// in component body
const [editingCustom, setEditingCustom] = useState<CustomThemeDef | null>(null);
const [showBuilder, setShowBuilder] = useState(false);

// in the active section switch:
// activeSection === "themes" branch:
{activeSection === "themes" && (
  <div className="space-y-4">
    <ThemeGrid
      presets={theme.presets}
      customThemes={theme.customThemes}
      activeThemeId={theme.activeThemeId}
      onSelect={theme.setThemeId}
      onCreateCustom={() => { setEditingCustom(null); setShowBuilder(true); }}
      onEditCustom={(t) => { setEditingCustom(t); setShowBuilder(true); }}
      onDeleteCustom={theme.deleteCustomTheme}
    />
    {showBuilder && (
      <ThemeBuilder
        initialBaseId={editingCustom?.baseId ?? theme.activeThemeId}
        existing={editingCustom ?? undefined}
        presets={theme.presets}
        onSave={async (built) => {
          await theme.saveCustomTheme(built);
          theme.setThemeId(built.id);
          setShowBuilder(false);
        }}
        onCancel={() => setShowBuilder(false)}
      />
    )}
  </div>
)}
```

### Task 1.13: Wire useTheme into App.tsx (with hydration guard)

**Files:** Modify `src/newtab/App.tsx`.

- [ ] **Step 1: Replace the existing `document.documentElement.classList.toggle("dark", ...)` effect with `useTheme`** initialized from `settings.themeId`.
- [ ] **Step 2: Pass `theme` to `<Settings>`.**
- [ ] **Step 3: Hydration guard.** App starts with `DEFAULT_SETTINGS` (themeId="light") then `getSettings()` resolves async. Without a guard, the persist effect below fires once on mount with `theme.activeThemeId === "light"` and overwrites the just-loaded persisted setting. Use a ref:

```ts
import { useRef } from "react";

const theme = useTheme(settings.themeId);
const settingsHydratedRef = useRef(false);

// Loader: when persisted settings arrive, push the loaded themeId into useTheme
// before flagging hydration complete. This guarantees the persist effect below
// only ever runs in response to USER changes, not the initial load.
useEffect(() => {
  getSettings().then((loaded) => {
    setSettings(loaded);
    theme.setThemeId(loaded.themeId);
    settingsHydratedRef.current = true;
  });
  // theme.setThemeId is referentially stable (useCallback no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// Persister: only fires after hydration AND only when the user has changed the theme.
useEffect(() => {
  if (!settingsHydratedRef.current) return;
  if (settings.themeId === theme.activeThemeId) return;
  const next = { ...settings, themeId: theme.activeThemeId };
  setSettings(next);
  saveSettings(next);
}, [theme.activeThemeId, settings]);
```

### Task 1.13b: PDF tint inheritance hook (close spec §1.6 loop in Phase 1)

**Files:** Create `src/newtab/hooks/useActiveThemePdfTint.ts`. Modify `src/newtab/components/pdf/PdfViewer.tsx`. Test: `tests/hooks/useActiveThemePdfTint.test.tsx`.

Spec §1.6 says `effectiveTint = settings.pdfTintOverride ?? activeTheme.pdfTint`. After Tasks 1.6 + 1.13, the `--pdf-tint` CSS variable is correctly written by `applyTheme`, but `PdfViewer` still reads `settings.pdfTintOverride ?? "normal"` — when override is null it ignores the active theme's tint. Close the loop here so dark/sepia presets actually tint PDFs.

- [ ] **Step 1: Hook implementation**

```ts
// src/newtab/hooks/useActiveThemePdfTint.ts
import { useEffect, useState } from "react";
import type { PdfTint } from "../lib/themes/types";

const PDF_TINT_CSS_VAR = "--pdf-tint";
const VALID_PDF_TINTS: ReadonlySet<PdfTint> = new Set<PdfTint>(["normal", "dark", "sepia"]);
const DATA_THEME_ATTR = "data-theme";
const FALLBACK_TINT: PdfTint = "normal";

function readPdfTintFromActiveTheme(): PdfTint {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(PDF_TINT_CSS_VAR).trim();
  return VALID_PDF_TINTS.has(raw as PdfTint) ? (raw as PdfTint) : FALLBACK_TINT;
}

export function useActiveThemePdfTint(): PdfTint {
  const [tint, setTint] = useState<PdfTint>(() => readPdfTintFromActiveTheme());
  useEffect(() => {
    const html = document.documentElement;
    const updateFromCurrentStyle = () => setTint(readPdfTintFromActiveTheme());
    updateFromCurrentStyle();
    const observer = new MutationObserver(updateFromCurrentStyle);
    observer.observe(html, { attributes: true, attributeFilter: [DATA_THEME_ATTR, "style", "class"] });
    return () => observer.disconnect();
  }, []);
  return tint;
}
```

- [ ] **Step 2: PdfViewer rewires color mode and routes settings updates through App**

Removing the local `colorMode` state means PdfViewer's color mode now comes purely from the `settings` prop. The prop is held by App, which means the toolbar's color buttons MUST go through App's setter for React to re-render. Calling `saveSettings(...)` directly only writes to chrome.storage; App's React state never updates, so the new value won't be reflected until something else triggers a settings reload.

Two coordinated changes:

```tsx
// PdfViewer.tsx
import { useActiveThemePdfTint } from "../../hooks/useActiveThemePdfTint";

interface PdfViewerProps {
  // ...existing
  settings: ReaderSettings;
  onSettingsChange: (next: ReaderSettings) => void;   // NEW — callback into App's handleSettingsChange
  // ...existing
}

// inside PdfViewer
const activeThemePdfTint = useActiveThemePdfTint();
const colorMode: PdfColorMode = settings.pdfTintOverride ?? activeThemePdfTint;

// View mode and thumbnail visibility also become derived from props (no local state)
// so the toolbar can't drift out of sync with App.
const viewMode: PdfViewMode = settings.pdfViewMode ?? "continuous";
const showThumbnails = settings.pdfShowThumbnailStrip ?? false;

const handleColorModeChange = useCallback((mode: PdfColorMode) => {
  // Per spec §1.6 the in-PDF toolbar persists an EXPLICIT override, including "normal".
  // The Settings → PDF tab "Override theme PDF tint" toggle owns the null state.
  // Collapsing "normal" to null here would make it impossible to force normal pages
  // under a dark/sepia theme from the toolbar.
  onSettingsChange({ ...settingsRef.current, pdfTintOverride: mode });
}, [onSettingsChange]);

const handleViewModeChange = useCallback((mode: PdfViewMode) => {
  onSettingsChange({ ...settingsRef.current, pdfViewMode: mode });
}, [onSettingsChange]);

const handleToggleThumbnails = useCallback(() => {
  const next = !settingsRef.current.pdfShowThumbnailStrip;
  onSettingsChange({ ...settingsRef.current, pdfShowThumbnailStrip: next });
}, [onSettingsChange]);
```

```tsx
// Reader.tsx — pass-through prop
interface ReaderProps {
  // ...existing
  settings: ReaderSettings;
  onSettingsChange: (next: ReaderSettings) => void;
  // ...
}
// pass to <PdfViewer onSettingsChange={onSettingsChange} ... />

// App.tsx — wire the existing handler
<Reader
  // ...
  settings={settings}
  onSettingsChange={handleSettingsChange}
  // ...
/>
```

`saveSettings` is no longer imported in PdfViewer (App's `handleSettingsChange` calls it for both the React state update and persistence).

- [ ] **Step 3: Tests** (5 cases — see actual test file at tests/hooks/useActiveThemePdfTint.test.tsx for exact assertions: returns "normal" without var; reads "sepia" from inline style; reacts to MutationObserver-driven changes; rejects invalid values; disconnects on unmount).

### Task 1.14: Run all theme tests + build

- [ ] Run `npx vitest run tests/themes/ tests/storage/ tests/hooks/useActiveThemePdfTint.test.tsx`. Expected: pass. (`tests/hooks/` is included so the PDF tint inheritance behavior from Task 1.13b can't slip past the phase gate.)
- [ ] Run `npx vite build`. Expected: success, `dist/` contains the new themes.css inlined.
- [ ] Manual smoke: load `dist/` as unpacked extension; verify 15 themes appear in Settings → Themes; switching changes the UI; create a custom theme, save, activate.

### Task 1.15: Phase 1 self-review checklist

- [ ] Are any function names abbreviated/cryptic? Rename to verbs that state intent.
- [ ] Is there any `any` type that isn't at a third-party boundary? Narrow it.
- [ ] Any magic strings (e.g. raw `"dark"`) appearing more than twice? Promote to a named constant.
- [ ] Any function over 30 lines? Decompose.
- [ ] Are tests named like `appliesDarkPresetByDataAttribute`? If named like `test1`, rename.
- [ ] Are presets registered exactly once? `THEME_PRESETS` is the single source of truth.
- [ ] Does `applyTheme` track its own inline-token mutations so a switch-back cleans up? (yes — verified by test 1.6.6)
- [ ] Stop here, hand off to user for browser test.

---

## Phase 2 — EPUB TOC (spec §2, commits 4-5)

### Task 2.1: Toc types + helpers

**Files:** Modify `src/newtab/lib/parsers/epub.ts`.

Add `TocNode` interface and extend `ParsedEpub` with `toc: TocNode[]`. Don't break the existing `chapters[]` array.

```ts
// in src/newtab/lib/parsers/epub.ts
export interface TocNode {
  /** Tree path of indices, e.g. "0", "0.0", "0.1.2" — guaranteed unique */
  id: string;
  /** Cleaned label, never empty */
  label: string;
  /** Full raw href (path + fragment) */
  href: string;
  /** Index in chapters[] (spine); -1 when href can't be resolved */
  spineIndex: number;
  /** Anchor id WITHOUT leading "#", URL-decoded; null when href has no fragment */
  fragment: string | null;
  children: TocNode[];
}

export interface ParsedEpub {
  title: string;
  author: string;
  chapters: EpubChapter[];
  toc: TocNode[];
  book: Book;
}
```

### Task 2.2: TOC label cleaner (TDD)

**Files:** Create `tests/parsers/toc-label-cleaner.test.ts`, helper inside `src/newtab/lib/parsers/toc-quality.ts` (or split into its own file `toc-label-cleaner.ts`).

Test cases:

```ts
import { describe, it, expect } from "vitest";
import { cleanTocLabel } from "../../src/newtab/lib/parsers/toc-quality";

describe("cleanTocLabel", () => {
  it("trims whitespace", () => { expect(cleanTocLabel("  Chapter 1 ")).toBe("Chapter 1"); });
  it("returns empty for filename-only labels", () => { expect(cleanTocLabel("ch01.xhtml")).toBe(""); });
  it("returns empty for huge all-caps junk", () => { expect(cleanTocLabel("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(""); });
  it("keeps short titles", () => { expect(cleanTocLabel("I")).toBe("I"); });
});
```

Implementation:

```ts
// in src/newtab/lib/parsers/toc-quality.ts
const FILENAME_PATTERN = /\.(x?html?|xml|htm)$/i;
const ALLCAPS_LONG_JUNK_PATTERN = /^[A-Z0-9!@#$%^&*()\-_=+{}\[\]|\\;:'",.<>?/~`]+$/;

export function cleanTocLabel(rawLabel: string): string {
  const trimmed = rawLabel.trim();
  if (!trimmed) return "";
  if (FILENAME_PATTERN.test(trimmed)) return "";
  if (trimmed.length > 30 && ALLCAPS_LONG_JUNK_PATTERN.test(trimmed)) return "";
  return trimmed;
}
```

### Task 2.3: TOC quality scorer (TDD)

**Files:** `tests/parsers/toc-quality.test.ts`, `src/newtab/lib/parsers/toc-quality.ts` (extend).

```ts
// quality test
import { tocQualityScore, isTocGoodEnough } from ".../toc-quality";

it("scores 1.0 for clean labels", () => {
  const toc = [{ id: "0", label: "Introduction", href: "intro.xhtml", spineIndex: 0, fragment: null, children: [] }];
  expect(tocQualityScore(toc)).toBe(1);
});
it("scores 0 when every label is empty/default", () => {
  const toc = [{ id: "0", label: "", href: "x", spineIndex: -1, fragment: null, children: [] }];
  expect(tocQualityScore(toc)).toBe(0);
});
it("isTocGoodEnough requires score >= 0.6 and at least 1 node", () => { ... });
```

Implementation: walk tree, count nodes whose label is non-empty AND not matching `Chapter \d+`. Divide by total.

### Task 2.4: Recursive primary TOC walker

**Files:** Modify `parseEpub` in `src/newtab/lib/parsers/epub.ts`.

After spine load, walk `book.loaded.navigation.toc` recursively. Build map of normalized-href → spineIndex. Resolve each TOC node. Use `cleanTocLabel`. Tree-path id assignment via recursion index.

### Task 2.5: Fallback parser (nav.xhtml + toc.ncx)

**Files:** Create `src/newtab/lib/parsers/epub-toc-fallback.ts`.

Two pure functions:

```ts
export function parseTocFromNavXhtml(xml: string, spineHrefs: string[]): TocNode[] { ... }
export function parseTocFromNcx(xml: string, spineHrefs: string[]): TocNode[] { ... }
```

Each uses `DOMParser`, walks `<nav epub:type="toc">` (EPUB3) or `<navMap>` (EPUB2). Tests mock with fixture XML strings.

### Task 2.6: Picker logic

**Files:** Update `parseEpub`.

After computing primary + fallback (when `book.packaging.navPath`/`ncxPath` exist):
- If only one passes `isTocGoodEnough` → use it
- If both pass → prefer fallback
- If neither passes → higher score; tie → primary

### Task 2.7: Chapter progress helper

**Files:** Create `src/newtab/lib/parsers/toc-progress.ts`.

```ts
export type ChapterStatus = "unread" | "current" | "read";
export function getChapterStatus(spineIndex: number, currentChapterIndex: number): ChapterStatus {
  if (spineIndex < 0) return "unread";
  if (spineIndex < currentChapterIndex) return "read";
  if (spineIndex === currentChapterIndex) return "current";
  return "unread";
}
export function flattenToc(toc: TocNode[]): TocNode[] {
  const out: TocNode[] = [];
  const walk = (nodes: TocNode[]) => { for (const n of nodes) { out.push(n); walk(n.children); } };
  walk(toc);
  return out;
}
```

### Task 2.8: Tests with fixture epubs

- [ ] Place 3 small fixtures in `tests/parsers/fixtures/`: `nested-nav.epub` (EPUB3), `flat-ncx.epub` (EPUB2), `garbage-labels.epub` (forces fallback).
- [ ] Write `tests/parsers/epub-toc.test.ts` parsing each, asserting tree shape + label cleanliness.

### Task 2.9: Phase 2 self-review

- [ ] No `any` casts. Tree-path IDs unique. Quality threshold a named constant. Run all tests.

---

## Phase 3 — App Shell + Sidebars + TopBar (spec §3, §4, commits 6, 9)

### Task 3.1: Panel state hook

**Files:** Create `src/newtab/hooks/usePanelState.ts`.

```ts
export type LeftPanelId = "toc" | "library";
export type RightPanelId = "ai" | "highlights" | "words";
export type AnyPanelId = LeftPanelId | RightPanelId;

export interface PanelState {
  left: LeftPanelId | null;
  right: RightPanelId | null;
  widths: Partial<Record<AnyPanelId, number>>;
}
```

Hook reads/writes `chrome.storage.local["panel_state"]`. Provides `openLeft`, `closeLeft`, `openRight`, `closeRight`, `setWidth`. Subscribes to `chrome.storage.onChanged` for cross-tab sync.

Tests in `tests/shell/panel-state.test.ts` — open/close, persistence, mutual exclusion (toggling same id closes), width round-trip.

### Task 3.2: Generic Panel container

**Files:** Create `src/newtab/components/shell/Panel.tsx`.

Props: `side: "left" | "right"`, `widthPx: number`, `onWidthChange`, `title`, `onClose`, `children`. Renders header + scrollable body + drag handle on inner edge. Min 220, max 460.

### Task 3.3: LeftRail + RightRail

**Files:** Create `src/newtab/components/shell/LeftRail.tsx`, `RightRail.tsx`.

Vertical icon column, 60px wide. Each icon button: aria-label, tooltip on hover, `aria-pressed={active}`. Hidden via CSS `display: none` when `showLeftRail === false`.

LeftRail icons: TOC, Library. Bottom-of-rail: settings cog (opens existing Settings modal).

RightRail icons: AI, Highlights, Words. Bottom: avatar / sign-in.

### Task 3.4: TopBar (collapsed/expanded) + remove Appearance tab

**Files:** Create `src/newtab/components/shell/TopBar.tsx` and `InlineReaderControls.tsx`. Modify `src/newtab/components/Settings.tsx`.

Collapsed (28px): book title, format badge, expand chevron, reading-time estimate. Expanded: drops to ~120px, top row + inline reader controls (size slider, line-height slider, font picker) + close X. Click outside or Esc collapses. No scroll-hide. No `pinToolbar`.

**Settings.tsx — remove Appearance tab now** (per spec §9.1). Phase 1 left it alive because font/size/line-height needed a UI. With InlineReaderControls landing in TopBar, those settings now live there. Drop the Appearance entry from `SECTIONS` and the `activeSection === "appearance"` content block. Move the `FONT_OPTIONS` constant to `InlineReaderControls.tsx`.

Final tab list after this task: **Themes, Reader, AI Keys (Phase 5), PDF Viewer**. No Appearance.

Tests: `tests/shell/topbar.test.ts` — toggles, escape, click-outside, slider values change settings; `tests/components/settings-tabs.test.tsx` — Appearance tab no longer renders, reader controls accessible via TopBar.

### Task 3.5: AppShell

**Files:** Create `src/newtab/components/AppShell.tsx`.

Composes TopBar, LeftRail, LeftPanel, main, RightPanel, RightRail per spec §3.2. Wires panel state to rails. Hides rails per `settings.showLeftRail`/`showRightRail`.

### Task 3.6: TocPanel + TocNode

**Files:** Create `src/newtab/components/panels/TocPanel.tsx`, `TocNode.tsx`.

Recursive render. Per-node dot via `getChapterStatus`. Scroll-spy: effect watches `currentChapterIndex`, scrolls active node into view. Search input filters. Expand state persisted per book hash in `chrome.storage.local["toc_state_<hash>"]`. Empty TOC fallback shows flat list.

Click → `onJump(node)` (App routes through `goToTocNode`).

### Task 3.7: goToTocNode in App + Reader pendingFragment

**Files:** Modify `App.tsx`, `Reader.tsx`.

**Important — `goToChapter` is currently local to `Reader.tsx`** (it lives inside the component body and isn't exported). App can't call it. Two changes required:

1. **Lift chapter navigation into App.** Add an App-level handler. **Match Reader's existing percentage formula** (`(index / totalSections) * 100`) — passing 0 here regresses progress until the next scroll event corrects it:

    ```ts
    // App.tsx — `currentBook` exposes total chapter/section count via the format-specific union.
    const totalSections = useMemo(() => {
      if (!currentBook) return 0;
      if (currentBook.format === "epub") return currentBook.epub?.chapters.length ?? 0;
      if (currentBook.format === "txt") return currentBook.txt?.chunks.length ?? 0;
      // pdf: chapterIndex represents page-1; totalSections is page count.
      return currentBook.format === "pdf" ? (currentBook.pdf?.totalPages ?? 0) : 0;
    }, [currentBook]);

    const jumpToChapter = useCallback((spineIndex: number, fragment: string | null) => {
      if (spineIndex < 0 || totalSections <= 0) return;
      const percentage = (spineIndex / totalSections) * 100;
      handlePositionChange(spineIndex, 0, percentage);
      setPendingFragment(fragment);
    }, [handlePositionChange, totalSections]);
    ```

2. **Reader's local `goToChapter`** stays for keyboard arrow-nav and end-of-chapter "Continue" button (those don't need a fragment). It already computes percentage correctly. No change required.

App holds `const [pendingFragment, setPendingFragment] = useState<string | null>(null)`. TocPanel's onJump prop is wired to `(node: TocNode) => jumpToChapter(node.spineIndex, node.fragment)`.

Reader receives two new optional props: `pendingFragment: string | null` and `onPendingFragmentConsumed: () => void`. Effect runs after content render: if fragment, `document.getElementById(fragment)` scoped to `proseRef.current.contains(...)`; fallback `proseRef.current.querySelector('[name="' + CSS.escape(fragment) + '"]')`. Scroll into view (`block: "start"`); call `onPendingFragmentConsumed()` regardless of whether the anchor was found (so a missing anchor doesn't loop).

**Tests:**
- `tests/components/reader-fragment.test.tsx`: render Reader with a chapter containing `<h2 id="sec1">Section 1</h2>`; pass `pendingFragment="sec1"`; assert scrollIntoView is called on that element and `onPendingFragmentConsumed` fires once.
- Same with `pendingFragment` matching no element: `onPendingFragmentConsumed` still fires once.
- Same with fragment containing chars needing CSS escape (e.g. `"Section.1"`): assert no selector throws.

### Task 3.8: LibraryPanel (replaces Library modal)

**Files:** Create `src/newtab/components/panels/LibraryPanel.tsx`. Delete `src/newtab/components/Library.tsx`.

Features: search, sort (recent/title/author), groups (Reading/Finished/Unstarted), pinned recent, drag-drop add, click-to-switch, hover-to-delete-confirm, active-row highlight.

Modify `useBook` to expose `progressByHash: Record<string, number>` computed from `pos_<hash>` storage; add `lastOpenedAt` to BookMetadata; refresh on `chrome.storage.onChanged`.

Tests: `tests/panels/library-grouping.test.ts`, `library-search.test.ts`.

### Task 3.9: Rail visibility settings + tests

**Files:** Update `Settings.tsx` Reader tab → add Layout section with `showLeftRail`/`showRightRail` toggles. Tests: `tests/shell/rail-visibility.test.ts` — hide forces panel closed; keyboard shortcut no-op when hidden.

### Task 3.10: Adapt AIPanel/HighlightsPanel/WordsPanel to Panel container

**Files:** Modify three components — accept `onClose`, drop their own modal chrome (close button, dim backdrop), fit `Panel` body.

### Task 3.11: Phase 3 self-review + build

- [ ] All panels keyboard accessible (Tab, Enter, Esc).
- [ ] Tests run + pass.
- [ ] `npx vite build` succeeds.
- [ ] Manual: load extension, click each rail icon, verify panel opens, drag-resize works, persists across reload, hide rail toggle works.

---

## Phase 4 — PDF Bottom Thumbnail Strip (spec §7, commit 10)

### Task 4.1: usePdfThumbnails LRU cache hook

**Files:** Create `src/newtab/components/pdf/usePdfThumbnails.ts`.

LRU cache of `<canvas>` per page number, max 30 entries. Renders at scale 0.2. Eviction = oldest insertion.

### Task 4.2: PdfThumbnailStrip component

**Files:** Create `src/newtab/components/pdf/PdfThumbnailStrip.tsx`.

Props: `pdfDoc`, `currentPage`, `totalPages`, `onJumpToPage`. Horizontal scroll, current page enlarged + 4 each side initially, intersection observer for lazy render. Drag-scrub. Mousewheel-horizontal.

### Task 4.3: Render strip inside PdfViewer

**Files:** Modify `src/newtab/components/pdf/PdfViewer.tsx`.

Wrap content in flex column: page area (flex-1) + `<PdfThumbnailStrip>` (flex-none) when `settings.pdfShowThumbnailStrip`. Pass `pdfDoc` directly.

### Task 4.4: Delete PdfThumbnails (side panel)

- [ ] `git rm src/newtab/components/pdf/PdfThumbnails.tsx`.
- [ ] Remove its references in PdfViewer.

### Task 4.5: Phase 4 self-review

- [ ] LRU cap is a named constant (`MAX_CACHED_THUMBNAILS`).
- [ ] No memory leak: cache cleared on unmount.
- [ ] Tests: `tests/pdf/usePdfThumbnails.test.ts` — eviction order; render-on-demand.

---

## Phase 5 — HTTP / AI / BYOK (spec §8, commits 11-12)

### Task 5.1: Extract lib/http.ts

**Files:** Create `src/newtab/lib/http.ts`. Modify `src/newtab/lib/api.ts`.

Move `setAuthToken`, `getAuthToken`, `isAuthenticated`, `isOnline`, the private `authToken`, and the `request<T>()` helper into `lib/http.ts`. Re-export them from `lib/api.ts` for backward compat.

```ts
// src/newtab/lib/http.ts
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Share the API URL with the service worker so it doesn't have to hardcode it.
// IMPORTANT: this side effect already lives in the current lib/api.ts. Preserve it
// here verbatim — without it, background sync (highlights/vocab) falls back to
// localhost in production builds.
try {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    void chrome.storage.local.set({ api_url: API_BASE });
  }
} catch {
  /* not in extension context (e.g. unit tests) */
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void { authToken = token; }
export function getAuthToken(): string | null { return authToken; }
export function isAuthenticated(): boolean { return authToken !== null; }
export function isOnline(): boolean { return navigator.onLine; }

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isOnline()) throw new Error("You are offline");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }
  return response.json() as Promise<T>;
}
```

`lib/api.ts` becomes:

```ts
// Re-export the full http surface so existing call sites that import
// setAuthToken / getAuthToken / isAuthenticated / isOnline from "../lib/api"
// keep working without modification.
export { setAuthToken, getAuthToken, isAuthenticated, isOnline } from "./http";
import { request } from "./http";
import { getAiClient } from "./ai/router";
// ...all existing non-AI exports use `request` directly...
// AI exports become wrappers (see Task 5.6)
```

### Task 5.2: AI types + prompts

**Files:** Create `src/newtab/lib/ai/types.ts`, `prompts.ts`.

```ts
// types.ts
export type AiProvider = "anthropic" | "openai" | "google" | "openrouter";
export type AiSource = "server" | AiProvider;
export interface AiClient {
  summarize(text: string): Promise<string>;
  ask(question: string, context: string): Promise<string>;
  highlights(text: string): Promise<string[]>;
  explain(selection: string, context: string): Promise<string>;
  translate(text: string, targetLang: string): Promise<{ text: string; detectedLang?: string }>;
}
```

`prompts.ts` lifts the system+user prompts from `book-reader-api/src/services/ai.ts` and `translate.ts`. Read those files first, copy verbatim, expose as `SUMMARIZE_PROMPT(text)`, etc.

### Task 5.3: ByokConfig + storage + cache + helpers

**Files:** Create `src/newtab/lib/ai/byok-cache.ts`, `byok-helpers.ts`.

```ts
// byok-cache.ts
import type { AiProvider } from "./types";

export interface ByokConfig {
  activeProvider: AiProvider | null;
  keys: Partial<Record<AiProvider, string>>;
  models: Partial<Record<AiProvider, string>>;
}
const EMPTY: ByokConfig = { activeProvider: null, keys: {}, models: {} };
let cached: ByokConfig = EMPTY;
export function getCachedByok(): ByokConfig { return cached; }
export function setCachedByok(next: ByokConfig): void { cached = next; }
export const BYOK_STORAGE_KEY = "byok";
export async function loadByokIntoCache(): Promise<void> {
  const result = await chrome.storage.local.get(BYOK_STORAGE_KEY);
  setCachedByok({ ...EMPTY, ...(result[BYOK_STORAGE_KEY] as ByokConfig | undefined) });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[BYOK_STORAGE_KEY]) {
      setCachedByok({ ...EMPTY, ...(changes[BYOK_STORAGE_KEY].newValue as ByokConfig | undefined) });
    }
  });
}
```

```ts
// byok-helpers.ts
import type { AiProvider } from "./types";
import type { ByokConfig } from "./byok-cache";
export function getConfiguredProvider(byok: ByokConfig): AiProvider | null {
  if (!byok.activeProvider) return null;
  const key = byok.keys[byok.activeProvider];
  return key && key.length > 0 ? byok.activeProvider : null;
}
```

### Task 5.4: Provider clients (TDD per provider)

**Files:** Create one file per provider in `src/newtab/lib/ai/`. Each implements `AiClient` via `fetch`.

Default models:
- Anthropic: `claude-sonnet-4-6` — `https://api.anthropic.com/v1/messages` — header `anthropic-dangerous-direct-browser-access: true`, `x-api-key`, `anthropic-version: 2023-06-01`
- OpenAI: `gpt-5.5` — `/v1/chat/completions`, `Authorization: Bearer`
- Google: `gemini-3.1-pro-preview` — `/v1beta/models/{model}:generateContent?key=...`
- OpenRouter: `anthropic/claude-sonnet-4.6` — OpenAI-compatible, `Authorization: Bearer`

For each: write a test stubbing `fetch`, asserting URL, headers, body shape. Then implement.

### Task 5.5: Server client + Router

**Files:** Create `server.ts`, `router.ts`.

`server.ts` calls `request<{summary: string}>("/ai/summarize", ...)` per current backend; unwraps to bare strings.

`router.ts`:

```ts
import { getCachedByok } from "./byok-cache";
import { getConfiguredProvider } from "./byok-helpers";
import { isAuthenticated } from "../http";
import { createServerClient } from "./server";
import { createAnthropicClient } from "./anthropic";
// ...etc

export function getAiClient(bookHash: string | null): AiClient {
  const byok = getCachedByok();
  const configured = getConfiguredProvider(byok);
  if (configured) {
    const apiKey = byok.keys[configured]!;
    const model = byok.models[configured];
    switch (configured) {
      case "anthropic": return createAnthropicClient(apiKey, model);
      case "openai": return createOpenAiClient(apiKey, model);
      case "google": return createGoogleClient(apiKey, model);
      case "openrouter": return createOpenRouterClient(apiKey, model);
    }
  }
  if (isAuthenticated()) return createServerClient(bookHash);
  throw new Error("AI not configured. Add an API key in Settings → AI Keys, or sign in.");
}
```

Test `tests/ai/router.test.ts`: precedence, fallback to server when key cleared, throw when neither.

Test `tests/ai/openai-endpoint-guard.test.ts`: assert OpenAI client URL ends with `/v1/chat/completions`, not `/v1/responses`.

### Task 5.6: api.ts AI wrappers

Replace existing `aiSummarize`, `aiAsk`, `aiHighlights`, `aiExplain`, `aiTranslate` bodies with router wrappers preserving public return shapes:

```ts
export async function aiSummarize(bookHash: string, chapterText: string): Promise<{ summary: string }> {
  return { summary: await getAiClient(bookHash).summarize(chapterText) };
}
// ... etc
```

### Task 5.7: useByok hook

**Files:** Create `src/newtab/hooks/useByok.ts`.

Returns the current `ByokConfig`, exposes `setActiveProvider`, `setKey(provider, key)`, `setModel(provider, model)`, `clearAllKeys`. Persists to storage; updates cache. Subscribes to `chrome.storage.onChanged`.

### Task 5.8: useAI updates — both the public flag AND the per-action guard

Modify `src/newtab/hooks/useAI.ts`. The current file has TWO availability paths and BOTH must be updated. Just patching the public `available` flag without fixing `checkAvailability` would leave every AI action returning "Sign in with Google to use AI features." for BYOK-only users.

```ts
import { useState, useCallback } from "react";
import { aiSummarize, aiAsk, aiHighlights, aiExplain, isOnline } from "../lib/api";
import { isAuthenticated } from "../lib/http";
import { useByok } from "./useByok";
import { getConfiguredProvider } from "../lib/ai/byok-helpers";
import type { ByokConfig } from "../lib/ai/byok-cache";

const OFFLINE_MSG = "AI features require an internet connection.";
const NO_AI_CONFIGURED_MSG =
  "AI is not configured. Add a provider key in Settings → AI Keys, or sign in with Google.";

function isAiUsable(byok: ByokConfig): boolean {
  return getConfiguredProvider(byok) !== null || isAuthenticated();
}

function checkAvailability(byok: ByokConfig): string | null {
  if (!isOnline()) return OFFLINE_MSG;
  if (!isAiUsable(byok)) return NO_AI_CONFIGURED_MSG;
  return null;
}

export function useAI(bookHash: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byok = useByok();

  const available = isOnline() && isAiUsable(byok);

  // Each action calls `checkAvailability(byok)` — same guard, same source of truth.
  // Wrap once and reuse:
  const guardedCall = useCallback(
    async <T,>(action: () => Promise<T>, failureMessage: string): Promise<T | null> => {
      if (!bookHash) return null;
      const unavailable = checkAvailability(byok);
      if (unavailable) { setError(unavailable); return null; }
      setLoading(true);
      setError(null);
      try {
        return await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : failureMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [bookHash, byok],
  );

  const summarize = useCallback(
    (chapterText: string) => guardedCall(async () => (await aiSummarize(bookHash!, chapterText)).summary, "Summarization failed"),
    [bookHash, guardedCall],
  );
  // ...same pattern for ask, highlights, explain. The collapse from 4 near-duplicate
  // useCallback bodies into one `guardedCall` removes the duplication that previously
  // hid the missing BYOK check.

  return { loading, error, available, summarize, ask, highlights, explain };
}
```

Verify by running the existing AI flows with: (a) BYOK-active + signed-out — must work; (b) signed-in + no BYOK — must work; (c) signed-out + no BYOK — must show NO_AI_CONFIGURED_MSG.

Existing call sites use `lib/api.ts` exports — no other changes needed.

### Task 5.9: ByokSettings UI

**Files:** Create `src/newtab/components/settings/ByokSettings.tsx`.

Per-provider section: API key input (password w/ show/hide), model picker (curated list per provider; "default" option uses spec §8.1 model), Test button (runs a 1-token ping), provider radio at top, "Use server (Google sign-in)" radio, Clear-all-keys button.

Add an "AI Keys" tab to `Settings.tsx`.

### Task 5.10: manifest.json host_permissions

Modify `book-reader-extension/public/manifest.json`. Add to `host_permissions`:
```
"https://api.anthropic.com/*",
"https://api.openai.com/*",
"https://generativelanguage.googleapis.com/*",
"https://openrouter.ai/*"
```

### Task 5.11: Bootstrap initialization

**Files:** Create `src/newtab/hooks/useAppBootstrap.ts`.

On mount, in this exact order (theme depends on customThemes; AI router depends on byok cache):

1. `const settings = await getSettings()` — applies legacy migrations
2. `const customThemes = await loadCustomThemes()` — **must come before applyTheme** so a saved custom theme id resolves correctly. Without this, a custom-theme id falls through to the light fallback.
3. `applyTheme(settings.themeId, customThemes)`
4. `await loadByokIntoCache()` — populates module-level cache; `getAiClient` is synchronous and depends on this being done before any AI call fires
5. load library metadata + lastOpenedAt
6. load panel state (`chrome.storage.local["panel_state"]`)
7. resume current book + position (`getCurrentBook()` → `getPosition(hash)`)

Wrap App in this so there's no flash. The hook returns a `bootstrapped: boolean` flag; App renders a brief spinner until true.

**Test (`tests/hooks/useAppBootstrap.test.ts`):** with a custom theme id stored, applyTheme is called once with the custom theme present in the customThemes argument (not just an empty list). Spy on applyTheme to verify ordering.

### Task 5.12: Phase 5 self-review

- [ ] Each provider client tests its request shape (URL, headers, body).
- [ ] Router test verifies each branch (configured BYOK / signed in / neither).
- [ ] Endpoint guard test passes.
- [ ] Build succeeds.
- [ ] Manual: in Settings → AI Keys, paste a real Anthropic key, click Test, expect ✓. Trigger AI summary in a book, expect response.

---

## Phase 6 — Cleanup (commit 13)

### Task 6.1: Remove dead code

- [ ] `pinToolbar` — already removed in storage. grep for any remaining ref, delete.
- [ ] Old Appearance "Theme" block — already removed.
- [ ] Bottom-pill scrubber for PDF — replaced by strip; keep for EPUB.

### Task 6.2: Final full-suite run

- [ ] `npx vitest run` — expect all green.
- [ ] `npx vite build` — expect success.
- [ ] Manual matrix: light + dark + sepia + custom theme; epub w/ nested TOC, epub w/ flat TOC, pdf, txt; signed-in, BYOK active, neither.

### Task 6.3: Final clean-code self-review (no skipping)

Walk every new file:
- [ ] Function and variable names declare intent.
- [ ] No `any`.
- [ ] No magic numbers/strings duplicated > 1 time.
- [ ] No commented-out code.
- [ ] Each file has one responsibility.
- [ ] Tests use AAA structure with descriptive names.
- [ ] All async errors have actionable messages.

---

## Local Build Instructions for the User

After Phase 1 (and after every later phase) the user can browser-test:

```bash
cd book-reader-extension
npm run build
```

Then in Chrome:
1. `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select `book-reader-extension/dist`
5. Open a new tab — extension takes over

The extension persists IndexedDB data across reloads, so opened books stay loaded. Click Settings → Themes to pick a theme; click again to verify the choice survives a reload.

---

## Spec Self-Review (post-plan)

| Spec section | Plan coverage |
|---|---|
| §1 Theme system | Phase 1 (tasks 1.1–1.15) |
| §2 EPUB TOC | Phase 2 (tasks 2.1–2.9) |
| §3 App shell + sidebars | Phase 3 (tasks 3.1–3.11) |
| §4 Top nav collapse | Phase 3 (task 3.4) |
| §5 Library panel | Phase 3 (task 3.8) |
| §6 TOC panel | Phase 3 (tasks 3.6–3.7) |
| §7 PDF thumbnail strip | Phase 4 (tasks 4.1–4.5) |
| §8 BYOK | Phase 5 (tasks 5.1–5.10) |
| §9 Cross-cutting (settings tabs, migrations, manifest, file map) | Spread across phases; Phase 5.11 bootstrap |
| §10 Commit plan | Each phase corresponds to listed commits |
| §11 Testing | Each task ends in a test step |
| §12 Risks | Mitigations referenced (cascade test, endpoint guard, LRU cap) |
| §13 Out of scope | Not in plan |
