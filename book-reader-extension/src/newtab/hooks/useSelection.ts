import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";

export interface SelectionState {
  text: string;
  rect: DOMRect;
  rects: DOMRect[];
  range: Range;
}

const FRAME_FALLBACK_MS = 16; // Approximately one 60fps frame.

function visibleRangeRects(range: Range): DOMRect[] {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  ) as DOMRect[];
  if (rects.length > 0) return rects;

  const fallback = range.getBoundingClientRect();
  return fallback.width > 0 && fallback.height > 0 ? [fallback] : [];
}

function readSelection(container: HTMLElement | null): SelectionState | null {
  if (!container) return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const clonedRange = range.cloneRange();
  return {
    text,
    rect: clonedRange.getBoundingClientRect(),
    rects: visibleRangeRects(clonedRange),
    range: clonedRange,
  };
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(performance.now()), FRAME_FALLBACK_MS);
}

function cancelFrame(handle: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(handle);
    return;
  }
  window.clearTimeout(handle);
}

function eventTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function isToolbarTarget(target: EventTarget | null): boolean {
  return eventTargetElement(target)?.closest("[data-selection-toolbar]") !== null;
}

function isInside(container: HTMLElement | null, target: EventTarget | null): boolean {
  return container !== null && target instanceof Node && container.contains(target);
}

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function sameRects(a: readonly DOMRect[], b: readonly DOMRect[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((rect, index) => sameRect(rect, b[index]));
}

function sameSelection(a: SelectionState | null, b: SelectionState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.text === b.text &&
    a.range.startContainer === b.range.startContainer &&
    a.range.startOffset === b.range.startOffset &&
    a.range.endContainer === b.range.endContainer &&
    a.range.endOffset === b.range.endOffset &&
    sameRect(a.rect, b.rect) &&
    sameRects(a.rects, b.rects)
  );
}

function hasPointerEvents(): boolean {
  return typeof window.PointerEvent === "function";
}

function clearWindowSelection(): void {
  window.getSelection()?.removeAllRanges();
}

export function useSelection(container: HTMLElement | null): SelectionState | null {
  const [state, setState] = useState<SelectionState | null>(null);
  const stateRef = useRef<SelectionState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerDownActiveRef = useRef(false);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const update = useCallback(() => {
    const next = readSelection(container);
    setState((prev) => (sameSelection(prev, next) ? prev : next));
  }, [container]);

  const updateGeometry = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const next: SelectionState = {
        ...prev,
        rect: prev.range.getBoundingClientRect(),
        rects: visibleRangeRects(prev.range),
      };
      return sameSelection(prev, next) ? prev : next;
    });
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      update();
    });
  }, [update]);

  const scheduleGeometryUpdate = useCallback(() => {
    if (!stateRef.current) return;
    if (frameRef.current !== null) return;
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      updateGeometry();
    });
  }, [updateGeometry]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (pointerDownActiveRef.current) return;
      scheduleUpdate();
    };

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (isToolbarTarget(event.target)) return;
      setState(null);

      if (!isInside(container, event.target)) {
        pointerDownActiveRef.current = false;
        clearWindowSelection();
        return;
      }

      pointerDownActiveRef.current = true;
    };

    const handlePointerUp = () => {
      if (!pointerDownActiveRef.current) return;
      pointerDownActiveRef.current = false;
      scheduleUpdate();
    };

    const handleWindowBlur = () => {
      pointerDownActiveRef.current = false;
      scheduleUpdate();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    const downEvent = hasPointerEvents() ? "pointerdown" : "mousedown";
    const upEvent = hasPointerEvents() ? "pointerup" : "mouseup";
    const cancelEvent = hasPointerEvents() ? "pointercancel" : null;
    document.addEventListener(downEvent, handlePointerDown, true);
    window.addEventListener(upEvent, handlePointerUp, true);
    if (cancelEvent) window.addEventListener(cancelEvent, handlePointerUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener(downEvent, handlePointerDown, true);
      window.removeEventListener(upEvent, handlePointerUp, true);
      if (cancelEvent) window.removeEventListener(cancelEvent, handlePointerUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      if (frameRef.current !== null) {
        cancelFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [container, scheduleUpdate]);

  useEffect(() => {
    const handleGeometryChange = () => {
      scheduleGeometryUpdate();
    };

    document.addEventListener("scroll", handleGeometryChange, true);
    window.addEventListener("resize", handleGeometryChange);
    return () => {
      document.removeEventListener("scroll", handleGeometryChange, true);
      window.removeEventListener("resize", handleGeometryChange);
    };
  }, [scheduleGeometryUpdate]);

  return state;
}
