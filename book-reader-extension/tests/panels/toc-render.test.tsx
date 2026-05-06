import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TocPanel from "../../src/newtab/components/panels/TocPanel";
import type { LoadedBook } from "../../src/newtab/hooks/useBook";
import type { TocNode } from "../../src/newtab/lib/parsers/epub";
import { resetChromeStorageStub } from "../setup";

function makeTocNode(
  id: string,
  label: string,
  spineIndex: number,
  children: TocNode[] = [],
): TocNode {
  return {
    id,
    label,
    href: `${id}.xhtml`,
    spineIndex,
    fragment: null,
    children,
  };
}

function buildEpubBookWithToc(toc: TocNode[]): LoadedBook {
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
      chapters: [
        { href: "0", label: "Chapter 1", content: "" },
        { href: "1", label: "Chapter 2", content: "" },
        { href: "2", label: "Chapter 3", content: "" },
      ],
      toc,
      book: {} as unknown as never,
    } as unknown as LoadedBook["epub"],
  };
}

describe("TocPanel", () => {
  beforeEach(() => {
    resetChromeStorageStub();
  });

  it("rendersNestedTocLabelsWhenExpansionPathIncludesParent", async () => {
    const toc: TocNode[] = [
      makeTocNode("0", "Part One", 0, [
        makeTocNode("0.0", "Chapter 1", 0),
        makeTocNode("0.1", "Chapter 2", 1),
      ]),
    ];
    render(<TocPanel book={buildEpubBookWithToc(toc)} currentChapterIndex={1} onJump={vi.fn()} />);
    // Current node is "0.1" → ancestors include "0", which auto-expands.
    await waitFor(() => {
      expect(screen.getByText("Chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Chapter 2")).toBeInTheDocument();
    });
  });

  it("invokesOnJumpWhenResolvableNodeClicked", async () => {
    const onJump = vi.fn();
    const toc: TocNode[] = [makeTocNode("0", "Chapter 1", 0)];
    render(<TocPanel book={buildEpubBookWithToc(toc)} currentChapterIndex={0} onJump={onJump} />);
    await waitFor(() => screen.getByText("Chapter 1"));
    fireEvent.click(screen.getByText("Chapter 1"));
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ id: "0" }));
  });

  it("filtersTreeByLabelWhenSearchQueryEntered", async () => {
    const toc: TocNode[] = [
      makeTocNode("0", "Apples", 0),
      makeTocNode("1", "Bananas", 1),
      makeTocNode("2", "Cherries", 2),
    ];
    render(<TocPanel book={buildEpubBookWithToc(toc)} currentChapterIndex={0} onJump={vi.fn()} />);
    await waitFor(() => screen.getByText("Apples"));
    const search = screen.getByLabelText(/search chapters/i);
    fireEvent.change(search, { target: { value: "ban" } });
    expect(screen.queryByText("Apples")).toBeNull();
    expect(screen.getByText("Bananas")).toBeInTheDocument();
    expect(screen.queryByText("Cherries")).toBeNull();
  });

  it("fallsBackToFlatChapterListWhenTocIsEmpty", async () => {
    render(<TocPanel book={buildEpubBookWithToc([])} currentChapterIndex={0} onJump={vi.fn()} />);
    await waitFor(() => screen.getByText("Chapter 1"));
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();
    expect(screen.getByText("Chapter 3")).toBeInTheDocument();
  });

  it("disablesNodesWithUnresolvableSpineIndex", async () => {
    const toc: TocNode[] = [makeTocNode("0", "Broken", -1)];
    const onJump = vi.fn();
    render(<TocPanel book={buildEpubBookWithToc(toc)} currentChapterIndex={0} onJump={onJump} />);
    await waitFor(() => screen.getByText("Broken"));
    fireEvent.click(screen.getByText("Broken"));
    expect(onJump).not.toHaveBeenCalled();
  });
});
