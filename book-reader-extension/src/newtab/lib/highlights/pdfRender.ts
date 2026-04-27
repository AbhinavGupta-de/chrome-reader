import { Highlight } from "./types";
import { anchorRangeFromDom, resolveAnchor } from "./anchor";

export const PDF_COLOR_BG: Record<string, string> = {
  yellow: "rgba(253,224,71,0.45)",
  green: "rgba(134,239,172,0.45)",
  pink: "rgba(244,114,182,0.40)",
  blue: "rgba(147,197,253,0.45)",
};

export function clearPdfHighlights(pageWrapper: HTMLElement) {
  pageWrapper.querySelectorAll("[data-pdf-hl]").forEach((el) => el.remove());
}

/**
 * Render highlight overlays as absolutely-positioned divs inside the page wrapper.
 * The page wrapper must be `position: relative` (PdfPage already sets this).
 * `pageWrapper` contains canvas + textLayer; we measure rects relative to pageWrapper's
 * bounding box.
 */
export function renderPdfHighlights(
  pageWrapper: HTMLElement,
  textLayer: HTMLElement,
  highlights: Highlight[],
  onClick: (id: string, rect: DOMRect) => void
): void {
  clearPdfHighlights(pageWrapper);
  const plainText = textLayer.textContent ?? "";
  const wrapperRect = pageWrapper.getBoundingClientRect();
  for (const h of highlights) {
    const offsets = resolveAnchor(plainText, h.anchor);
    if (!offsets) continue;
    const range = anchorRangeFromDom(textLayer, offsets.startOffset, offsets.length);
    if (!range) continue;
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width < 1 || r.height < 1) continue;
      const overlay = document.createElement("div");
      overlay.setAttribute("data-pdf-hl", h.id);
      overlay.style.position = "absolute";
      overlay.style.left = `${r.left - wrapperRect.left}px`;
      overlay.style.top = `${r.top - wrapperRect.top}px`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
      overlay.style.background = PDF_COLOR_BG[h.color] ?? PDF_COLOR_BG.yellow;
      overlay.style.borderRadius = "2px";
      overlay.style.pointerEvents = "auto";
      overlay.style.cursor = "pointer";
      overlay.style.zIndex = "1"; // above canvas (z-index 0), below textLayer (z-index 2)
      overlay.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick(h.id, overlay.getBoundingClientRect());
      });
      pageWrapper.appendChild(overlay);
    }
  }
}
