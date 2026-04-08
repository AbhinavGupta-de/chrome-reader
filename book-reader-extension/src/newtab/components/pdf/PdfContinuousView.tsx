import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import PdfPage from "./PdfPage";
import type { PdfColorMode } from "./PdfViewer";

interface PdfContinuousViewProps {
  pdfDoc: any;
  totalPages: number;
  currentPage: number;
  zoom: number;
  colorMode: PdfColorMode;
  onPageChange: (page: number) => void;
}

const BUFFER_PAGES = 3;
const PAGE_GAP = 12;
const NAV_LOCK_MS = 700;

export default function PdfContinuousView({
  pdfDoc,
  totalPages,
  currentPage,
  zoom,
  colorMode,
  onPageChange,
}: PdfContinuousViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set([currentPage]));
  const [pageAspect, setPageAspect] = useState(11 / 8.5);
  const internalPageRef = useRef(currentPage);
  const pageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initialScrollDone = useRef(false);
  const isNavigatingRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageMaxWidth = Math.max(200, containerWidth - 48);

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

  const estimatedPageHeight = useMemo(
    () => Math.round(pageMaxWidth * zoom * pageAspect),
    [pageMaxWidth, zoom, pageAspect]
  );

  // IntersectionObserver for pre-loading (which pages to render)
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!scrollRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = Number(entry.target.getAttribute("data-page-wrapper"));
            if (!pageNum) continue;
            if (entry.isIntersecting) next.add(pageNum);
            else next.delete(pageNum);
          }
          return next;
        });
      },
      { root: scrollRef.current, rootMargin: "400px 0px" }
    );

    observerRef.current = obs;
    pageRefsMap.current.forEach((el) => obs.observe(el));

    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = setupObserver();
    return cleanup;
  }, [setupObserver, totalPages]);

  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefsMap.current.set(pageNum, el);
      observerRef.current?.observe(el);
    } else {
      const prev = pageRefsMap.current.get(pageNum);
      if (prev) observerRef.current?.unobserve(prev);
      pageRefsMap.current.delete(pageNum);
    }
  }, []);

  // Scroll-based page tracking using getBoundingClientRect for reliable coords
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    let ticking = false;
    const detectPage = () => {
      if (isNavigatingRef.current) return;
      const containerTop = scrollEl.getBoundingClientRect().top;
      let best = internalPageRef.current;
      let bestTop = -Infinity;
      for (const [pageNum, el] of pageRefsMap.current) {
        const elTop = el.getBoundingClientRect().top - containerTop;
        if (elTop <= 80 && elTop > bestTop) {
          bestTop = elTop;
          best = pageNum;
        }
      }
      if (best !== internalPageRef.current) {
        internalPageRef.current = best;
        onPageChangeRef.current(best);
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

  // Scroll to page when currentPage changes from toolbar / thumbnails
  useEffect(() => {
    if (currentPage !== internalPageRef.current) {
      isNavigatingRef.current = true;
      clearTimeout(navTimerRef.current);

      const distance = Math.abs(currentPage - internalPageRef.current);
      const behavior: ScrollBehavior = distance <= 3 ? "smooth" : "instant";

      // Pre-seed visible pages so the target renders immediately without waiting for IntersectionObserver
      if (distance > BUFFER_PAGES) {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (let i = Math.max(1, currentPage - BUFFER_PAGES); i <= Math.min(totalPages, currentPage + BUFFER_PAGES); i++) {
            next.add(i);
          }
          return next;
        });
      }

      const el = pageRefsMap.current.get(currentPage);
      if (el) {
        el.scrollIntoView({ behavior, block: "start" });
      }
      internalPageRef.current = currentPage;

      const lockMs = behavior === "smooth" ? NAV_LOCK_MS : 100;
      navTimerRef.current = setTimeout(() => {
        isNavigatingRef.current = false;
      }, lockMs);
    }
  }, [currentPage, totalPages]);

  // Initial scroll to saved position (instant, no animation)
  useEffect(() => {
    if (initialScrollDone.current || !scrollRef.current || containerWidth <= 0) return;
    const el = pageRefsMap.current.get(currentPage);
    if (el) {
      el.scrollIntoView({ block: "start" });
      initialScrollDone.current = true;
    }
  }, [containerWidth, currentPage]);

  // Re-center on current page after zoom changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = pageRefsMap.current.get(internalPageRef.current);
      if (el) el.scrollIntoView({ block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [zoom]);

  useEffect(() => {
    return () => clearTimeout(navTimerRef.current);
  }, []);

  const renderSet = useMemo(() => {
    const set = new Set<number>();
    for (const p of visiblePages) {
      for (let i = Math.max(1, p - BUFFER_PAGES); i <= Math.min(totalPages, p + BUFFER_PAGES); i++) {
        set.add(i);
      }
    }
    return set;
  }, [visiblePages, totalPages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto"
      style={{ background: "var(--oat, #e8e5e0)" }}
    >
      {containerWidth > 0 && (
        <div className="flex flex-col items-center py-4" style={{ gap: `${PAGE_GAP}px` }}>
          {Array.from({ length: totalPages }, (_, i) => {
            const pageNum = i + 1;
            const shouldRender = renderSet.has(pageNum);
            return (
              <div
                key={pageNum}
                ref={(el) => setPageRef(pageNum, el)}
                data-page-wrapper={pageNum}
                className="flex justify-center"
                style={{ minHeight: shouldRender ? undefined : `${estimatedPageHeight}px` }}
              >
                {shouldRender && (
                  <PdfPage
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    zoom={zoom}
                    colorMode={colorMode}
                    maxWidth={pageMaxWidth}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
