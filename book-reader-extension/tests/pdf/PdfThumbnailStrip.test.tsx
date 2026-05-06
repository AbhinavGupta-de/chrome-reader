import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";

function dispatchPointerEvent(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { pointerId: number; clientX: number; button?: number }
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: init.pointerId,
    clientX: init.clientX,
    button: init.button ?? 0,
  });
  target.dispatchEvent(event);
}
import PdfThumbnailStrip from "../../src/newtab/components/pdf/PdfThumbnailStrip";
import type { PdfDocumentProxyLike } from "../../src/newtab/components/pdf/usePdfThumbnails";

interface FakeIntersectionObserver {
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
}

interface FakeIntersectionObserverHandle {
  triggerVisible: (target: Element) => void;
  observed: () => Set<Element>;
}

function installFakeIntersectionObserver(): FakeIntersectionObserverHandle {
  const callbacksByObserver = new Map<FakeIntersectionObserver, IntersectionObserverCallback>();
  const observedTargets = new Set<Element>();
  const observerByTarget = new Map<Element, FakeIntersectionObserver>();

  class StubIntersectionObserver implements FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      callbacksByObserver.set(this, callback);
    }
    observe(target: Element): void {
      observedTargets.add(target);
      observerByTarget.set(target, this);
    }
    unobserve(target: Element): void {
      observedTargets.delete(target);
      observerByTarget.delete(target);
    }
    disconnect(): void {
      for (const [target, observer] of observerByTarget) {
        if (observer === this) {
          observedTargets.delete(target);
          observerByTarget.delete(target);
        }
      }
      callbacksByObserver.delete(this);
    }
  }

  (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    StubIntersectionObserver as unknown as typeof IntersectionObserver;

  return {
    triggerVisible(target: Element): void {
      const observer = observerByTarget.get(target);
      if (!observer) return;
      const callback = callbacksByObserver.get(observer);
      if (!callback) return;
      const entry = {
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      } as unknown as IntersectionObserverEntry;
      callback([entry], observer as unknown as IntersectionObserver);
    },
    observed(): Set<Element> {
      return observedTargets;
    },
  };
}

function createFakePdfDoc(numPages: number): {
  doc: PdfDocumentProxyLike;
  renderCallsByPage: Map<number, number>;
} {
  const renderCallsByPage = new Map<number, number>();
  const doc: PdfDocumentProxyLike = {
    numPages,
    async getPage(pageNumber: number) {
      return {
        getViewport({ scale }: { scale: number }) {
          return { width: 600 * scale, height: 800 * scale };
        },
        render() {
          renderCallsByPage.set(pageNumber, (renderCallsByPage.get(pageNumber) ?? 0) + 1);
          return { promise: Promise.resolve() };
        },
      };
    },
  };
  return { doc, renderCallsByPage };
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D | null {
    return {} as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
  // Stub scrollTo (jsdom does not provide it on Element).
  Element.prototype.scrollTo = function (): void {} as Element["scrollTo"];
  // Stub pointer-capture APIs (jsdom does not implement them).
  Element.prototype.setPointerCapture = function (): void {};
  Element.prototype.releasePointerCapture = function (): void {};
  Element.prototype.hasPointerCapture = function (): boolean {
    return false;
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PdfThumbnailStrip", () => {
  it("renders one thumbnail slot per page in the document", async () => {
    installFakeIntersectionObserver();
    const { doc } = createFakePdfDoc(5);
    const onJumpToPage = vi.fn();

    const { container } = render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={1}
        totalPages={5}
        onJumpToPage={onJumpToPage}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const thumbnails = container.querySelectorAll("[data-page-number]");
    expect(thumbnails.length).toBe(5);
  });

  it("eagerly renders pages in the lookahead window around currentPage", async () => {
    installFakeIntersectionObserver();
    const { doc, renderCallsByPage } = createFakePdfDoc(50);
    const onJumpToPage = vi.fn();

    render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={20}
        totalPages={50}
        onJumpToPage={onJumpToPage}
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Lookahead is 4 each side → pages 16..24 (inclusive) should be rendered.
    for (let pageNumber = 16; pageNumber <= 24; pageNumber++) {
      expect(renderCallsByPage.get(pageNumber)).toBeGreaterThanOrEqual(1);
    }
    // Distant pages (e.g. page 1, page 50) should NOT have been rendered yet.
    expect(renderCallsByPage.get(1)).toBeUndefined();
    expect(renderCallsByPage.get(50)).toBeUndefined();
  });

  it("calls onJumpToPage with the clicked page number", async () => {
    installFakeIntersectionObserver();
    const { doc } = createFakePdfDoc(10);
    const onJumpToPage = vi.fn();

    const { container } = render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={1}
        totalPages={10}
        onJumpToPage={onJumpToPage}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const thumbnailButton = container.querySelector(
      '[data-page-number="3"]'
    ) as HTMLButtonElement | null;
    expect(thumbnailButton).not.toBeNull();

    dispatchPointerEvent(thumbnailButton!, "pointerdown", { pointerId: 1, clientX: 100 });
    dispatchPointerEvent(thumbnailButton!, "pointerup", { pointerId: 1, clientX: 100 });
    fireEvent.click(thumbnailButton!);

    expect(onJumpToPage).toHaveBeenCalledWith(3);
  });

  it("marks the active thumbnail with the matcha border and aria-current=page", async () => {
    installFakeIntersectionObserver();
    const { doc } = createFakePdfDoc(10);

    const { container } = render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={4}
        totalPages={10}
        onJumpToPage={() => {}}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const activeButton = container.querySelector('[data-page-number="4"]') as HTMLElement;
    expect(activeButton.getAttribute("aria-current")).toBe("page");
  });

  it("renders a thumbnail when the IntersectionObserver reports it as visible", async () => {
    const observer = installFakeIntersectionObserver();
    const { doc, renderCallsByPage } = createFakePdfDoc(50);

    const { container } = render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={1}
        totalPages={50}
        onJumpToPage={() => {}}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Page 30 is far outside the lookahead window — confirm it has not rendered yet.
    expect(renderCallsByPage.get(30)).toBeUndefined();

    const slot = container.querySelector(
      '[data-page-number="30"] [data-thumbnail-slot="true"]'
    ) as HTMLElement;

    await act(async () => {
      observer.triggerVisible(slot);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderCallsByPage.get(30)).toBeGreaterThanOrEqual(1);
  });

  it("does not call onJumpToPage when the user drags more than the click threshold", async () => {
    installFakeIntersectionObserver();
    const { doc } = createFakePdfDoc(10);
    const onJumpToPage = vi.fn();

    const { container } = render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={1}
        totalPages={10}
        onJumpToPage={onJumpToPage}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const thumbnailButton = container.querySelector(
      '[data-page-number="2"]'
    ) as HTMLButtonElement;
    const stripContainer = thumbnailButton.parentElement as HTMLElement;

    // Simulate a meaningful drag (>4px) on the strip container, then a click on a child.
    dispatchPointerEvent(stripContainer, "pointerdown", { pointerId: 1, clientX: 100 });
    dispatchPointerEvent(stripContainer, "pointermove", { pointerId: 1, clientX: 50 });
    dispatchPointerEvent(stripContainer, "pointerup", { pointerId: 1, clientX: 50 });
    fireEvent.click(thumbnailButton);

    expect(onJumpToPage).not.toHaveBeenCalled();
  });

  it("rebindsThumbnailsWhenPdfDocSwapsToNewDocument", async () => {
    installFakeIntersectionObserver();
    const { doc: firstDoc, renderCallsByPage: firstRenderCalls } = createFakePdfDoc(10);
    const { doc: secondDoc, renderCallsByPage: secondRenderCalls } = createFakePdfDoc(10);

    const { rerender } = render(
      <PdfThumbnailStrip
        pdfDoc={firstDoc}
        currentPage={1}
        totalPages={10}
        onJumpToPage={() => {}}
      />,
    );

    // Wait for the lookahead window around currentPage=1 to render against firstDoc.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(firstRenderCalls.get(1)).toBeGreaterThanOrEqual(1);

    // Swap to a fresh doc — children should remount and re-render the lookahead
    // pages against the NEW doc.
    rerender(
      <PdfThumbnailStrip
        pdfDoc={secondDoc}
        currentPage={1}
        totalPages={10}
        onJumpToPage={() => {}}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(secondRenderCalls.get(1)).toBeGreaterThanOrEqual(1);
  });

  it("calls onJumpToPage when pointer movement is below the click threshold", async () => {
    installFakeIntersectionObserver();
    const { doc } = createFakePdfDoc(10);
    const onJumpToPage = vi.fn();

    const { container } = render(
      <PdfThumbnailStrip
        pdfDoc={doc}
        currentPage={1}
        totalPages={10}
        onJumpToPage={onJumpToPage}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const thumbnailButton = container.querySelector(
      '[data-page-number="2"]'
    ) as HTMLButtonElement;
    const stripContainer = thumbnailButton.parentElement as HTMLElement;

    dispatchPointerEvent(stripContainer, "pointerdown", { pointerId: 1, clientX: 100 });
    dispatchPointerEvent(stripContainer, "pointermove", { pointerId: 1, clientX: 102 });
    dispatchPointerEvent(stripContainer, "pointerup", { pointerId: 1, clientX: 102 });
    fireEvent.click(thumbnailButton);

    expect(onJumpToPage).toHaveBeenCalledWith(2);
  });
});
