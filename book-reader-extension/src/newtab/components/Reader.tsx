import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { LoadedBook } from "../hooks/useBook";
import { ReadingPosition, ReaderSettings } from "../lib/storage";
import PdfViewer from "./pdf/PdfViewer";
import { useSelection } from "../hooks/useSelection";
import SelectionToolbar, { ToolbarAction, HighlightColor } from "./SelectionToolbar";
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
  aiAvailable: boolean;
}

function estimateReadingTime(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 230));
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function cleanChapterLabel(label: string): string {
  if (/\.(x?html?|xml|htm)$/i.test(label)) return "";
  if (/^[A-Z0-9!@#$%^&*()\-_=+{}\[\]|\\;:'",.<>?/~`]+$/i.test(label) && label.length > 30) return "";
  return label.trim();
}

export default function Reader({
  book, position, settings, highlights, onPositionChange, onSelectionAction, onHighlightClick, hasExplain, aiAvailable,
}: ReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const [showNav, setShowNav] = useState(false);

  const chapterIndex = position?.chapterIndex ?? 0;

  const { content, totalSections, chapterLabel, plainText } = useMemo(() => {
    if (book.format === "epub" && book.epub) {
      const ch = book.epub.chapters[chapterIndex];
      return {
        content: ch?.content ?? "",
        totalSections: book.epub.chapters.length,
        chapterLabel: ch?.label ?? `Chapter ${chapterIndex + 1}`,
        plainText: stripHtml(ch?.content ?? ""),
      };
    }
    if (book.format === "txt" && book.txt) {
      const chunk = book.txt.chunks[chapterIndex];
      return {
        content: `<div style="white-space: pre-wrap;">${(chunk ?? "").replace(/</g, "&lt;")}</div>`,
        totalSections: book.txt.chunks.length,
        chapterLabel: `Section ${chapterIndex + 1} of ${book.txt.chunks.length}`,
        plainText: chunk ?? "",
      };
    }
    return { content: "", totalSections: 0, chapterLabel: "", plainText: "" };
  }, [book, chapterIndex]);

  const readingTime = useMemo(() => estimateReadingTime(plainText), [plainText]);

  useEffect(() => {
    if (!contentRef.current || !position || restoredRef.current) return;
    contentRef.current.scrollTop = position.scrollOffset;
    restoredRef.current = true;
  }, [content, position]);

  useEffect(() => { restoredRef.current = false; }, [chapterIndex]);

  useEffect(() => {
    if (book.format === "pdf") return;
    const el = proseRef.current;
    if (!el) return;
    const handle = requestAnimationFrame(() => {
      if (!proseRef.current) return;
      renderHighlights(proseRef.current, plainText, chapterIndex, highlights, onHighlightClick);
    });
    return () => {
      cancelAnimationFrame(handle);
      if (proseRef.current) clearHighlights(proseRef.current);
    };
  }, [content, highlights, plainText, chapterIndex, book.format, onHighlightClick]);

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const el = contentRef.current!;
      const scrollOffset = el.scrollTop;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const chapterProgress = maxScroll > 0 ? scrollOffset / maxScroll : 0;
      const pct = totalSections > 0 ? ((chapterIndex + chapterProgress) / totalSections) * 100 : 0;
      onPositionChange(chapterIndex, scrollOffset, pct);
    }, 300);
  }, [chapterIndex, totalSections, onPositionChange]);

  const goToChapter = useCallback((index: number) => {
    if (index < 0 || index >= totalSections) return;
    onPositionChange(index, 0, (index / totalSections) * 100);
    restoredRef.current = false;
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [totalSections, onPositionChange]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToChapter(chapterIndex - 1);
      if (e.key === "ArrowRight") goToChapter(chapterIndex + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chapterIndex, goToChapter]);

  if (book.format === "pdf") {
    if (!position) {
      return (
        <div className="flex flex-col h-full bg-cream items-center justify-center">
          <div className="w-6 h-6 border-2 border-clay-black border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <PdfViewer
        bookHash={book.hash}
        initialPage={position.chapterIndex + 1}
        initialScrollOffset={position.scrollOffset}
        settings={settings}
        onPositionChange={onPositionChange}
      />
    );
  }

  const hasPrev = chapterIndex > 0;
  const hasNext = chapterIndex < totalSections - 1;
  const displayLabel = cleanChapterLabel(chapterLabel) || `Chapter ${chapterIndex + 1}`;

  return (
    <div className="flex flex-col h-full bg-cream text-clay-black relative">
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, fontFamily: settings.fontFamily }}
      >
        <div className="max-w-2xl mx-auto px-6 pt-12 pb-4">
          <p className="clay-label mb-1">{displayLabel}</p>
          <p className="text-sm text-silver">{readingTime} min read</p>
        </div>

        <div className="max-w-2xl mx-auto px-6 pb-28">
          <div ref={proseRef} className="prose-reader" dangerouslySetInnerHTML={{ __html: content }} />
        </div>

        {content && (
          <div className="max-w-sm mx-auto px-6 pb-16 text-center">
            <hr className="clay-divider w-16 mx-auto mb-6" />
            <p className="text-xs text-silver mb-4">End of {displayLabel.toLowerCase()}</p>
            {hasNext && (
              <button onClick={() => goToChapter(chapterIndex + 1)} className="clay-btn-solid text-sm">
                Continue reading &rarr;
              </button>
            )}
          </div>
        )}
      </div>

      {hasPrev && (
        <button
          onClick={() => goToChapter(chapterIndex - 1)}
          className="clay-btn-white absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 !p-0 !rounded-[12px] flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4L6 9l5 5" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          onClick={() => goToChapter(chapterIndex + 1)}
          className="clay-btn-white absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 !p-0 !rounded-[12px] flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4l5 5-5 5" />
          </svg>
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-5 pointer-events-none">
        <div className="pointer-events-auto">
          {!showNav ? (
            <button
              onClick={() => setShowNav(true)}
              className="clay-btn-white !rounded-[1584px] text-xs !py-2 !px-5"
            >
              {chapterIndex + 1} / {totalSections} &middot; {Math.round(position?.percentage ?? 0)}%
            </button>
          ) : (
            <div
              className="clay-card flex items-center gap-3 px-4 py-2.5 !rounded-[1584px]"
              onMouseLeave={() => setShowNav(false)}
            >
              <button
                onClick={() => goToChapter(chapterIndex - 1)}
                disabled={!hasPrev}
                className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3L4 7l5 4" />
                </svg>
              </button>
              <input
                type="range" min={0} max={Math.max(totalSections - 1, 1)} value={chapterIndex}
                onChange={(e) => goToChapter(Number(e.target.value))}
                className="w-44 accent-[#078a52]"
              />
              <button
                onClick={() => goToChapter(chapterIndex + 1)}
                disabled={!hasNext}
                className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3l5 4-5 4" />
                </svg>
              </button>
              <span className="text-xs tabular-nums text-silver min-w-[3rem] text-center">
                {Math.round(position?.percentage ?? 0)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {selection && (
        <SelectionToolbar rect={selection.rect} hasExplain={hasExplain} aiAvailable={aiAvailable} onAction={dispatchAction} />
      )}
    </div>
  );
}
