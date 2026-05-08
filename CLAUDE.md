# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This repo contains two related projects (plus an unrelated Xcode project):

- `book-reader-extension/` — **Instant Book Reader**, a Chrome MV3 extension that replaces the New Tab page with an EPUB/PDF/TXT reader. React 19 + TypeScript + Tailwind 4 + Vite 8.
- `book-reader-api/` — Optional backend for cloud sync and server-side AI fallback. Hono + Drizzle ORM + PostgreSQL, deployed to Railway.
- `Flipside/` — Unrelated iOS Xcode project. Ignore unless explicitly asked.

The extension is fully functional offline. The API only matters when a user signs in with Google.

## Common Commands

### Extension (`book-reader-extension/`)
```bash
npm run dev          # Vite dev server (rarely useful — extension runs as new-tab override)
npm run build        # Build to dist/ — load this folder as unpacked extension at chrome://extensions
npm test             # vitest run (jsdom env, fake-indexeddb)
npm run test:watch   # vitest watch mode
npx vitest run tests/themes/cascade.test.ts   # run a single test file
npx vitest run -t "preset name"               # filter by test name
```

The build emits two entry points (see `vite.config.ts`): `src/newtab/index.html` (the React app) and `src/background/service-worker.ts` → `service-worker.js` at the dist root. `vite-plugin-static-copy` copies `public/` (manifest, pdf.js worker, icons) into dist.

### API (`book-reader-api/`)
```bash
npm run dev          # tsx watch on src/index.ts (port 3000 by default)
npm run build        # tsc → dist/
npm start            # run compiled dist/index.js
npm run db:generate  # drizzle-kit: generate migration from schema changes
npm run db:migrate   # apply migrations
npm run db:push      # push schema directly (dev-only)
```

Required env vars (see `.env.example`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `PORT`.

## Architecture

### Extension data flow

The extension is a single-page React app rendered into the new-tab override. Books and user data live in **IndexedDB** (`book-reader` DB via `idb`); preferences live in `chrome.storage.local`. Books are content-addressed by SHA-256 of the file bytes (`computeFileHash` in `src/newtab/lib/storage.ts`) — the hash is the primary key everywhere (positions, highlights, vocab, AI cache).

Top-level orchestration is in `src/newtab/App.tsx`, which composes a set of hooks that own each domain:

- `useBook` — library, current book, parsing pipeline (calls `lib/parsers/{epub,pdf,txt}.ts`)
- `usePosition` — reading position with chrome-storage debounced writes; the **service worker** (`src/background/service-worker.ts`) reads `pos_*` keys via a `chrome.alarms` tick (every 30s) and PUTs them to the API when the user is signed in
- `useAuth` — Google Sign-In via `chrome.identity`, exchanges ID token for a JWT from the API
- `useAI` — routes prompts through `lib/ai/router.ts` which picks the BYOK provider (`openai|anthropic|google|openrouter`) or falls back to the server (`lib/ai/server.ts`). BYOK keys are AES-encrypted in `chrome.storage.local`; see `lib/ai/byok-helpers.ts` and tests in `tests/byok/`.
- `useHighlights`, `useVocab` — local IndexedDB stores with `lib/{highlights,vocab}/sync.ts` pushing pending mutations to the API on `online` events
- `useTheme` — applies CSS variables from `lib/themes/apply.ts`; presets in `lib/themes/presets.ts`; user can build custom themes via `components/settings/ThemeBuilder.tsx`
- `usePanelState` — left/right resizable rail+panel state
- `useSelection` — text-selection toolbar state across EPUB/PDF/TXT views

### Reader rendering

Three formats, three rendering paths — kept separate on purpose:
- **EPUB**: `epubjs` → flattened to chapters with HTML content; rendered via React-managed `.prose-reader`. TOC quality has fallback heuristics (`lib/parsers/epub-toc-fallback.ts`, `toc-quality.ts`).
- **PDF**: `pdfjs-dist` 3.x. The PDF subtree under `components/pdf/` has its own viewer (`PdfViewer.tsx`) with `PdfSingleView`, `PdfContinuousView`, `PdfSpreadView` modes plus `PdfThumbnailStrip`. The pdf.js worker is shipped as a static file in `public/` (CSP forbids `unsafe-eval`).
- **TXT**: chunked in-memory; trivial.

Highlights use a content-addressed anchor scheme (`lib/highlights/anchor.ts`) — they store the surrounding text + offset rather than DOM ranges, so they survive re-renders and reflows. PDF highlights anchor against the per-page `.textLayer`; EPUB/TXT anchor against `.prose-reader`. See the PDF branch in `App.tsx`'s `handleSelectionAction` for the divergence.

### API surface

`book-reader-api/src/index.ts` mounts five route modules (`auth`, `position`, `ai`, `highlights`, `vocabulary`). All non-auth routes require a JWT. CORS allows `chrome-extension://*` origins dynamically. `ai.ts` is the server-side fallback that proxies to Anthropic (`@anthropic-ai/sdk`).

Database schema is in `src/db/schema.ts` (Drizzle, PostgreSQL). Migrations live in `src/db/migrations/` and are managed by `drizzle-kit`.

### Manifest & permissions

`public/manifest.json` is MV3. The extension overrides `newtab`, runs a module service worker, and declares host permissions for the four AI providers + dictionary + Google TTS. `oauth2.client_id` must be replaced with a real Google OAuth client ID before signing in works locally.

## Design system

UI must follow the **Clay design system** (warm cream background, oat borders, hard-offset hover shadows, no cool grays, no blur shadows). Full spec: `.cursor/rules/clay-design-system.mdc`. Buttons use `.clay-btn-solid` / `.clay-btn-white`; cards use `.clay-card`; uppercase labels use `.clay-label`. Themes that follow this system are in `src/newtab/themes.css` and `lib/themes/presets.ts`.

## Testing notes

- Vitest config: `jsdom` env, globals on, setup at `tests/setup.ts` (loads `@testing-library/jest-dom` and `fake-indexeddb`).
- Test files are colocated by domain under `tests/` (not next to source). Convention: `tests/<domain>/<file>.test.ts(x)`.
- The setup file polyfills IndexedDB, so storage-layer tests run as integration tests against the real `idb` API.
