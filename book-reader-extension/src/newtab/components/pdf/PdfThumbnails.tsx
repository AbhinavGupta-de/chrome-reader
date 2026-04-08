import React, { useRef, useEffect, useState, useCallback, memo } from "react";

interface PdfThumbnailsProps {
  pdfDoc: any;
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const THUMB_WIDTH = 120;

const ThumbnailItem = memo(function ThumbnailItem({
  pdfDoc,
  pageNumber,
  isActive,
  onSelect,
  isVisible,
}: {
  pdfDoc: any;
  pageNumber: number;
  isActive: boolean;
  onSelect: (page: number) => void;
  isVisible: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!isVisible || renderedRef.current || !canvasRef.current || !pdfDoc) return;
    renderedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / vp.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelled") console.error("Thumbnail error:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [isVisible, pdfDoc, pageNumber]);

  return (
    <button
      onClick={() => onSelect(pageNumber)}
      className={`block w-full p-1.5 rounded-[8px] border-2 transition-all ${
        isActive
          ? "border-matcha-600 bg-matcha-600/10"
          : "border-transparent hover:border-oat"
      }`}
    >
      <canvas
        ref={canvasRef}
        className="w-full bg-clay-white rounded-sm"
        style={{ aspectRatio: "8.5 / 11" }}
      />
      <span className={`text-[10px] mt-1 block text-center tabular-nums ${isActive ? "text-matcha-600 font-semibold" : "text-silver"}`}>
        {pageNumber}
      </span>
    </button>
  );
});

export default function PdfThumbnails({ pdfDoc, totalPages, currentPage, onPageSelect }: PdfThumbnailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleThumbs, setVisibleThumbs] = useState<Set<number>>(() => new Set());
  const thumbRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!containerRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        setVisibleThumbs((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = Number(entry.target.getAttribute("data-thumb"));
            if (!pageNum) continue;
            if (entry.isIntersecting) next.add(pageNum);
            else next.delete(pageNum);
          }
          return next;
        });
      },
      { root: containerRef.current, rootMargin: "200px 0px" }
    );

    observerRef.current = obs;
    thumbRefsMap.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = setupObserver();
    return cleanup;
  }, [setupObserver, totalPages]);

  const setThumbRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      thumbRefsMap.current.set(pageNum, el);
      observerRef.current?.observe(el);
    } else {
      const prev = thumbRefsMap.current.get(pageNum);
      if (prev) observerRef.current?.unobserve(prev);
      thumbRefsMap.current.delete(pageNum);
    }
  }, []);

  useEffect(() => {
    const el = thumbRefsMap.current.get(currentPage);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="w-[160px] flex-shrink-0 overflow-y-auto border-r border-oat p-2"
      style={{ background: "var(--cream)" }}
    >
      {Array.from({ length: totalPages }, (_, i) => {
        const pageNum = i + 1;
        return (
          <div key={pageNum} ref={(el) => setThumbRef(pageNum, el)} data-thumb={pageNum}>
            <ThumbnailItem
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              isActive={currentPage === pageNum}
              onSelect={onPageSelect}
              isVisible={visibleThumbs.has(pageNum)}
            />
          </div>
        );
      })}
    </div>
  );
}
