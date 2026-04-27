import { Highlight } from "./types";
import { anchorRangeFromDom, resolveAnchor } from "./anchor";

export const COLOR_BG: Record<string, string> = {
  yellow: "rgba(253,224,71,0.55)",
  green: "rgba(134,239,172,0.55)",
  pink: "rgba(244,114,182,0.45)",
  blue: "rgba(147,197,253,0.55)",
};

export function clearHighlights(container: HTMLElement) {
  container.querySelectorAll("mark[data-hl]").forEach((el) => {
    const parent = el.parentNode!;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  });
}

export function renderHighlights(
  container: HTMLElement,
  plainText: string,
  chapterIndex: number,
  highlights: Highlight[],
  onClick: (id: string, rect: DOMRect) => void
): void {
  clearHighlights(container);
  for (const h of highlights) {
    if (h.anchor.chapterIndex !== chapterIndex) continue;
    const offsets = resolveAnchor(plainText, h.anchor);
    if (!offsets) continue;
    const range = anchorRangeFromDom(container, offsets.startOffset, offsets.length);
    if (!range) continue;
    try {
      const mark = document.createElement("mark");
      mark.setAttribute("data-hl", h.id);
      mark.style.background = COLOR_BG[h.color] ?? COLOR_BG.yellow;
      mark.style.borderRadius = "2px";
      mark.style.padding = "0 1px";
      mark.style.cursor = "pointer";
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick(h.id, mark.getBoundingClientRect());
      });
      range.surroundContents(mark);
    } catch (e) {
      console.debug("highlight skipped (cross-element)", h.id, e);
    }
  }
}
