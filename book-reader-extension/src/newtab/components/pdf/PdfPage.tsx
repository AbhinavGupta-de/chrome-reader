import React, { useRef, useEffect, memo } from "react";
import type { PdfColorMode } from "./PdfViewer";
import { renderPdfHighlights, clearPdfHighlights } from "../../lib/highlights/pdfRender";
import "./pdfTextLayer.css";

interface PdfPageProps {
  pdfDoc: any;
  pageNumber: number;
  zoom: number;
  colorMode: PdfColorMode;
  maxWidth: number;
  highlights?: import("../../lib/highlights/types").Highlight[];
  onHighlightClick?: (id: string, rect: DOMRect) => void;
}

const COLOR_FILTERS: Record<PdfColorMode, string> = {
  normal: "none",
  dark: "invert(0.88) hue-rotate(180deg)",
  sepia: "sepia(0.3) brightness(0.95)",
};

function isCancellation(err: any): boolean {
  if (!err) return false;
  if (err.name === "RenderingCancelled") return true;
  if (typeof err.message === "string" && /cancel/i.test(err.message)) return true;
  return false;
}

const PdfPage = memo(function PdfPage({ pdfDoc, pageNumber, zoom, colorMode, maxWidth, highlights = [], onHighlightClick }: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const textTaskRef = useRef<any>(null);

  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const onHighlightClickRef = useRef(onHighlightClick);
  onHighlightClickRef.current = onHighlightClick;

  useEffect(() => {
    let cancelled = false;

    const cancelTasks = () => {
      if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} renderTaskRef.current = null; }
      if (textTaskRef.current) { try { textTaskRef.current.cancel(); } catch {} textTaskRef.current = null; }
    };

    cancelTasks();

    const render = async () => {
      const canvas = canvasRef.current;
      if (!pdfDoc || !canvas || maxWidth <= 0 || cancelled) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const unscaledVp = page.getViewport({ scale: 1 });
        const fitScale = maxWidth / unscaledVp.width;
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
        if (cancelled) return;
        renderTaskRef.current = null;

        const tlEl = textLayerRef.current;
        if (tlEl && tlEl.isConnected && !cancelled && typeof pdfjsLib.renderTextLayer === "function") {
          try {
            tlEl.innerHTML = "";
            tlEl.style.width = `${Math.floor(viewport.width)}px`;
            tlEl.style.height = `${Math.floor(viewport.height)}px`;
            tlEl.style.setProperty("--scale-factor", String(scale));

            const textContent = await page.getTextContent();
            if (cancelled || !tlEl.isConnected) return;

            const textTask = pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: tlEl,
              viewport,
              textDivs: [],
            });
            textTaskRef.current = textTask;
            await textTask.promise;
            textTaskRef.current = null;

            if (wrapperRef.current && tlEl) {
              const visible = (highlightsRef.current ?? []).filter(
                (h) => h.anchor.chapterIndex === pageNumber - 1
              );
              renderPdfHighlights(
                wrapperRef.current,
                tlEl,
                visible,
                onHighlightClickRef.current ?? (() => {})
              );
            }
          } catch (textErr: any) {
            if (!isCancellation(textErr)) {
              console.warn("Text layer skipped:", textErr?.message);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled && !isCancellation(err)) {
          console.error("Page render error:", err?.message ?? err);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      cancelTasks();
    };
  }, [pdfDoc, pageNumber, zoom, maxWidth]);

  // Re-render highlight overlays when highlights change (without rerunning canvas/text-layer rendering)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const tl = textLayerRef.current;
    if (!wrapper || !tl) return;
    if (tl.children.length === 0) return;
    const visible = highlights.filter((h) => h.anchor.chapterIndex === pageNumber - 1);
    renderPdfHighlights(wrapper, tl, visible, onHighlightClick ?? (() => {}));
    return () => {
      if (wrapperRef.current) clearPdfHighlights(wrapperRef.current);
    };
  }, [highlights, pageNumber, onHighlightClick]);

  const filter = COLOR_FILTERS[colorMode];

  return (
    <div
      ref={wrapperRef}
      className="pdf-page-wrapper relative inline-block"
      data-page={pageNumber}
      style={{ filter: filter !== "none" ? filter : undefined }}
    >
      <canvas ref={canvasRef} className="block rounded-sm" />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
});

export default PdfPage;
