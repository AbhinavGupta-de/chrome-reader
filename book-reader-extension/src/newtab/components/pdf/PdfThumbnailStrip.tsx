import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePdfThumbnails, type PdfDocumentProxyLike } from "./usePdfThumbnails";

interface PdfThumbnailStripProps {
  pdfDoc: PdfDocumentProxyLike;
  currentPage: number;
  totalPages: number;
  onJumpToPage: (page: number) => void;
}

// Thumbnail layout constants — derived from spec §7.2 (~120px tall strip, ~120x160 thumbs).
const THUMBNAIL_WIDTH_PX = 96;
const THUMBNAIL_HEIGHT_PX = 128;
const ACTIVE_THUMBNAIL_SCALE = 1.15;
const STRIP_HEIGHT_PX = 152;
const LOOKAHEAD_PAGES = 4;
// Drag movement under this threshold counts as a click (jump-to-page) instead of a scrub.
const DRAG_CLICK_THRESHOLD_PX = 4;
// IntersectionObserver lookahead — keep ~2 thumbnails worth of pixels rendered ahead.
const INTERSECTION_OBSERVER_ROOT_MARGIN = "0px 220px";

type ObserveSlotFn = (slot: HTMLDivElement, onVisible: () => void) => () => void;

interface ThumbnailItemProps {
  pageNumber: number;
  isActive: boolean;
  isWithinLookahead: boolean;
  ensureThumbnailRendered: (pageNumber: number) => Promise<HTMLCanvasElement | null>;
  getCachedThumbnail: (pageNumber: number) => HTMLCanvasElement | null;
  observeSlot: ObserveSlotFn;
  onClickThumbnail: (pageNumber: number) => void;
}

function attachCanvasToSlot(slot: HTMLDivElement, canvas: HTMLCanvasElement): void {
  if (slot.firstChild === canvas) return;
  while (slot.firstChild) slot.removeChild(slot.firstChild);
  slot.appendChild(canvas);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
}

function ThumbnailItem({
  pageNumber,
  isActive,
  isWithinLookahead,
  ensureThumbnailRendered,
  getCachedThumbnail,
  observeSlot,
  onClickThumbnail,
}: ThumbnailItemProps): React.ReactElement {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [renderRequestTick, setRenderRequestTick] = useState<number>(0);

  // Subscribe to visibility — parent's observer bumps renderRequestTick which kicks off render.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const unobserve = observeSlot(slot, () => {
      setRenderRequestTick((tick) => tick + 1);
    });
    return unobserve;
  }, [observeSlot]);

  // Attach the cached canvas if one already exists. This covers both initial mount
  // (when a sibling lookahead has already populated the cache) and re-renders after
  // pageNumber changes. Does NOT trigger a render on its own — that only happens
  // via the visibility callback or via the strip's lookahead prime.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const cached = getCachedThumbnail(pageNumber);
    if (cached) attachCanvasToSlot(slot, cached);
  }, [pageNumber, getCachedThumbnail]);

  // Trigger a render when (a) the visibility callback fires (renderRequestTick bumps)
  // or (b) this thumbnail sits within the current page's lookahead window. Re-running
  // ensureThumbnailRendered for an already-cached page is cheap (the hook dedupes).
  useEffect(() => {
    if (renderRequestTick === 0 && !isWithinLookahead) return;
    let cancelled = false;
    void ensureThumbnailRendered(pageNumber).then((canvas) => {
      if (cancelled || !canvas) return;
      const currentSlot = slotRef.current;
      if (!currentSlot) return;
      attachCanvasToSlot(currentSlot, canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [pageNumber, ensureThumbnailRendered, renderRequestTick, isWithinLookahead]);

  const handleClick = useCallback(() => {
    onClickThumbnail(pageNumber);
  }, [onClickThumbnail, pageNumber]);

  const wrapperStyle: React.CSSProperties = {
    width: THUMBNAIL_WIDTH_PX,
    height: THUMBNAIL_HEIGHT_PX,
    transform: isActive ? `scale(${ACTIVE_THUMBNAIL_SCALE})` : undefined,
    transformOrigin: "center bottom",
    transition: "transform 150ms ease-out",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-page-number={pageNumber}
      className={`relative flex-none flex flex-col items-center justify-end mx-1 group focus:outline-none ${
        isActive ? "z-10" : ""
      }`}
      style={wrapperStyle}
      aria-label={`Jump to page ${pageNumber}`}
      aria-current={isActive ? "page" : undefined}
    >
      <div
        ref={slotRef}
        data-thumbnail-slot="true"
        className={`w-full h-full bg-clay-white rounded-[4px] overflow-hidden border-2 transition-colors ${
          isActive ? "border-matcha-600 ring-2 ring-matcha-600/40" : "border-oat group-hover:border-charcoal"
        }`}
      />
      <span
        className={`mt-1 text-[10px] tabular-nums ${
          isActive ? "text-matcha-600 font-semibold" : "text-silver"
        }`}
      >
        {pageNumber}
      </span>
    </button>
  );
}

function clampScrollPosition(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function scrollStripToCurrentPage(
  stripContainerEl: HTMLDivElement,
  currentPage: number,
  smooth: boolean
): void {
  const target = stripContainerEl.querySelector<HTMLElement>(
    `[data-page-number="${currentPage}"]`
  );
  if (!target) return;
  const containerRect = stripContainerEl.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetCenter = targetRect.left + targetRect.width / 2;
  const containerCenter = containerRect.left + containerRect.width / 2;
  const desiredScrollLeft = stripContainerEl.scrollLeft + (targetCenter - containerCenter);
  const maxScrollLeft = stripContainerEl.scrollWidth - stripContainerEl.clientWidth;
  const clamped = clampScrollPosition(desiredScrollLeft, maxScrollLeft);
  stripContainerEl.scrollTo({ left: clamped, behavior: smooth ? "smooth" : "auto" });
}

export default function PdfThumbnailStrip({
  pdfDoc,
  currentPage,
  totalPages,
  onJumpToPage,
}: PdfThumbnailStripProps): React.ReactElement {
  const stripContainerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibilityCallbacksByElement = useRef<Map<Element, () => void>>(new Map());
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  // Set true at pointerup if the pointer moved past DRAG_CLICK_THRESHOLD_PX. The click
  // event fires after pointerup, so we use this flag to suppress the jump-to-page action
  // for that one synthetic click. Cleared on the next pointerdown.
  const suppressNextClickRef = useRef<boolean>(false);

  const { ensureThumbnailRendered, getCachedThumbnail, documentGeneration } =
    usePdfThumbnails(pdfDoc);

  const pageNumbers = useMemo(() => {
    const result: number[] = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      result.push(pageNumber);
    }
    return result;
  }, [totalPages]);

  // Set up the IntersectionObserver once. Each ThumbnailItem registers its own
  // callback via observeSlot — when the observer reports an intersection for that
  // slot, we invoke the registered callback. Child effects fire before parent
  // effects in React, so child callbacks may already be registered by the time
  // this runs; we observe each one retroactively.
  useEffect(() => {
    const stripContainerEl = stripContainerRef.current;
    if (!stripContainerEl) return;
    const callbacks = visibilityCallbacksByElement.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const callback = callbacks.get(entry.target);
          if (callback) callback();
        }
      },
      { root: stripContainerEl, rootMargin: INTERSECTION_OBSERVER_ROOT_MARGIN }
    );
    observerRef.current = observer;
    callbacks.forEach((_callback, element) => observer.observe(element));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const observeSlot = useCallback<ObserveSlotFn>((slot, onVisible) => {
    const callbacks = visibilityCallbacksByElement.current;
    callbacks.set(slot, onVisible);
    const observer = observerRef.current;
    if (observer) observer.observe(slot);
    return () => {
      callbacks.delete(slot);
      const currentObserver = observerRef.current;
      if (currentObserver) currentObserver.unobserve(slot);
    };
  }, []);

  // Auto-scroll the strip to keep the current page centered when it changes externally.
  useEffect(() => {
    const stripContainerEl = stripContainerRef.current;
    if (!stripContainerEl) return;
    scrollStripToCurrentPage(stripContainerEl, currentPage, true);
  }, [currentPage]);

  // Mousewheel-horizontal: translate vertical wheel deltas into horizontal scroll.
  useEffect(() => {
    const stripContainerEl = stripContainerRef.current;
    if (!stripContainerEl) return;
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      stripContainerEl.scrollLeft += event.deltaY;
    };
    stripContainerEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => stripContainerEl.removeEventListener("wheel", handleWheel);
  }, []);

  // Drag-scrub: pointer down records start; move updates scrollLeft; up releases.
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stripContainerEl = stripContainerRef.current;
    if (!stripContainerEl) return;
    if (event.button !== 0) return;
    suppressNextClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: stripContainerEl.scrollLeft,
      moved: false,
    };
    stripContainerEl.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const stripContainerEl = stripContainerRef.current;
    if (!dragState || !stripContainerEl) return;
    if (dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(deltaX) > DRAG_CLICK_THRESHOLD_PX) {
      dragState.moved = true;
    }
    if (dragState.moved) {
      const maxScrollLeft = stripContainerEl.scrollWidth - stripContainerEl.clientWidth;
      stripContainerEl.scrollLeft = clampScrollPosition(
        dragState.startScrollLeft - deltaX,
        maxScrollLeft
      );
    }
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const stripContainerEl = stripContainerRef.current;
    if (!dragState || !stripContainerEl) return;
    if (dragState.pointerId !== event.pointerId) return;
    if (dragState.moved) suppressNextClickRef.current = true;
    if (stripContainerEl.hasPointerCapture(event.pointerId)) {
      stripContainerEl.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  }, []);

  const handleClickThumbnail = useCallback(
    (pageNumber: number) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      onJumpToPage(pageNumber);
    },
    [onJumpToPage]
  );

  return (
    <div
      className="flex-none border-t border-oat bg-cream"
      style={{ height: STRIP_HEIGHT_PX }}
      data-pdf-thumbnail-strip="true"
    >
      <div
        ref={stripContainerRef}
        className="relative h-full overflow-x-auto overflow-y-hidden flex items-end px-2 pb-2 pt-3 select-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="listbox"
        aria-label="PDF page thumbnails"
      >
        {pageNumbers.map((pageNumber) => (
          // documentGeneration is part of the key so a pdfDoc swap forces every
          // ThumbnailItem to remount and re-bind against the new document — the
          // stable ensure/getCached callbacks would otherwise leave us with stale
          // (zeroed) canvases from the prior doc.
          <ThumbnailItem
            key={`${documentGeneration}-${pageNumber}`}
            pageNumber={pageNumber}
            isActive={pageNumber === currentPage}
            isWithinLookahead={Math.abs(pageNumber - currentPage) <= LOOKAHEAD_PAGES}
            ensureThumbnailRendered={ensureThumbnailRendered}
            getCachedThumbnail={getCachedThumbnail}
            observeSlot={observeSlot}
            onClickThumbnail={handleClickThumbnail}
          />
        ))}
      </div>
    </div>
  );
}
