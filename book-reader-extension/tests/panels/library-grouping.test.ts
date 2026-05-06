import { describe, it, expect } from "vitest";
import {
  buildLibraryEntries,
  classifyStatus,
  groupForDisplay,
  pickRecentEntries,
} from "../../src/newtab/components/panels/library-helpers";
import type { BookMetadata } from "../../src/newtab/lib/storage";

function makeMeta(overrides: Partial<BookMetadata> & { hash: string }): BookMetadata {
  return {
    title: "Untitled",
    author: "Anon",
    format: "epub",
    addedAt: 1000,
    fileSize: 100,
    ...overrides,
  };
}

describe("library helpers", () => {
  it("classifiesProgressIntoReadingFinishedUnstartedBuckets", () => {
    expect(classifyStatus(0)).toBe("unstarted");
    expect(classifyStatus(50)).toBe("reading");
    expect(classifyStatus(99.4)).toBe("reading");
    expect(classifyStatus(99.5)).toBe("finished");
    expect(classifyStatus(100)).toBe("finished");
  });

  it("placesMostRecentlyOpenedBooksIntoRecentGroup", () => {
    const books: BookMetadata[] = [
      makeMeta({ hash: "a", title: "A", lastOpenedAt: 10 }),
      makeMeta({ hash: "b", title: "B", lastOpenedAt: 30 }),
      makeMeta({ hash: "c", title: "C", lastOpenedAt: 20 }),
      makeMeta({ hash: "d", title: "D", lastOpenedAt: 5 }),
    ];
    const entries = buildLibraryEntries(books, {});
    const recent = pickRecentEntries(entries);
    expect(recent.map((entry) => entry.meta.hash)).toEqual(["b", "c", "a"]);
  });

  it("excludesBooksWithoutLastOpenedAtFromRecentPin", () => {
    const books: BookMetadata[] = [
      makeMeta({ hash: "a", title: "A" }),
      makeMeta({ hash: "b", title: "B", lastOpenedAt: 100 }),
    ];
    const entries = buildLibraryEntries(books, {});
    const recent = pickRecentEntries(entries);
    expect(recent.map((entry) => entry.meta.hash)).toEqual(["b"]);
  });

  it("groupsRemainingBooksByStatusAndExcludesRecentDuplicates", () => {
    const books: BookMetadata[] = [
      makeMeta({ hash: "a", title: "Alpha", lastOpenedAt: 100 }),
      makeMeta({ hash: "b", title: "Beta", lastOpenedAt: 90 }),
      makeMeta({ hash: "c", title: "Charlie", lastOpenedAt: 80 }),
      makeMeta({ hash: "d", title: "Delta", lastOpenedAt: 70 }),
      makeMeta({ hash: "e", title: "Echo", lastOpenedAt: 60 }),
    ];
    const progress: Record<string, number> = {
      a: 50,
      b: 100,
      c: 0,
      d: 25,
      e: 0,
    };
    const entries = buildLibraryEntries(books, progress);
    const grouped = groupForDisplay(entries, "recent");
    expect(grouped.recent.map((entry) => entry.meta.hash)).toEqual(["a", "b", "c"]);
    expect(grouped.reading.map((entry) => entry.meta.hash)).toEqual(["d"]);
    expect(grouped.unstarted.map((entry) => entry.meta.hash)).toEqual(["e"]);
    expect(grouped.finished).toHaveLength(0);
  });

  it("sortsByTitleWhenTitleSortKeySelected", () => {
    const books: BookMetadata[] = [
      makeMeta({ hash: "a", title: "Bee" }),
      makeMeta({ hash: "b", title: "Apple" }),
      makeMeta({ hash: "c", title: "Cherry" }),
    ];
    const entries = buildLibraryEntries(books, {});
    const grouped = groupForDisplay(entries, "title");
    const allInOrder = [...grouped.recent, ...grouped.reading, ...grouped.unstarted, ...grouped.finished]
      .map((entry) => entry.meta.title);
    expect(allInOrder).toEqual(["Apple", "Bee", "Cherry"]);
  });
});
