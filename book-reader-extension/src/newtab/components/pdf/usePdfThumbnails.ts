import { useCallback, useEffect, useRef, useState } from "react";

/**
 * usePdfThumbnails — LRU cache of rendered <canvas> thumbnails keyed by page number.
 *
 * Each cached canvas is rendered once at THUMBNAIL_SCALE and reused for the lifetime
 * of the cache slot. When the cache exceeds MAX_CACHED_THUMBNAILS, the oldest entry
 * (Map insertion order) is evicted: its canvas is sized to 0x0 to release the bitmap
 * memory before the entry is dropped.
 *
 * The hook intentionally returns the underlying HTMLCanvasElement so the consumer can
 * append it directly into the DOM strip — a single canvas per page is sufficient,
 * avoiding clones.
 */

// pdfjs PDFDocumentProxy / PDFPageProxy aren't exported directly from the global
// `pdfjsLib` (a UMD bundle), so we describe the narrow surface we use.
export interface PdfPageViewportLike {
  width: number;
  height: number;
}

export interface PdfPageProxyLike {
  getViewport(params: { scale: number }): PdfPageViewportLike;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: PdfPageViewportLike }): {
    promise: Promise<void>;
    cancel?: () => void;
  };
}

export interface PdfDocumentProxyLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxyLike>;
}

export const MAX_CACHED_THUMBNAILS = 30;
export const THUMBNAIL_SCALE = 0.2;

interface UsePdfThumbnailsApi {
  /**
   * Returns the cached canvas for `pageNumber` if rendered, else `null`.
   * Pure read — does NOT trigger a render.
   */
  getCachedThumbnail: (pageNumber: number) => HTMLCanvasElement | null;
  /**
   * Ensures a canvas is rendered for `pageNumber`. Resolves with the canvas.
   * If already cached, resolves immediately with the cached canvas (also marking it
   * as most-recently-used so it survives eviction).
   */
  ensureThumbnailRendered: (pageNumber: number) => Promise<HTMLCanvasElement | null>;
  /** Number of canvases currently cached. Exposed for tests. */
  cachedThumbnailCount: () => number;
  /**
   * Monotonic counter incremented each time `pdfDoc` swaps to a new document.
   * Consumers can use this as a React `key` (or effect dependency) to force
   * thumbnail slots to rebind to the new document — the cached `ensureThumbnailRendered`
   * / `getCachedThumbnail` callbacks are stable across pdfDoc swaps and would
   * otherwise leave consumers showing zeroed canvases from the prior doc.
   */
  documentGeneration: number;
}

function evictOldestThumbnail(cachedCanvasByPageNumber: Map<number, HTMLCanvasElement>): void {
  const oldestKey = cachedCanvasByPageNumber.keys().next().value;
  if (oldestKey === undefined) return;
  const canvas = cachedCanvasByPageNumber.get(oldestKey);
  if (canvas) releaseCanvasBitmap(canvas);
  cachedCanvasByPageNumber.delete(oldestKey);
}

function releaseCanvasBitmap(canvas: HTMLCanvasElement): void {
  // Setting both dimensions to 0 forces the browser to drop the backing bitmap
  // immediately rather than waiting for GC to reclaim it.
  canvas.width = 0;
  canvas.height = 0;
}

function markRecentlyUsed(
  cachedCanvasByPageNumber: Map<number, HTMLCanvasElement>,
  pageNumber: number,
  canvas: HTMLCanvasElement
): void {
  cachedCanvasByPageNumber.delete(pageNumber);
  cachedCanvasByPageNumber.set(pageNumber, canvas);
}

async function renderPageToCanvas(
  pdfDoc: PdfDocumentProxyLike,
  pageNumber: number
): Promise<HTMLCanvasElement | null> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) return null;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

export function usePdfThumbnails(pdfDoc: PdfDocumentProxyLike | null): UsePdfThumbnailsApi {
  const cachedCanvasByPageNumberRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const inFlightRenderByPageNumberRef = useRef<Map<number, Promise<HTMLCanvasElement | null>>>(
    new Map()
  );
  const pdfDocRef = useRef<PdfDocumentProxyLike | null>(pdfDoc);
  pdfDocRef.current = pdfDoc;
  const [documentGeneration, setDocumentGeneration] = useState<number>(0);
  const isFirstPdfDocEffectRunRef = useRef<boolean>(true);

  // When the pdfDoc changes, invalidate all cached canvases — they belong to the previous doc.
  // We also bump documentGeneration so consumers can rebind their thumbnail slots; without
  // this the stable callbacks would leave child effects unaware of the swap.
  useEffect(() => {
    const cache = cachedCanvasByPageNumberRef.current;
    cache.forEach((canvas) => releaseCanvasBitmap(canvas));
    cache.clear();
    inFlightRenderByPageNumberRef.current.clear();
    if (isFirstPdfDocEffectRunRef.current) {
      isFirstPdfDocEffectRunRef.current = false;
      return;
    }
    setDocumentGeneration((previous) => previous + 1);
  }, [pdfDoc]);

  // Release all canvases on unmount to avoid retained bitmap memory.
  useEffect(() => {
    const cache = cachedCanvasByPageNumberRef.current;
    return () => {
      cache.forEach((canvas) => releaseCanvasBitmap(canvas));
      cache.clear();
      inFlightRenderByPageNumberRef.current.clear();
    };
  }, []);

  const getCachedThumbnail = useCallback((pageNumber: number): HTMLCanvasElement | null => {
    return cachedCanvasByPageNumberRef.current.get(pageNumber) ?? null;
  }, []);

  const ensureThumbnailRendered = useCallback(
    async (pageNumber: number): Promise<HTMLCanvasElement | null> => {
      const cache = cachedCanvasByPageNumberRef.current;
      const existing = cache.get(pageNumber);
      if (existing) {
        markRecentlyUsed(cache, pageNumber, existing);
        return existing;
      }

      const inFlight = inFlightRenderByPageNumberRef.current.get(pageNumber);
      if (inFlight) return inFlight;

      const doc = pdfDocRef.current;
      if (!doc) return null;

      const renderPromise = (async () => {
        try {
          const canvas = await renderPageToCanvas(doc, pageNumber);
          if (!canvas) return null;
          // pdfDoc may have changed while we were rendering — discard if so.
          if (pdfDocRef.current !== doc) {
            releaseCanvasBitmap(canvas);
            return null;
          }
          cache.set(pageNumber, canvas);
          if (cache.size > MAX_CACHED_THUMBNAILS) {
            evictOldestThumbnail(cache);
          }
          return canvas;
        } finally {
          inFlightRenderByPageNumberRef.current.delete(pageNumber);
        }
      })();

      inFlightRenderByPageNumberRef.current.set(pageNumber, renderPromise);
      return renderPromise;
    },
    []
  );

  const cachedThumbnailCount = useCallback((): number => {
    return cachedCanvasByPageNumberRef.current.size;
  }, []);

  return {
    getCachedThumbnail,
    ensureThumbnailRendered,
    cachedThumbnailCount,
    documentGeneration,
  };
}
