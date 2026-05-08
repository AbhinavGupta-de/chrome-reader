# Instant Book Reader

<p align="center">
  <img src="book-reader-extension/public/BookFlipSmall.jpg" alt="Instant Book Reader" width="120" height="120" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>Your reading space, always one tab away.</strong><br/>
  A Chrome Extension that replaces your New Tab with a distraction-free book reader.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/instant-book-reader/beconkamchfbjkplbapbkhmjdmpjfeni"><strong>Install from Chrome Web Store</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/aatmik-panse/chrome-reader/releases/latest">Download Latest Release</a>
</p>

---

## What It Does

Drop an EPUB, PDF, or TXT file into the extension once — every new tab takes you back to where you left off. No app to launch, no website to load, no account required.

## Features

### Reader
- **Multi-format** — EPUB, PDF, and TXT with clean rendering
- **15+ themes** — Light, dark, sepia, and more, plus a custom theme builder
- **Adjustable typography** — Font family, size, and line spacing controls
- **PDF view modes** — Single page, continuous scroll, two-page spread
- **PDF thumbnails** — Bottom strip with page previews for quick navigation
- **Table of Contents** — Nested chapter navigation for EPUBs with one-click jump
- **Resizable panels** — Drag-to-resize sidebars for Library, TOC, AI, Highlights, and Words

### AI Assistant (BYOK)
- **Summarize** chapters in 3–5 paragraphs
- **Explain** any selected text — auto-fires from the selection toolbar
- **Key highlights** extraction from the current chapter
- **Ask questions** about what you're reading
- **Bring Your Own Key** — OpenAI, Anthropic, Google Gemini, or OpenRouter
- **Markdown rendering** — AI responses display with proper formatting
- **Server fallback** — works with Google Sign-In if no API key is set

### Vocabulary & Learning
- **One-click define** — definitions, phonetics, and pronunciation audio inline
- **Inline translation** — translate selections into 10 languages
- **Vocabulary builder** — auto-saves every word you define with context
- **Spaced repetition** — Leitner box flashcards (1d → 3d → 7d → 14d → 30d → mastered)
- **Quiz mode** — fill-in-the-blank using your own saved sentences
- **CSV export** — for Anki, Notion, or anywhere else

### Highlights
- **4 colors** — yellow, green, pink, blue with optional notes
- **Sidebar list** — click any highlight to jump back to it
- **One-click remove** — re-select a highlighted passage to remove it

### Privacy
- **Local-first** — books, highlights, vocabulary, and progress stay in your browser
- **No analytics, no telemetry, no ads**
- **Optional cloud sync** — only if you sign in with Google

## Project Structure

```
chromeApps/
  book-reader-extension/   Chrome Extension (React + Tailwind + Vite)
  book-reader-api/         Backend API (Hono + Drizzle + PostgreSQL)
```

## Quick Start

### Install from Release

1. Download `instant-book-reader-v1.0.2.zip` from [Releases](https://github.com/aatmik-panse/chrome-reader/releases/latest)
2. Unzip the file
3. Go to `chrome://extensions`
4. Enable **Developer mode**
5. Click **Load unpacked**
6. Select the unzipped folder

### Build from Source

```bash
cd book-reader-extension
npm install
npm run build
```

Then load `book-reader-extension/dist` as an unpacked extension.

### Run Tests

```bash
cd book-reader-extension
npm test
```

### Backend API (Optional)

The extension works fully offline. The backend is only needed for cloud sync and server-side AI fallback.

```bash
cd book-reader-api
cp .env.example .env
npm install
npm run dev
```

The API starts at `http://localhost:3000`.

## Environment Variables

**Backend (`book-reader-api/.env`):**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key for server-side AI |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `PORT` | Server port (default: 3000) |

**Extension (`book-reader-extension/.env`):**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL (default: http://localhost:3000) |

## AI Configuration

The extension supports **Bring Your Own Key** (BYOK) for AI features. Go to **Settings → AI Keys** and add a key for any supported provider:

| Provider | Models |
|---|---|
| OpenAI | GPT-4o, GPT-4o-mini, etc. |
| Anthropic | Claude Sonnet, Claude Haiku, etc. |
| Google Gemini | Gemini Pro, Gemini Flash, etc. |
| OpenRouter | Any model on OpenRouter |

No API key? Sign in with Google to use the server-side fallback (requires the backend API).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves books, highlights, vocabulary, and reading positions locally |
| `alarms` | Periodically saves reading position so a crash doesn't lose your spot |
| `identity` | Optional Google Sign-In for cloud sync and server AI |
| `api.dictionaryapi.dev` | Fetches word definitions |
| `translate.google.com` | Pronunciation audio fallback |
| `api.anthropic.com` / `api.openai.com` / `generativelanguage.googleapis.com` / `openrouter.ai` | Only used if you add your own AI key |

## Deploy Backend to Railway

1. Push `book-reader-api/` to a GitHub repo
2. Connect it to Railway
3. Add a PostgreSQL database service
4. Set the environment variables listed above
5. Railway auto-deploys on push

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the "Google Identity" API
3. Create an OAuth 2.0 Client ID (type: Chrome Extension)
4. Add the extension ID to the authorized origins
5. Set `GOOGLE_CLIENT_ID` in both `.env` files and `manifest.json`

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite 8
- **PDF:** pdf.js
- **EPUB:** epub.js
- **Backend:** Hono, Drizzle ORM, PostgreSQL
- **Testing:** Vitest, Testing Library
- **Design System:** Custom Clay-inspired system with tilt+shadow hover animations

## License

ISC
