# Instant Book Reader

A Chrome Extension that replaces your New Tab page with a beautiful book reader, backed by a Node.js API for reading position sync and AI-powered features.

## Project Structure

```
chromeApps/
  book-reader-extension/   Chrome Extension (React + Tailwind + Vite)
  book-reader-api/         Backend API (Hono + Drizzle + PostgreSQL)
```

## Quick Start

### 1. Backend API

```bash
cd book-reader-api
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

The API starts at `http://localhost:3000`.

### 2. Chrome Extension

```bash
cd book-reader-extension
cp .env.example .env
npm install
npm run dev
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `book-reader-extension/dist` directory

### Environment Variables

**Backend (`book-reader-api/.env`):**

- `DATABASE_URL` — PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Anthropic API key for Claude AI features
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `JWT_SECRET` — Secret for signing JWT tokens
- `PORT` — Server port (default: 3000)

**Extension (`book-reader-extension/.env`):**

- `VITE_API_URL` — Backend API URL (default: [http://localhost:3000](http://localhost:3000))

### Deploy to Railway

1. Push `book-reader-api/` to a GitHub repo
2. Connect it to Railway
3. Add a PostgreSQL database service
4. Set the environment variables listed above
5. Railway auto-deploys on push

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the "Google Identity" API
3. Create an OAuth 2.0 Client ID (type: Chrome Extension)
4. Add the extension ID to the authorized origins
5. Set `GOOGLE_CLIENT_ID` in both `.env` files and `manifest.json`

## Features

- **Multi-format support:** EPUB, PDF, TXT
- **Clean reading UI:** Light, Dark, and Sepia themes
- **Reading position sync:** Local-first with background sync to backend
- **AI Assistant (Claude):** Chapter summaries, Q&A, key highlights, passage explanation
- **Google Sign-In:** Secure authentication

