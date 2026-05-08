import { Highlight, HighlightAnchor } from "./types";

export function findOverlappingHighlights(
  highlights: Highlight[],
  chapterIndex: number,
  selectionStart: number,
  selectionLength: number
): string[] {
  const selEnd = selectionStart + selectionLength;
  return highlights
    .filter((h) => h.anchor.chapterIndex === chapterIndex)
    .filter((h) => {
      const hStart = h.anchor.startOffset;
      const hEnd = hStart + h.anchor.length;
      return !(hEnd <= selectionStart || selEnd <= hStart);
    })
    .map((h) => h.id);
}


const CTX = 50;

export function buildAnchor(
  plainText: string,
  startOffset: number,
  length: number,
  chapterIndex: number
): HighlightAnchor {
  return {
    chapterIndex,
    startOffset,
    length,
    contextBefore: plainText.slice(Math.max(0, startOffset - CTX), startOffset),
    contextAfter: plainText.slice(startOffset + length, startOffset + length + CTX),
  };
}

export function resolveAnchor(
  plainText: string,
  anchor: Pick<HighlightAnchor, "startOffset" | "length" | "contextBefore" | "contextAfter">
): { startOffset: number; length: number } | null {
  // Try direct offset match first.
  const before = plainText.slice(Math.max(0, anchor.startOffset - CTX), anchor.startOffset);
  if (before.endsWith(anchor.contextBefore.slice(-Math.min(CTX, anchor.contextBefore.length)))) {
    return { startOffset: anchor.startOffset, length: anchor.length };
  }
  // Fallback: search for contextBefore + (anything length-wide) + contextAfter.
  if (anchor.contextBefore.length === 0 && anchor.contextAfter.length === 0) {
    return null;
  }
  const probe = anchor.contextBefore;
  let from = 0;
  while (from <= plainText.length) {
    const idx = probe.length > 0 ? plainText.indexOf(probe, from) : 0;
    if (idx === -1) return null;
    const candidateStart = idx + probe.length;
    const candidateEnd = candidateStart + anchor.length;
    const after = plainText.slice(candidateEnd, candidateEnd + anchor.contextAfter.length);
    if (after === anchor.contextAfter || (anchor.contextAfter.length === 0 && candidateEnd <= plainText.length)) {
      return { startOffset: candidateStart, length: anchor.length };
    }
    if (probe.length === 0) return null;
    from = idx + 1;
  }
  return null;
}

export function anchorRangeFromDom(
  container: HTMLElement,
  startOffset: number,
  length: number
): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  const targetEnd = startOffset + length;

  let n: Node | null = walker.nextNode();
  while (n) {
    const t = n as Text;
    const len = t.data.length;
    if (!startNode && consumed + len > startOffset) {
      startNode = t;
      startNodeOffset = startOffset - consumed;
    }
    if (startNode && consumed + len >= targetEnd) {
      endNode = t;
      endNodeOffset = targetEnd - consumed;
      break;
    }
    consumed += len;
    n = walker.nextNode();
  }
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

export function offsetsFromRange(
  container: HTMLElement,
  range: Range
): { startOffset: number; length: number } | null {
  if (!container.contains(range.commonAncestorContainer)) return null;

  const doc = container.ownerDocument;
  const before = doc.createRange();
  before.selectNodeContents(container);

  try {
    before.setEnd(range.startContainer, range.startOffset);
  } catch {
    return null;
  }

  const startOffset = before.toString().length;
  const length = range.toString().length;
  if (length <= 0) return null;
  return { startOffset, length };
}
