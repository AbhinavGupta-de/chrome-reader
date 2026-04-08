import ePub, { Book, Rendition } from "epubjs";

export interface EpubChapter {
  href: string;
  label: string;
  content: string;
}

export interface ParsedEpub {
  title: string;
  author: string;
  chapters: EpubChapter[];
  book: Book;
}

export async function parseEpub(arrayBuffer: ArrayBuffer): Promise<ParsedEpub> {
  const book = ePub(arrayBuffer);
  await book.ready;

  const metadata = await book.loaded.metadata;
  const spine = book.spine as any;

  const chapters: EpubChapter[] = [];
  const toc = await book.loaded.navigation;

  const tocMap = new Map<string, string>();
  for (const item of toc.toc) {
    tocMap.set(item.href, item.label);
  }

  for (const item of spine.items) {
    if (!item.href) continue;
    try {
      const doc = await book.load(item.href);
      const serializer = new XMLSerializer();
      const html = serializer.serializeToString(doc as any);
      chapters.push({
        href: item.href,
        label: tocMap.get(item.href) || item.href,
        content: html,
      });
    } catch {
      // Skip chapters that fail to load
    }
  }

  return {
    title: metadata.title || "Untitled",
    author: metadata.creator || "Unknown Author",
    chapters,
    book,
  };
}

export function createRendition(book: Book, element: HTMLElement): Rendition {
  return book.renderTo(element, {
    width: "100%",
    height: "100%",
    spread: "none",
  });
}
