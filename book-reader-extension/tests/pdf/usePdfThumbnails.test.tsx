import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import {
  usePdfThumbnails,
  MAX_CACHED_THUMBNAILS,
  THUMBNAIL_SCALE,
  type PdfDocumentProxyLike,
  type PdfPageProxyLike,
} from "../../src/newtab/components/pdf/usePdfThumbnails";

interface FakePdfDocOptions {
  numPages?: number;
  renderDelayMs?: number;
  pageWidth?: number;
  pageHeight?: number;
}

function createFakePdfDoc(opts: FakePdfDocOptions = {}): {
  doc: PdfDocumentProxyLike;
  renderCallsByPage: Map<number, number>;
} {
  const numPages = opts.numPages ?? 100;
  const pageWidth = opts.pageWidth ?? 600;
  const pageHeight = opts.pageHeight ?? 800;
  const renderCallsByPage = new Map<number, number>();

  const doc: PdfDocumentProxyLike = {
    numPages,
    async getPage(pageNumber: number): Promise<PdfPageProxyLike> {
      return {
        getViewport({ scale }: { scale: number }) {
          return { width: pageWidth * scale, height: pageHeight * scale };
        },
        render() {
          renderCallsByPage.set(pageNumber, (renderCallsByPage.get(pageNumber) ?? 0) + 1);
          const promise = opts.renderDelayMs
            ? new Promise<void>((resolve) => setTimeout(resolve, opts.renderDelayMs))
            : Promise.resolve();
          return { promise };
        },
      };
    },
  };

  return { doc, renderCallsByPage };
}

beforeEach(() => {
  // jsdom does not implement HTMLCanvasElement#getContext by default — provide a minimal stub.
  HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D | null {
    return {} as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("usePdfThumbnails", () => {
  it("returns null from getCachedThumbnail before any render is ensured", () => {
    const { doc } = createFakePdfDoc();
    const { result } = renderHook(() => usePdfThumbnails(doc));

    expect(result.current.getCachedThumbnail(1)).toBeNull();
    expect(result.current.cachedThumbnailCount()).toBe(0);
  });

  it("renders a canvas when ensureThumbnailRendered is called and caches it", async () => {
    const { doc, renderCallsByPage } = createFakePdfDoc();
    const { result } = renderHook(() => usePdfThumbnails(doc));

    let rendered: HTMLCanvasElement | null = null;
    await act(async () => {
      rendered = await result.current.ensureThumbnailRendered(3);
    });

    expect(rendered).toBeInstanceOf(HTMLCanvasElement);
    expect(renderCallsByPage.get(3)).toBe(1);
    expect(result.current.getCachedThumbnail(3)).toBe(rendered);
    expect(result.current.cachedThumbnailCount()).toBe(1);
  });

  it("uses the configured THUMBNAIL_SCALE when rendering", async () => {
    const { doc } = createFakePdfDoc({ pageWidth: 1000, pageHeight: 2000 });
    const { result } = renderHook(() => usePdfThumbnails(doc));

    let canvas: HTMLCanvasElement | null = null;
    await act(async () => {
      canvas = await result.current.ensureThumbnailRendered(1);
    });

    expect(canvas!.width).toBe(Math.floor(1000 * THUMBNAIL_SCALE));
    expect(canvas!.height).toBe(Math.floor(2000 * THUMBNAIL_SCALE));
  });

  it("does not re-render a page that is already cached", async () => {
    const { doc, renderCallsByPage } = createFakePdfDoc();
    const { result } = renderHook(() => usePdfThumbnails(doc));

    await act(async () => {
      await result.current.ensureThumbnailRendered(5);
      await result.current.ensureThumbnailRendered(5);
    });

    expect(renderCallsByPage.get(5)).toBe(1);
  });

  it("dedupes concurrent renders of the same page into a single in-flight task", async () => {
    const { doc, renderCallsByPage } = createFakePdfDoc({ renderDelayMs: 5 });
    const { result } = renderHook(() => usePdfThumbnails(doc));

    await act(async () => {
      await Promise.all([
        result.current.ensureThumbnailRendered(7),
        result.current.ensureThumbnailRendered(7),
        result.current.ensureThumbnailRendered(7),
      ]);
    });

    expect(renderCallsByPage.get(7)).toBe(1);
  });

  it("evicts the oldest entry when the cache exceeds MAX_CACHED_THUMBNAILS", async () => {
    const { doc } = createFakePdfDoc({ numPages: MAX_CACHED_THUMBNAILS + 5 });
    const { result } = renderHook(() => usePdfThumbnails(doc));

    await act(async () => {
      for (let pageNumber = 1; pageNumber <= MAX_CACHED_THUMBNAILS + 1; pageNumber++) {
        await result.current.ensureThumbnailRendered(pageNumber);
      }
    });

    expect(result.current.cachedThumbnailCount()).toBe(MAX_CACHED_THUMBNAILS);
    // Page 1 was the first inserted — it should have been evicted.
    expect(result.current.getCachedThumbnail(1)).toBeNull();
    // Pages 2..MAX+1 should still be cached.
    expect(result.current.getCachedThumbnail(2)).not.toBeNull();
    expect(result.current.getCachedThumbnail(MAX_CACHED_THUMBNAILS + 1)).not.toBeNull();
  });

  it("treats a cache hit as a recency bump so re-accessed pages survive eviction", async () => {
    const { doc } = createFakePdfDoc({ numPages: MAX_CACHED_THUMBNAILS + 5 });
    const { result } = renderHook(() => usePdfThumbnails(doc));

    await act(async () => {
      for (let pageNumber = 1; pageNumber <= MAX_CACHED_THUMBNAILS; pageNumber++) {
        await result.current.ensureThumbnailRendered(pageNumber);
      }
      // Re-access page 1 — should bump it to most-recent.
      await result.current.ensureThumbnailRendered(1);
      // Now insert a new page; the oldest is page 2 (since 1 was bumped).
      await result.current.ensureThumbnailRendered(MAX_CACHED_THUMBNAILS + 1);
    });

    expect(result.current.getCachedThumbnail(1)).not.toBeNull();
    expect(result.current.getCachedThumbnail(2)).toBeNull();
  });

  it("releases evicted canvas bitmaps by zeroing dimensions", async () => {
    const { doc } = createFakePdfDoc({ numPages: MAX_CACHED_THUMBNAILS + 2 });
    const { result } = renderHook(() => usePdfThumbnails(doc));

    let firstCanvas: HTMLCanvasElement | null = null;
    await act(async () => {
      firstCanvas = await result.current.ensureThumbnailRendered(1);
      for (let pageNumber = 2; pageNumber <= MAX_CACHED_THUMBNAILS + 1; pageNumber++) {
        await result.current.ensureThumbnailRendered(pageNumber);
      }
    });

    expect(firstCanvas!.width).toBe(0);
    expect(firstCanvas!.height).toBe(0);
  });

  it("clears the cache when the pdfDoc reference changes", async () => {
    const { doc: firstDoc } = createFakePdfDoc();
    const { doc: secondDoc } = createFakePdfDoc();
    const { result, rerender } = renderHook(
      ({ doc }: { doc: PdfDocumentProxyLike | null }) => usePdfThumbnails(doc),
      { initialProps: { doc: firstDoc } }
    );

    await act(async () => {
      await result.current.ensureThumbnailRendered(1);
      await result.current.ensureThumbnailRendered(2);
    });

    expect(result.current.cachedThumbnailCount()).toBe(2);

    rerender({ doc: secondDoc });

    expect(result.current.cachedThumbnailCount()).toBe(0);
  });

  it("clears the cache on unmount", async () => {
    const { doc } = createFakePdfDoc();
    const { result, unmount } = renderHook(() => usePdfThumbnails(doc));

    let cachedCanvas: HTMLCanvasElement | null = null;
    await act(async () => {
      cachedCanvas = await result.current.ensureThumbnailRendered(1);
    });

    unmount();

    expect(cachedCanvas!.width).toBe(0);
    expect(cachedCanvas!.height).toBe(0);
  });

  it("returns null from ensureThumbnailRendered when pdfDoc is null", async () => {
    const { result } = renderHook(() => usePdfThumbnails(null));

    let rendered: HTMLCanvasElement | null = null;
    await act(async () => {
      rendered = await result.current.ensureThumbnailRendered(1);
    });

    expect(rendered).toBeNull();
  });

  it("startsDocumentGenerationAtZeroBeforeAnyDocumentSwap", () => {
    const { doc } = createFakePdfDoc();

    const { result } = renderHook(() => usePdfThumbnails(doc));

    expect(result.current.documentGeneration).toBe(0);
  });

  it("incrementsDocumentGenerationWhenPdfDocChanges", async () => {
    const { doc: firstDoc } = createFakePdfDoc();
    const { doc: secondDoc } = createFakePdfDoc();

    const { result, rerender } = renderHook(
      ({ doc }: { doc: PdfDocumentProxyLike | null }) => usePdfThumbnails(doc),
      { initialProps: { doc: firstDoc } },
    );
    const initialGeneration = result.current.documentGeneration;

    await act(async () => {
      rerender({ doc: secondDoc });
    });

    expect(result.current.documentGeneration).toBe(initialGeneration + 1);
  });

  it("doesNotIncrementDocumentGenerationOnUnrelatedReRendersWithSameDoc", async () => {
    const { doc } = createFakePdfDoc();
    const { result, rerender } = renderHook(
      ({ doc: currentDoc }: { doc: PdfDocumentProxyLike | null }) =>
        usePdfThumbnails(currentDoc),
      { initialProps: { doc } },
    );
    const initialGeneration = result.current.documentGeneration;

    await act(async () => {
      rerender({ doc });
      rerender({ doc });
    });

    expect(result.current.documentGeneration).toBe(initialGeneration);
  });
});
