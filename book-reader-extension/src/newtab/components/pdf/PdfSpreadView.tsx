import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import PdfPage from "./PdfPage";
import type { PdfColorMode } from "./PdfViewer";

interface PdfSpreadViewProps {
  pdfDoc: any;
  totalPages: number;
  currentPage: number;
  zoom: number;
  colorMode: PdfColorMode;
  onPageChange: (page: number, scrollRatio: number) => void;
  initialScrollOffset: number;
  highlights?: import("../../lib/highlights/types").Highlight[];
  onHighlightClick?: (id: string, rect: DOMRect) => void;
}

interface SpreadRow {
  pages: number[];
  startPage: number;
}

const BUFFER_ROWS = 2;
const ROW_GAP = 12;
const NAV_LOCK_MS = 700;

function buildSpreads(totalPages: number): SpreadRow[] {
  const rows: SpreadRow[] = [];
  if (totalPages <= 0) return rows;
  rows.push({ pages: [1], startPage: 1 });
  for (let i = 2; i <= totalPages; i += 2) {
    if (i + 1 <= totalPages) {
      rows.push({ pages: [i, i + 1], startPage: i });
    } else {
      rows.push({ pages: [i], startPage: i });
    }
  }
  return rows;
}

export default function PdfSpreadView({
  pdfDoc,
  totalPages,
  currentPage,
  zoom,
  colorMode,
  onPageChange,
  initialScrollOffset,
  highlights = [],
  onHighlightClick,
}: PdfSpreadViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRows, setVisibleRows] = useState<Set<number>>(() => new Set([0]));
  const [pageAspect, setPageAspect] = useState(11 / 8.5);
  const [containerWidth, setContainerWidth] = useState(0);
  const internalPageRef = useRef(currentPage);
  const rowRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initialScrollDone = useRef(false);
  const isNavigatingRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const spreads = useMemo(() => buildSpreads(totalPages), [totalPages]);
  const spreadsRef = useRef(spreads);
  spreadsRef.current = spreads;

  useEffect(() => {
    if (!pdfDoc) return;
    (async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        setPageAspect(vp.height / vp.width);
      } catch {}
    })();
  }, [pdfDoc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const useNarrow = containerWidth > 0 && containerWidth < 768;
  const singlePageWidth = useNarrow
    ? Math.max(200, containerWidth - 48)
    : Math.max(200, (containerWidth - 64) / 2);

  const estimatedRowHeight = useMemo(
    () => Math.round(singlePageWidth * zoom * pageAspect),
    [singlePageWidth, zoom, pageAspect]
  );

  // IntersectionObserver for pre-loading (which rows to render)
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!scrollRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        setVisibleRows((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const rowIdx = Number(entry.target.getAttribute("data-row"));
            if (isNaN(rowIdx)) continue;
            if (entry.isIntersecting) next.add(rowIdx);
            else next.delete(rowIdx);
          }
          return next;
        });
      },
      { root: scrollRef.current, rootMargin: "400px 0px" }
    );

    observerRef.current = obs;
    rowRefsMap.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = setupObserver();
    return cleanup;
  }, [setupObserver, totalPages]);

  const setRowRef = useCallback((rowIdx: number, el: HTMLDivElement | null) => {
    if (el) {
      rowRefsMap.current.set(rowIdx, el);
      observerRef.current?.observe(el);
    } else {
      const prev = rowRefsMap.current.get(rowIdx);
      if (prev) observerRef.current?.unobserve(prev);
      rowRefsMap.current.delete(rowIdx);
    }
  }, []);

  // Scroll-based page tracking using getBoundingClientRect for reliable coords
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    let ticking = false;
    const detectPage = () => {
      if (isNavigatingRef.current || !initialScrollDone.current) return;
      const containerTop = scrollEl.getBoundingClientRect().top;
      let bestRowIdx = -1;
      let bestTop = -Infinity;
      for (const [rowIdx, el] of rowRefsMap.current) {
        const elTop = el.getBoundingClientRect().top - containerTop;
        if (elTop <= 80 && elTop > bestTop) {
          bestTop = elTop;
          bestRowIdx = rowIdx;
        }
      }
      if (bestRowIdx >= 0) {
        const row = spreadsRef.current[bestRowIdx];
        if (row) {
          let scrollRatio = 0;
          const rowEl = rowRefsMap.current.get(bestRowIdx);
          if (rowEl) {
            const rowHeight = rowEl.clientHeight;
            if (rowHeight > 0) {
              const elTop = rowEl.getBoundingClientRect().top - containerTop;
              scrollRatio = Math.max(0, Math.min(1, -elTop / rowHeight));
            }
          }
          internalPageRef.current = row.startPage;
          onPageChangeRef.current(row.startPage, scrollRatio);
        }
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          detectPage();
          ticking = false;
        });
      }
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  const findRowForPage = useCallback(
    (page: number) => spreads.findIndex((r) => r.pages.includes(page)),
    [spreads]
  );

  // Scroll to page when currentPage changes from toolbar / thumbnails
  useEffect(() => {
    if (currentPage !== internalPageRef.current) {
      isNavigatingRef.current = true;
      clearTimeout(navTimerRef.current);

      const distance = Math.abs(currentPage - internalPageRef.current);
      const behavior: ScrollBehavior = distance <= 3 ? "smooth" : "instant";

      // Pre-seed visible rows so the target renders immediately
      if (distance > 3) {
        const targetRowIdx = findRowForPage(currentPage);
        if (targetRowIdx >= 0) {
          setVisibleRows((prev) => {
            const next = new Set(prev);
            for (let i = Math.max(0, targetRowIdx - BUFFER_ROWS); i <= Math.min(spreads.length - 1, targetRowIdx + BUFFER_ROWS); i++) {
              next.add(i);
            }
            return next;
          });
        }
      }

      const rowIdx = findRowForPage(currentPage);
      const el = rowRefsMap.current.get(rowIdx);
      if (el) el.scrollIntoView({ behavior, block: "start" });
      internalPageRef.current = currentPage;

      const lockMs = behavior === "smooth" ? NAV_LOCK_MS : 100;
      navTimerRef.current = setTimeout(() => {
        isNavigatingRef.current = false;
      }, lockMs);
    }
  }, [currentPage, findRowForPage, spreads.length]);

  // Initial scroll to saved position
  useEffect(() => {
    if (initialScrollDone.current || containerWidth <= 0) return;
    const rowIdx = findRowForPage(currentPage);
    const el = rowRefsMap.current.get(rowIdx);
    if (el) {
      isNavigatingRef.current = true;
      el.scrollIntoView({ block: "start" });
      if (initialScrollOffset > 0 && scrollRef.current && el.clientHeight > 0) {
        scrollRef.current.scrollTop += Math.round(initialScrollOffset * el.clientHeight);
      }
      initialScrollDone.current = true;
      setTimeout(() => { isNavigatingRef.current = false; }, 500);
    }
  }, [containerWidth, currentPage, findRowForPage, initialScrollOffset]);

  // Re-center after zoom or row-height changes (skip during initial scroll)
  const prevRowHeightRef = useRef(estimatedRowHeight);
  useEffect(() => {
    const isHeightChange = prevRowHeightRef.current !== estimatedRowHeight;
    prevRowHeightRef.current = estimatedRowHeight;
    const timer = setTimeout(() => {
      if (isNavigatingRef.current) return;
      if (!initialScrollDone.current) return;
      const rowIdx = findRowForPage(internalPageRef.current);
      const el = rowRefsMap.current.get(rowIdx);
      if (el) el.scrollIntoView({ block: "start" });
    }, isHeightChange ? 20 : 100);
    return () => clearTimeout(timer);
  }, [zoom, findRowForPage, estimatedRowHeight]);

  useEffect(() => {
    return () => clearTimeout(navTimerRef.current);
  }, []);

  const renderRowSet = useMemo(() => {
    const set = new Set<number>();
    for (const r of visibleRows) {
      for (let i = Math.max(0, r - BUFFER_ROWS); i <= Math.min(spreads.length - 1, r + BUFFER_ROWS); i++) {
        set.add(i);
      }
    }
    return set;
  }, [visibleRows, spreads.length]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto"
      style={{ background: "var(--oat, #e8e5e0)" }}
    >
      {containerWidth > 0 && (
        <div className="flex flex-col items-center py-4" style={{ gap: `${ROW_GAP}px` }}>
          {spreads.map((row, rowIdx) => {
            const shouldRender = renderRowSet.has(rowIdx);
            return (
              <div
                key={rowIdx}
                ref={(el) => setRowRef(rowIdx, el)}
                data-row={rowIdx}
                className={`flex justify-center ${useNarrow ? "flex-col items-center gap-3" : "gap-4"}`}
                style={{ minHeight: `${estimatedRowHeight}px` }}
              >
                {shouldRender &&
                  row.pages.map((pageNum) => (
                    <PdfPage
                      key={pageNum}
                      pdfDoc={pdfDoc}
                      pageNumber={pageNum}
                      zoom={zoom}
                      colorMode={colorMode}
                      maxWidth={singlePageWidth}
                      highlights={highlights}
                      onHighlightClick={onHighlightClick}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
