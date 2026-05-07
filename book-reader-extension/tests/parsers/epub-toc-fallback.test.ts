import { describe, it, expect } from "vitest";
import {
  parseTocFromNavXhtml,
  parseTocFromNcx,
} from "../../src/newtab/lib/parsers/epub-toc-fallback";
import {
  NESTED_NAV_XHTML,
  FLAT_NAV_XHTML,
  NAV_WITH_FRAGMENTS_XHTML,
  NAV_WITH_FILENAME_LABELS_XHTML,
} from "./fixtures/nav-xhtml";
import {
  NESTED_NCX_XML,
  FLAT_NCX_XML,
  NCX_WITH_FRAGMENTS_XML,
} from "./fixtures/toc-ncx";

describe("parseTocFromNavXhtml", () => {
  it("producesNestedTreeFromEpub3NavXhtml", () => {
    // Arrange — spine has the three referenced chapter files.
    const spineHrefs = [
      "OEBPS/intro.xhtml",
      "OEBPS/part1.xhtml",
      "OEBPS/chap01.xhtml",
      "OEBPS/chap02.xhtml",
      "OEBPS/chap03.xhtml",
    ];

    // Act
    const toc = parseTocFromNavXhtml(NESTED_NAV_XHTML, spineHrefs);

    // Assert — top-level shape.
    expect(toc).toHaveLength(2);
    expect(toc[0].label).toBe("Introduction");
    expect(toc[0].id).toBe("0");
    expect(toc[0].children).toHaveLength(0);

    expect(toc[1].label).toBe("Part One");
    expect(toc[1].id).toBe("1");
    expect(toc[1].children).toHaveLength(2);

    // Nested children get tree-path ids.
    expect(toc[1].children[0].id).toBe("1.0");
    expect(toc[1].children[0].label).toBe("Chapter One");
    expect(toc[1].children[1].id).toBe("1.1");
    expect(toc[1].children[1].label).toBe("Chapter Two");
  });

  it("resolvesSpineIndexAgainstSpineHrefMap", () => {
    const spineHrefs = [
      "OEBPS/intro.xhtml",
      "OEBPS/part1.xhtml",
      "OEBPS/chap01.xhtml",
      "OEBPS/chap02.xhtml",
      "OEBPS/chap03.xhtml",
    ];

    const toc = parseTocFromNavXhtml(NESTED_NAV_XHTML, spineHrefs);

    // The fixture references hrefs like "intro.xhtml" relative to OEBPS/.
    // Filename match should still resolve.
    expect(toc[0].spineIndex).toBe(0);
    expect(toc[1].spineIndex).toBe(1);
    expect(toc[1].children[0].spineIndex).toBe(2);
    expect(toc[1].children[1].spineIndex).toBe(3);
  });

  it("flagsUnresolvableHrefsAsMinusOneSpineIndex", () => {
    const spineHrefs = ["only-this-file.xhtml"];

    const toc = parseTocFromNavXhtml(FLAT_NAV_XHTML, spineHrefs);

    // None of the fixture's hrefs match the lone spine entry.
    for (const node of toc) {
      expect(node.spineIndex).toBe(-1);
    }
  });

  it("extractsUrlDecodedFragmentsFromHrefs", () => {
    const spineHrefs = ["OEBPS/chap01.xhtml"];

    const toc = parseTocFromNavXhtml(NAV_WITH_FRAGMENTS_XHTML, spineHrefs);

    // Fixture has href="chap01.xhtml#sec1" and href="chap01.xhtml#Section%202.1".
    expect(toc[0].fragment).toBe("sec1");
    expect(toc[1].fragment).toBe("Section 2.1");
  });

  it("nullsFragmentWhenHrefHasNoHash", () => {
    const spineHrefs = ["OEBPS/intro.xhtml"];

    const toc = parseTocFromNavXhtml(NESTED_NAV_XHTML, spineHrefs);

    expect(toc[0].fragment).toBeNull();
  });

  it("substitutesChapterNumberDefaultForFilenameOnlyLabels", () => {
    const spineHrefs = ["chap01.xhtml", "chap02.xhtml"];

    const toc = parseTocFromNavXhtml(NAV_WITH_FILENAME_LABELS_XHTML, spineHrefs);

    // Both fixture entries have label="ch01.xhtml" / "ch02.xhtml" — must be
    // replaced with the spine-based default.
    expect(toc[0].label).toBe("Chapter 1");
    expect(toc[1].label).toBe("Chapter 2");
  });

  it("returnsEmptyArrayForUnparseableInput", () => {
    expect(parseTocFromNavXhtml("", [])).toEqual([]);
    expect(parseTocFromNavXhtml("not xml at all <<<", [])).toEqual([]);
  });
});

describe("parseTocFromNcx", () => {
  it("producesNestedTreeFromEpub2Ncx", () => {
    // Arrange.
    const spineHrefs = [
      "OEBPS/intro.html",
      "OEBPS/part1.html",
      "OEBPS/chap01.html",
      "OEBPS/chap02.html",
    ];

    // Act
    const toc = parseTocFromNcx(NESTED_NCX_XML, spineHrefs);

    // Assert.
    expect(toc).toHaveLength(2);
    expect(toc[0].label).toBe("Introduction");
    expect(toc[0].id).toBe("0");
    expect(toc[1].label).toBe("Part One");
    expect(toc[1].children).toHaveLength(2);
    expect(toc[1].children[0].id).toBe("1.0");
    expect(toc[1].children[0].label).toBe("Chapter One");
  });

  it("resolvesSpineIndexFromContentSrc", () => {
    const spineHrefs = [
      "OEBPS/intro.html",
      "OEBPS/part1.html",
      "OEBPS/chap01.html",
      "OEBPS/chap02.html",
    ];

    const toc = parseTocFromNcx(NESTED_NCX_XML, spineHrefs);

    expect(toc[0].spineIndex).toBe(0);
    expect(toc[1].spineIndex).toBe(1);
    expect(toc[1].children[0].spineIndex).toBe(2);
  });

  it("extractsFragmentsFromNcxContentSrc", () => {
    const spineHrefs = ["chap01.html"];

    const toc = parseTocFromNcx(NCX_WITH_FRAGMENTS_XML, spineHrefs);

    expect(toc[0].fragment).toBe("sec1");
    expect(toc[1].fragment).toBe("note 2");
  });

  it("returnsEmptyArrayWhenNoNavMap", () => {
    const minimalNcx = `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><head/></ncx>`;

    expect(parseTocFromNcx(minimalNcx, [])).toEqual([]);
  });

  it("returnsEmptyArrayForUnparseableInput", () => {
    expect(parseTocFromNcx("", [])).toEqual([]);
  });

  it("handlesFlatNcxWithoutNesting", () => {
    const spineHrefs = [
      "chap01.html",
      "chap02.html",
      "chap03.html",
    ];

    const toc = parseTocFromNcx(FLAT_NCX_XML, spineHrefs);

    expect(toc).toHaveLength(3);
    expect(toc.every((node) => node.children.length === 0)).toBe(true);
    expect(toc.map((node) => node.label)).toEqual([
      "Chapter A",
      "Chapter B",
      "Chapter C",
    ]);
  });
});
