import { describe, it, expect, vi } from "vitest";

import { buildMockBook } from "./fixtures/mock-book";
import { NESTED_NAV_XHTML, NAV_WITH_FILENAME_LABELS_XHTML } from "./fixtures/nav-xhtml";
import { NESTED_NCX_XML } from "./fixtures/toc-ncx";

// Mock the epubjs default export so `parseEpub` accepts our fake Book.
vi.mock("epubjs", () => {
  const mockBookHolder: { current: unknown } = { current: null };
  return {
    default: () => mockBookHolder.current,
    setMockBook: (book: unknown) => {
      mockBookHolder.current = book;
    },
  };
});

import * as epubjsMock from "epubjs";
import { parseEpub } from "../../src/newtab/lib/parsers/epub";

const setMockBook = (book: unknown): void => {
  // `setMockBook` is the test-only escape hatch added by the vi.mock factory.
  (epubjsMock as unknown as { setMockBook: (b: unknown) => void }).setMockBook(book);
};

describe("parseEpub primary TOC walker", () => {
  it("buildsNestedTocTreeFromNavigationToc", async () => {
    // Arrange — navigation.toc with one nested entry.
    const book = buildMockBook({
      title: "Nested Test",
      creator: "Tester",
      navigationToc: [
        {
          id: "nav-0",
          href: "intro.xhtml",
          label: "Introduction",
          subitems: [],
        },
        {
          id: "nav-1",
          href: "part1.xhtml",
          label: "Part One",
          subitems: [
            {
              id: "nav-1-0",
              href: "chap01.xhtml",
              label: "Chapter One",
              subitems: [],
            },
            {
              id: "nav-1-1",
              href: "chap02.xhtml",
              label: "Chapter Two",
              subitems: [],
            },
          ],
        },
      ],
      spineItems: [
        { href: "intro.xhtml" },
        { href: "part1.xhtml" },
        { href: "chap01.xhtml" },
        { href: "chap02.xhtml" },
      ],
    });
    setMockBook(book);

    // Act
    const parsed = await parseEpub(new ArrayBuffer(0));

    // Assert.
    expect(parsed.title).toBe("Nested Test");
    expect(parsed.author).toBe("Tester");
    expect(parsed.chapters).toHaveLength(4);

    expect(parsed.toc).toHaveLength(2);
    expect(parsed.toc[0].id).toBe("0");
    expect(parsed.toc[0].label).toBe("Introduction");
    expect(parsed.toc[0].spineIndex).toBe(0);
    expect(parsed.toc[0].fragment).toBeNull();

    expect(parsed.toc[1].id).toBe("1");
    expect(parsed.toc[1].label).toBe("Part One");
    expect(parsed.toc[1].children).toHaveLength(2);
    expect(parsed.toc[1].children[0].id).toBe("1.0");
    expect(parsed.toc[1].children[0].spineIndex).toBe(2);
  });

  it("urlDecodesFragmentsAndStoresWithoutLeadingHash", async () => {
    const book = buildMockBook({
      title: "Fragments",
      creator: "X",
      navigationToc: [
        {
          id: "n",
          href: "chap01.xhtml#Section%202.1",
          label: "Section 2.1",
          subitems: [],
        },
      ],
      spineItems: [{ href: "chap01.xhtml" }],
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc[0].fragment).toBe("Section 2.1");
    expect(parsed.toc[0].spineIndex).toBe(0);
  });

  it("substitutesChapterHeadingWhenNavLabelIsFilename", async () => {
    // navigation.toc returns a filename-shaped label; the parser should
    // pull the <h1> from the chapter HTML instead.
    const book = buildMockBook({
      title: "Heading Fallback",
      creator: "X",
      navigationToc: [
        {
          id: "n",
          href: "chap01.xhtml",
          label: "chap01.xhtml",
          subitems: [],
        },
      ],
      spineItems: [{ href: "chap01.xhtml" }],
      chapterHtml: {
        "chap01.xhtml":
          "<html><body><h1>The Real Title</h1><p>body</p></body></html>",
      },
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc[0].label).toBe("The Real Title");
  });

  it("fallsBackToChapterNumberWhenNoHeadingAvailable", async () => {
    const book = buildMockBook({
      title: "No Heading",
      creator: "X",
      navigationToc: [
        {
          id: "n",
          href: "chap01.xhtml",
          label: "ch01.xhtml",
          subitems: [],
        },
      ],
      spineItems: [{ href: "chap01.xhtml" }],
      chapterHtml: { "chap01.xhtml": "<html><body><p>no heading</p></body></html>" },
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc[0].label).toBe("Chapter 1");
  });

  it("flagsUnresolvableHrefsAsMinusOneSpineIndex", async () => {
    const book = buildMockBook({
      title: "Mismatched",
      creator: "X",
      navigationToc: [
        {
          id: "n",
          href: "missing-from-spine.xhtml",
          label: "Missing",
          subitems: [],
        },
      ],
      spineItems: [{ href: "intro.xhtml" }],
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc[0].spineIndex).toBe(-1);
    expect(parsed.toc[0].label).toBe("Missing");
  });

  it("picksFallbackWhenPrimaryHasFilenameLabels", async () => {
    // Primary navigation comes back with filename-shaped labels and no
    // recoverable headings → primary is below threshold. Fallback nav.xhtml
    // has clean labels → picker chooses fallback.
    const book = buildMockBook({
      title: "Picker",
      creator: "X",
      navigationToc: [
        { id: "a", href: "chap01.xhtml", label: "ch01.xhtml", subitems: [] },
        { id: "b", href: "chap02.xhtml", label: "ch02.xhtml", subitems: [] },
      ],
      spineItems: [{ href: "chap01.xhtml" }, { href: "chap02.xhtml" }],
      packaging: { navPath: "nav.xhtml" },
      archiveTexts: {
        "nav.xhtml": NAV_WITH_FILENAME_LABELS_XHTML.replace(
          /ch0(\d).xhtml/g,
          (_match, chapterNumber: string) => `Real Chapter ${chapterNumber}`,
        ),
      },
      chapterHtml: {
        "chap01.xhtml": "<html><body><p>no h1</p></body></html>",
        "chap02.xhtml": "<html><body><p>no h1</p></body></html>",
      },
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc.map((node) => node.label)).toEqual([
      "Real Chapter 1",
      "Real Chapter 2",
    ]);
  });

  it("usesNcxFallbackWhenOnlyNcxPathAvailable", async () => {
    const book = buildMockBook({
      title: "NCX Only",
      creator: "X",
      // Primary returns junk so fallback is preferred.
      navigationToc: [
        { id: "a", href: "intro.html", label: "intro.html", subitems: [] },
      ],
      spineItems: [
        { href: "intro.html" },
        { href: "part1.html" },
        { href: "chap01.html" },
        { href: "chap02.html" },
      ],
      packaging: { ncxPath: "toc.ncx" },
      archiveTexts: { "toc.ncx": NESTED_NCX_XML },
      chapterHtml: {
        "intro.html": "<html><body><p>x</p></body></html>",
      },
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc[0].label).toBe("Introduction");
    expect(parsed.toc[1].label).toBe("Part One");
  });

  it("usesPrimaryWhenFallbackUnavailable", async () => {
    const book = buildMockBook({
      title: "Primary Wins",
      creator: "X",
      navigationToc: [
        {
          id: "a",
          href: "intro.xhtml",
          label: "Real Introduction",
          subitems: [],
        },
      ],
      spineItems: [{ href: "intro.xhtml" }],
      packaging: {}, // no navPath, no ncxPath
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc[0].label).toBe("Real Introduction");
  });

  it("returnsEmptyTocArrayWhenNoNavigationProvided", async () => {
    const book = buildMockBook({
      title: "Empty Nav",
      creator: "X",
      navigationToc: [],
      spineItems: [{ href: "intro.xhtml" }],
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc).toEqual([]);
    expect(parsed.chapters).toHaveLength(1);
  });

  it("preservesNavigationSourceWhenPrimaryHasCleanLabelsViaNestedNavXhtml", async () => {
    // Primary already clean; fallback also clean (NESTED_NAV_XHTML); picker
    // prefers fallback per spec §2.3 tie-breaker. Asserting both labels are
    // identical lets either source win without flake.
    const book = buildMockBook({
      title: "Both Good",
      creator: "X",
      navigationToc: [
        { id: "a", href: "intro.xhtml", label: "Introduction", subitems: [] },
        {
          id: "b",
          href: "part1.xhtml",
          label: "Part One",
          subitems: [
            { id: "b-1", href: "chap01.xhtml", label: "Chapter One", subitems: [] },
            { id: "b-2", href: "chap02.xhtml", label: "Chapter Two", subitems: [] },
          ],
        },
      ],
      spineItems: [
        { href: "intro.xhtml" },
        { href: "part1.xhtml" },
        { href: "chap01.xhtml" },
        { href: "chap02.xhtml" },
      ],
      packaging: { navPath: "nav.xhtml" },
      archiveTexts: { "nav.xhtml": NESTED_NAV_XHTML },
    });
    setMockBook(book);

    const parsed = await parseEpub(new ArrayBuffer(0));

    expect(parsed.toc.map((node) => node.label)).toEqual([
      "Introduction",
      "Part One",
    ]);
    expect(parsed.toc[1].children.map((node) => node.label)).toEqual([
      "Chapter One",
      "Chapter Two",
    ]);
  });
});
