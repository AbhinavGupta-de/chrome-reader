import { describe, it, expect } from "vitest";
import {
  getChapterStatus,
  flattenToc,
} from "../../src/newtab/lib/parsers/toc-progress";
import type { TocNode } from "../../src/newtab/lib/parsers/epub";

function makeNode(partial: Partial<TocNode>): TocNode {
  return {
    id: "0",
    label: "X",
    href: "x.xhtml",
    spineIndex: 0,
    fragment: null,
    children: [],
    ...partial,
  };
}

describe("getChapterStatus", () => {
  it("returnsCurrentWhenSpineIndexMatchesPosition", () => {
    expect(getChapterStatus(3, 3)).toBe("current");
  });

  it("returnsReadWhenSpineIndexBeforePosition", () => {
    expect(getChapterStatus(0, 5)).toBe("read");
    expect(getChapterStatus(4, 5)).toBe("read");
  });

  it("returnsUnreadWhenSpineIndexAfterPosition", () => {
    expect(getChapterStatus(7, 3)).toBe("unread");
  });

  it("returnsUnreadForUnresolvedNodes", () => {
    expect(getChapterStatus(-1, 5)).toBe("unread");
    expect(getChapterStatus(-1, 0)).toBe("unread");
  });
});

describe("flattenToc", () => {
  it("returnsEmptyArrayForEmptyToc", () => {
    expect(flattenToc([])).toEqual([]);
  });

  it("returnsFlatTocUnchanged", () => {
    const flatToc: TocNode[] = [
      makeNode({ id: "0", label: "A" }),
      makeNode({ id: "1", label: "B" }),
    ];

    const flattened = flattenToc(flatToc);

    expect(flattened.map((n) => n.id)).toEqual(["0", "1"]);
  });

  it("flattensNestedTreeInDepthFirstOrder", () => {
    // Arrange — tree:
    //   "0"
    //     "0.0"
    //     "0.1"
    //       "0.1.0"
    //   "1"
    const nestedToc: TocNode[] = [
      makeNode({
        id: "0",
        children: [
          makeNode({ id: "0.0" }),
          makeNode({
            id: "0.1",
            children: [makeNode({ id: "0.1.0" })],
          }),
        ],
      }),
      makeNode({ id: "1" }),
    ];

    // Act
    const flattened = flattenToc(nestedToc);

    // Assert — depth-first ordering.
    expect(flattened.map((n) => n.id)).toEqual([
      "0",
      "0.0",
      "0.1",
      "0.1.0",
      "1",
    ]);
  });

  it("preservesNodeReferencesNotCopies", () => {
    const child = makeNode({ id: "0.0", label: "Child" });
    const parent = makeNode({ id: "0", label: "Parent", children: [child] });

    const flattened = flattenToc([parent]);

    expect(flattened[0]).toBe(parent);
    expect(flattened[1]).toBe(child);
  });
});
