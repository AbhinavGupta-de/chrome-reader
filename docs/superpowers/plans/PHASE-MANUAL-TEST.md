# Reader Epic Upgrade — Manual Browser Test Plan

One-page checklist for validating the build produced by Phase 6. Load the
unpacked extension from `book-reader-extension/dist/` in Chrome
(`chrome://extensions` → Developer mode → Load unpacked) and open a new tab.

For each section, run the steps in order and tick off the expected outcome.
If anything diverges, capture the failure (screenshot + console output) and
file it before merging.

---

## 1. Theme switching

- [ ] Open Settings → **Themes** tab.
- [ ] Click each of the 15 built-in presets in turn. Confirm: page bg, body
  text, accent colors, and `--pdf-tint` all update without a reload.
- [ ] Click **New custom theme**, edit at least 3 token swatches and the PDF
  tint, save. Confirm the new theme appears in the grid and is applied.
- [ ] Reload the new tab. Active theme persists. Custom theme still listed.
- [ ] Open a second new-tab page; confirm the same theme shows there too
  (cross-tab `chrome.storage` sync).

## 2. EPUB TOC navigation

- [ ] Open an EPUB with nested chapters (any non-trivial book).
- [ ] Click the left-rail **Table of Contents** icon. Panel opens.
- [ ] Expand a parent node — children render with disclosure caret rotated.
- [ ] Click a child chapter — the reader scrolls to it; the TOC entry shows
  the **current** indicator, prior entries show **read** dots, later entries
  show **unread** dots.
- [ ] Search box: type 2–3 chars of a chapter title; non-matching nodes
  hide; ancestors of matches stay open.
- [ ] Reload, reopen the same book — previously expanded nodes restore.

## 3. Library panel

- [ ] Click the left-rail **Library** icon. Panel opens with current books
  grouped by Recent / Reading / Unstarted / Finished.
- [ ] Drag-drop an EPUB or PDF file onto the drop target. Book imports and
  becomes selectable.
- [ ] Use the **search** input — books filter by title or author.
- [ ] Switch the **sort** dropdown between Recent / Title / Author. Order
  updates accordingly.
- [ ] Click a different book in the list. Reader switches to it. Recent
  pinned book reflects the most-recently-opened.
- [ ] Hover a row, click the trash icon, confirm — book is removed from
  storage.

## 4. TopBar collapse / expand

- [ ] Click the chevron in the top bar — bar collapses to a thin sliver,
  reader takes the full height.
- [ ] Click the sliver to re-expand. Confirm controls return.
- [ ] Re-collapse, press **Esc** — bar stays collapsed (Esc is reserved
  for panels). Click outside the bar — bar stays collapsed (only chevron
  expands; verify behavior matches spec).
- [ ] When the bar is collapsed and an EPUB is open, the **inline reader
  controls** (font, size, line-height) appear in the reader chrome and
  drive typography in real time.

## 5. Right rail panels

- [ ] Click the right-rail **AI** icon. Panel opens, summary loads (or
  shows the not-configured CTA).
- [ ] Drag the panel's left edge — width updates live; release to persist.
  Reload — width restored.
- [ ] Switch between **AI**, **Highlights**, **Words** by clicking each
  rail icon. Re-clicking the active icon closes the panel.
- [ ] Press `]` keyboard shortcut — toggles the right panel. `[` toggles
  the left panel. **Esc** closes whichever is open.

## 6. Rail visibility toggles

- [ ] Open Settings → **Reader** tab → Layout section.
- [ ] Toggle **Show left rail** off. Left rail (and any open left panel)
  hides. Toggle back on — left rail returns.
- [ ] Repeat for **Show right rail**. Confirm same behavior on the right.

## 7. PDF thumbnail strip

- [ ] Open a multi-page PDF (≥ 20 pages).
- [ ] Verify a horizontal thumbnail strip appears at the bottom.
- [ ] Click any thumbnail — viewer jumps to that page; the active thumb
  scales up and centers in the strip.
- [ ] Drag horizontally across the strip — strip scrubs (no jump-to-page
  on release because pointer moved past the click threshold).
- [ ] Scroll the strip with the mousewheel (vertical wheel deltas → horiz
  scroll) when the cursor is over the strip.
- [ ] Hide the strip via the toolbar toggle. Reload — toggle persists.

## 8. PDF tint inheritance

- [ ] Switch theme to **Sepia** (or any preset whose `pdfTint` is `sepia`).
- [ ] Open a PDF — page renders with the sepia tint applied via the
  `[data-pdf-tint="sepia"]` filter cascade.
- [ ] Open Settings → **PDF Viewer** tab. Toggle **Override theme PDF
  tint** on, pick **Dark**. Confirm: PDF tint switches to dark immediately.
- [ ] Toggle override off — tint snaps back to whatever the active theme
  declares (sepia in this case).

## 9. BYOK + AI fallback

- [ ] Open Settings → **AI Keys** tab.
- [ ] Paste a real Anthropic key (`sk-ant-…`). Click **Test**. Confirm a
  green ✓ with a latency badge.
- [ ] Switch active provider to Anthropic. Open any book. Click the AI
  panel **Summarize** button. Confirm a response streams back from the
  provider directly (no backend hop).
- [ ] Click **Clear all keys**. Confirm keys disappear from inputs.
- [ ] Switch active provider back to **Use server**. If not signed in,
  click sign-in and complete the Google flow. Confirm AI summary works
  via the server fallback.

## 10. Settings tab list

- [ ] Open Settings. Confirm the sidebar shows exactly four tabs in this
  order: **Themes**, **Reader**, **AI Keys**, **PDF Viewer**.
- [ ] Confirm there is no **Appearance** tab anywhere.

---

When all 10 sections pass, the build is green for release.
