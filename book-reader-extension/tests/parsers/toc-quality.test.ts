import { describe, it, expect } from "vitest";
import {
  tocQualityScore,
  isTocGoodEnough,
  MIN_QUALITY_SCORE,
  MIN_USEFUL_TOC_NODES,
} from "../../src/newtab/lib/parsers/toc-quality";
import type { TocNode } from "../../src/newtab/lib/parsers/epub";

function makeNode(partial: Partial<TocNode>): TocNode {
  return {
    id: "0",
    label: "Default",
    href: "x.xhtml",
    spineIndex: 0,
    fragment: null,
    children: [],
    ...partial,
  };
}

describe("tocQualityScore", () => {
  it("scoresOneForAllCleanLabels", () => {
    // Arrange
    const tocWithCleanLabels: TocNode[] = [
      makeNode({ id: "0", label: "Introduction" }),
      makeNode({ id: "1", label: "First Chapter" }),
    ];

    // Act
    const score = tocQualityScore(tocWithCleanLabels);

    // Assert
    expect(score).toBe(1);
  });

  it("scoresZeroWhenEveryLabelIsEmpty", () => {
    const tocWithEmptyLabels: TocNode[] = [
      makeNode({ id: "0", label: "", spineIndex: -1 }),
      makeNode({ id: "1", label: "", spineIndex: -1 }),
    ];

    expect(tocQualityScore(tocWithEmptyLabels)).toBe(0);
  });

  it("scoresZeroWhenEveryLabelIsChapterDefault", () => {
    const tocWithDefaultChapterLabels: TocNode[] = [
      makeNode({ id: "0", label: "Chapter 1" }),
      makeNode({ id: "1", label: "Chapter 2" }),
      makeNode({ id: "2", label: "Chapter 17" }),
    ];

    expect(tocQualityScore(tocWithDefaultChapterLabels)).toBe(0);
  });

  it("scoresZeroWhenEveryLabelIsSectionDefault", () => {
    const tocWithDefaultSectionLabels: TocNode[] = [
      makeNode({ id: "0", label: "Section 1" }),
      makeNode({ id: "1", label: "Section 5" }),
    ];

    expect(tocQualityScore(tocWithDefaultSectionLabels)).toBe(0);
  });

  it("scoresHalfWhenHalfLabelsAreClean", () => {
    const mixedToc: TocNode[] = [
      makeNode({ id: "0", label: "Real Title" }),
      makeNode({ id: "1", label: "Chapter 2" }),
    ];

    expect(tocQualityScore(mixedToc)).toBe(0.5);
  });

  it("walksNestedChildrenWhenScoring", () => {
    const nestedToc: TocNode[] = [
      makeNode({
        id: "0",
        label: "Part One",
        children: [
          makeNode({ id: "0.0", label: "Chapter 1" }),
          makeNode({ id: "0.1", label: "Chapter 2" }),
        ],
      }),
    ];

    // 1 clean (Part One) out of 3 total nodes.
    expect(tocQualityScore(nestedToc)).toBeCloseTo(1 / 3, 5);
  });

  it("returnsZeroForEmptyToc", () => {
    expect(tocQualityScore([])).toBe(0);
  });
});

describe("isTocGoodEnough", () => {
  it("returnsTrueWhenScoreMeetsThresholdAndAtLeastOneNode", () => {
    const acceptableToc: TocNode[] = [
      makeNode({ id: "0", label: "Real Title One" }),
      makeNode({ id: "1", label: "Real Title Two" }),
      makeNode({ id: "2", label: "Real Title Three" }),
      makeNode({ id: "3", label: "Chapter 4" }),
      makeNode({ id: "4", label: "Chapter 5" }),
    ];

    // 3 / 5 = 0.6 — meets threshold.
    expect(tocQualityScore(acceptableToc)).toBeCloseTo(0.6, 5);
    expect(isTocGoodEnough(acceptableToc)).toBe(true);
  });

  it("returnsFalseWhenScoreBelowThreshold", () => {
    const poorToc: TocNode[] = [
      makeNode({ id: "0", label: "Real Title" }),
      makeNode({ id: "1", label: "Chapter 2" }),
      makeNode({ id: "2", label: "Chapter 3" }),
    ];

    expect(isTocGoodEnough(poorToc)).toBe(false);
  });

  it("returnsFalseForEmptyToc", () => {
    expect(isTocGoodEnough([])).toBe(false);
  });

  it("exposesNamedThresholdConstants", () => {
    // Sanity that the constants exist and are sensible.
    expect(MIN_QUALITY_SCORE).toBeGreaterThan(0);
    expect(MIN_QUALITY_SCORE).toBeLessThanOrEqual(1);
    expect(MIN_USEFUL_TOC_NODES).toBeGreaterThanOrEqual(1);
  });
});
