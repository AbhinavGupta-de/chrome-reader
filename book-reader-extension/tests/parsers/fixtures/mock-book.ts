/**
 * Minimal in-memory mock of the slice of `epubjs.Book` that `parseEpub`
 * touches. Avoids shipping binary .epub fixtures while exercising the
 * primary walker + picker logic end-to-end.
 *
 * Surfaces consumed by `parseEpub`:
 *   - `book.ready` — Promise the caller awaits before reading metadata.
 *   - `book.loaded.metadata` — Promise<{ title, creator }>.
 *   - `book.loaded.navigation` — Promise<{ toc: NavItem[] }>.
 *   - `book.spine.items` — Array<{ href, ... }>.
 *   - `book.packaging.navPath` / `ncxPath` — strings or undefined.
 *   - `book.archive.getText(path)` — Promise<string>.
 *   - `book.load(href)` — Promise<Document> for chapter HTML.
 */

import type { NavItem } from "epubjs";

export interface MockSpineItem {
  href: string;
}

export interface MockPackaging {
  navPath?: string;
  ncxPath?: string;
}

export interface BuildMockBookInput {
  title: string;
  creator: string;
  navigationToc: NavItem[];
  spineItems: MockSpineItem[];
  packaging?: MockPackaging;
  archiveTexts?: Record<string, string>;
  chapterHtml?: Record<string, string>;
}

/**
 * Build a duck-typed `Book`-shaped object for use with `parseEpub`. The
 * cast back to `Book` happens at the test boundary because epubjs's full
 * type surface is intentionally not implemented here.
 */
export function buildMockBook(
  input: BuildMockBookInput,
): unknown {
  const archiveTexts = input.archiveTexts ?? {};
  const chapterHtml = input.chapterHtml ?? {};

  return {
    ready: Promise.resolve(),
    loaded: {
      metadata: Promise.resolve({
        title: input.title,
        creator: input.creator,
      }),
      navigation: Promise.resolve({ toc: input.navigationToc }),
    },
    spine: { items: input.spineItems },
    packaging: input.packaging ?? {},
    archive: {
      async getText(path: string): Promise<string> {
        if (path in archiveTexts) return archiveTexts[path];
        throw new Error(`mock archive: missing ${path}`);
      },
    },
    async load(href: string): Promise<Document> {
      const html = chapterHtml[href] ?? `<html><body>${href}</body></html>`;
      return new DOMParser().parseFromString(html, "application/xhtml+xml");
    },
  };
}
