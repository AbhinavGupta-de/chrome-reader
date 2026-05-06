import type { TocNode } from "./epub";

export type ChapterStatus = "unread" | "current" | "read";

/**
 * Classify a TOC entry against the user's current reading position so the
 * UI can render an empty / filled / accent-ringed dot per node.
 *
 * Pure: no DOM, no storage, no side effects. The caller is responsible for
 * supplying `currentChapterIndex` from the active reading position.
 *
 * Unresolved nodes (`spineIndex < 0`) are always "unread" — clicking them
 * is a no-op so they shouldn't render as already-read either.
 */
export function getChapterStatus(
  spineIndex: number,
  currentChapterIndex: number,
): ChapterStatus {
  if (spineIndex < 0) return "unread";
  if (spineIndex < currentChapterIndex) return "read";
  if (spineIndex === currentChapterIndex) return "current";
  return "unread";
}

/**
 * Depth-first flatten of a TOC tree into a single array.
 *
 * Used by the scroll-spy lookup so we can find "the deepest TOC node whose
 * spineIndex matches current chapter" in O(n) without re-walking children.
 */
export function flattenToc(toc: TocNode[]): TocNode[] {
  const flattened: TocNode[] = [];
  const walk = (nodes: TocNode[]): void => {
    for (const node of nodes) {
      flattened.push(node);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(toc);
  return flattened;
}
