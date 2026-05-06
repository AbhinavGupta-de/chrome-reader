import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import Reader from "../../src/newtab/components/Reader";
import { DEFAULT_SETTINGS, type ReadingPosition } from "../../src/newtab/lib/storage";
import type { LoadedBook } from "../../src/newtab/hooks/useBook";
import { resetChromeStorageStub } from "../setup";

function buildEpubBook(htmlContent: string, label = "Chapter 1"): LoadedBook {
  return {
    hash: "fixture",
    format: "epub",
    metadata: {
      hash: "fixture",
      title: "Fixture",
      author: "Test",
      format: "epub",
      addedAt: 0,
      fileSize: 0,
    },
    epub: {
      title: "Fixture",
      author: "Test",
      chapters: [{ href: "ch1", label, content: htmlContent }],
      toc: [],
      // book is unused by Reader for these tests; cast through unknown.
      book: {} as unknown as never,
    } as unknown as LoadedBook["epub"],
  };
}

const initialPosition: ReadingPosition = {
  bookHash: "fixture",
  chapterIndex: 0,
  scrollOffset: 0,
  percentage: 0,
  updatedAt: 0,
};

describe("Reader pendingFragment scroll", () => {
  let scrollSpy: ReturnType<typeof vi.spyOn> | null = null;
  let originalRaf: typeof window.requestAnimationFrame;

  beforeEach(() => {
    resetChromeStorageStub();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: () => undefined,
      });
    }
    scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined);
    originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    scrollSpy?.mockRestore();
    window.requestAnimationFrame = originalRaf;
  });

  it("scrollsToFragmentByIdAndCallsConsumedCallback", async () => {
    const book = buildEpubBook(`<h2 id="sec1">Section 1</h2><p>body</p>`);
    const onPendingFragmentConsumed = vi.fn();
    render(
      <Reader
        book={book}
        position={initialPosition}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={() => undefined}
        highlights={[]}
        onPositionChange={() => undefined}
        onSelectionAction={() => undefined}
        onHighlightClick={() => undefined}
        hasExplain={false}
        aiAvailable={false}
        pendingFragment="sec1"
        onPendingFragmentConsumed={onPendingFragmentConsumed}
      />,
    );
    await waitFor(() => expect(onPendingFragmentConsumed).toHaveBeenCalledTimes(1));
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("callsConsumedCallbackWhenFragmentDoesNotMatchAnyElement", async () => {
    const book = buildEpubBook(`<p>body</p>`);
    const onPendingFragmentConsumed = vi.fn();
    render(
      <Reader
        book={book}
        position={initialPosition}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={() => undefined}
        highlights={[]}
        onPositionChange={() => undefined}
        onSelectionAction={() => undefined}
        onHighlightClick={() => undefined}
        hasExplain={false}
        aiAvailable={false}
        pendingFragment="missing"
        onPendingFragmentConsumed={onPendingFragmentConsumed}
      />,
    );
    await waitFor(() => expect(onPendingFragmentConsumed).toHaveBeenCalledTimes(1));
  });

  it("doesNotThrowWhenFragmentContainsCharactersNeedingCssEscape", async () => {
    const book = buildEpubBook(`<a name="Section.1">Anchor</a><p>body</p>`);
    const onPendingFragmentConsumed = vi.fn();
    render(
      <Reader
        book={book}
        position={initialPosition}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={() => undefined}
        highlights={[]}
        onPositionChange={() => undefined}
        onSelectionAction={() => undefined}
        onHighlightClick={() => undefined}
        hasExplain={false}
        aiAvailable={false}
        pendingFragment="Section.1"
        onPendingFragmentConsumed={onPendingFragmentConsumed}
      />,
    );
    await waitFor(() => expect(onPendingFragmentConsumed).toHaveBeenCalledTimes(1));
  });
});
