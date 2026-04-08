import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { LoadedBook } from "../hooks/useBook";
import { ReadingPosition, ReaderSettings, getBook } from "../lib/storage";

interface ReaderProps {
  book: LoadedBook;
  position: ReadingPosition | null;
  settings: ReaderSettings;
  onPositionChange: (chapterIndex: number, scrollOffset: number, percentage: number) => void;
  onTextSelect: (text: string, context: string) => void;
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

export default function Reader({ book, position, settings, onPositionChange, onTextSelect }: ReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const [showNav, setShowNav] = useState(false);

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
        onPositionChange={onPositionChange}
      />
    );
  }

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

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length > 0) onTextSelect(text, plainText.slice(0, 2000));
  }, [plainText, onTextSelect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToChapter(chapterIndex - 1);
      if (e.key === "ArrowRight") goToChapter(chapterIndex + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chapterIndex, goToChapter]);

  const hasPrev = chapterIndex > 0;
  const hasNext = chapterIndex < totalSections - 1;
  const displayLabel = cleanChapterLabel(chapterLabel) || `Chapter ${chapterIndex + 1}`;

  return (
    <div className="flex flex-col h-full bg-cream text-clay-black relative">
      <div
        ref={contentRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto"
        style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight, fontFamily: settings.fontFamily }}
      >
        <div className="max-w-2xl mx-auto px-6 pt-12 pb-4">
          <p className="clay-label mb-1">{displayLabel}</p>
          <p className="text-sm text-silver">{readingTime} min read</p>
        </div>

        <div className="max-w-2xl mx-auto px-6 pb-28">
          <div className="prose-reader" dangerouslySetInnerHTML={{ __html: content }} />
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
    </div>
  );
}

/* ── Canvas-based PDF Viewer ── */

function PdfViewer({
  bookHash,
  initialPage,
  onPositionChange,
}: {
  bookHash: string;
  initialPage: number;
  onPositionChange: (chapterIndex: number, scrollOffset: number, percentage: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const startPage = Math.max(1, initialPage);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [totalPages, setTotalPages] = useState(0);
  const [inputValue, setInputValue] = useState(String(startPage));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const currentPageRef = useRef(startPage);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.25;

  // Load PDF via pdf.js from IndexedDB
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof pdfjsLib === "undefined") {
          setError("PDF engine not loaded");
          setLoading(false);
          return;
        }

        if (typeof chrome !== "undefined" && chrome.runtime) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
        }

        const data = await getBook(bookHash);
        if (!data || cancelled) { setLoading(false); return; }

        const pdf = await pdfjsLib.getDocument({
          data: data.slice(0),
          isEvalSupported: false,
        }).promise;

        if (cancelled) return;
        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);
        if (startPage > pdf.numPages) {
          setCurrentPage(1);
          setInputValue("1");
          currentPageRef.current = 1;
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("PDF load error:", err);
          setError("Failed to load PDF");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [bookHash, startPage]);

  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdf.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const containerWidth = container.clientWidth - 48;
      const fitScale = Math.max(0.5, containerWidth / unscaledViewport.width);
      const scale = fitScale * zoom;
      const viewport = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelled") console.error("Render error:", err);
    }
  }, [currentPage, zoom]);

  useEffect(() => {
    if (!loading && pdfRef.current) renderPage();
  }, [loading, currentPage, renderPage]);

  // Re-render on container resize (debounced to survive CSS transitions)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading) return;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => renderPage(), 300);
    });
    ro.observe(container);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [loading, renderPage]);

  const savePage = useCallback(
    (page: number) => {
      currentPageRef.current = page;
      const pct = totalPages > 0 ? (page / totalPages) * 100 : 0;
      onPositionChange(page - 1, 0, pct);
    },
    [totalPages, onPositionChange]
  );

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages || 1));
      setCurrentPage(clamped);
      setInputValue(String(clamped));
      currentPageRef.current = clamped;
      savePage(clamped);
    },
    [totalPages, savePage]
  );

  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goToPage(currentPageRef.current - 1); }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); goToPage(currentPageRef.current + 1); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); zoomOut(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goToPage, zoomIn, zoomOut, zoomReset]);

  // Auto-save on close / hide
  useEffect(() => {
    const onUnload = () => savePage(currentPageRef.current);
    const onVisChange = () => { if (document.hidden) savePage(currentPageRef.current); };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [savePage]);

  const handleInputBlur = () => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1) goToPage(page);
    else setInputValue(String(currentPage));
  };

  const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-cream items-center justify-center">
        <div className="w-6 h-6 border-2 border-clay-black border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-silver mt-3">Loading PDF&hellip;</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-cream items-center justify-center px-6">
        <p className="text-sm text-pomegranate-400 mb-2">{error}</p>
        <p className="text-xs text-silver text-center">Try reloading the extension or re-importing the PDF.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-cream">
      {/* Page controls */}
      <div className="flex items-center justify-center px-4 py-2 border-b border-oat gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
            title="Previous page (←)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3L4 7l5 4" />
            </svg>
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="w-14 text-center text-xs font-medium bg-transparent border border-oat rounded-[8px] py-1 focus:outline-none focus:border-matcha-600 transition-colors tabular-nums"
              min={1}
              max={totalPages}
            />
            <span className="text-silver whitespace-nowrap">/ {totalPages}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
            title="Next page (→)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l5 4-5 4" />
            </svg>
          </button>

          <div className="w-px h-5 bg-oat mx-0.5" />
          <span className="text-[11px] text-silver tabular-nums">{pct}%</span>

          <div className="w-px h-5 bg-oat mx-0.5" />

          <button
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
            title="Zoom out (Ctrl −)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7h8" />
            </svg>
          </button>

          <button
            onClick={zoomReset}
            className="text-[11px] text-silver tabular-nums hover:text-clay-black transition-colors min-w-[3rem] text-center"
            title="Reset zoom (Ctrl 0)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="clay-btn-white !p-1.5 !rounded-[8px] disabled:opacity-20"
            title="Zoom in (Ctrl +)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 3v8M3 7h8" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center py-6 px-6"
        style={{ background: "var(--oat, #e8e5e0)" }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) zoomIn();
            else if (e.deltaY > 0) zoomOut();
          }
        }}
      >
        <canvas ref={canvasRef} className="shadow-lg rounded-sm" />
      </div>
    </div>
  );
}
