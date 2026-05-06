import { describe, it, expect } from "vitest";
import {
  buildLibraryEntries,
  filterBySearch,
  sortEntries,
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

describe("library search and sort", () => {
  const books: BookMetadata[] = [
    makeMeta({ hash: "a", title: "Hamlet", author: "Shakespeare", lastOpenedAt: 30 }),
    makeMeta({ hash: "b", title: "Moby Dick", author: "Melville", lastOpenedAt: 50 }),
    makeMeta({ hash: "c", title: "Frankenstein", author: "Shelley", lastOpenedAt: 10 }),
  ];
  const entries = buildLibraryEntries(books, {});

  it("returnsAllEntriesWhenSearchQueryIsBlank", () => {
    expect(filterBySearch(entries, "")).toHaveLength(3);
  });

  it("matchesTitleCaseInsensitively", () => {
    const result = filterBySearch(entries, "hamlet");
    expect(result.map((entry) => entry.meta.hash)).toEqual(["a"]);
  });

  it("matchesAuthorCaseInsensitively", () => {
    const result = filterBySearch(entries, "shel");
    expect(result.map((entry) => entry.meta.hash)).toEqual(["c"]);
  });

  it("returnsEmptyArrayWhenNoMatch", () => {
    expect(filterBySearch(entries, "xyz")).toHaveLength(0);
  });

  it("sortsByRecentByDescendingLastOpenedAt", () => {
    const sorted = sortEntries(entries, "recent");
    expect(sorted.map((entry) => entry.meta.hash)).toEqual(["b", "a", "c"]);
  });

  it("sortsByAuthorAlphabetically", () => {
    const sorted = sortEntries(entries, "author");
    expect(sorted.map((entry) => entry.meta.author)).toEqual([
      "Melville",
      "Shakespeare",
      "Shelley",
    ]);
  });
});
