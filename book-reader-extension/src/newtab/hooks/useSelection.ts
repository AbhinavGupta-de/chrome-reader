import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { anchorRangeFromDom, offsetsFromRange } from "../lib/highlights/anchor";

export interface SelectionOffsets {
  startOffset: number;
  length: number;
}

export interface SelectionState {
  text: string;
  rect: DOMRect;
  range: Range;
  offsets?: SelectionOffsets;
}

export interface SelectionResult {
  selection: SelectionState | null;
  clearSelection: () => void;
}

export interface SelectionOptions {
  anchorContainer?: HTMLElement | null;
  // "none" disables the visual swap (no CSS Custom Highlight, no sticky class
  // on <html>) and relies on the browser's native ::selection rendering for
  // both drag and persisted phases. Use this for surfaces like PDF.js text
  // layers where the custom highlight pseudo cannot match the canvas glyphs.
  persistentVisual?: "custom-highlight" | "dom-mark" | "none";
}

const FRAME_FALLBACK_MS = 16; // Approximately one 60fps frame.
const ACTIVE_SELECTION_HIGHLIGHT = "reader-active-selection";
const ACTIVE_SELECTION_STYLE_ID = "reader-active-selection-style";
const ACTIVE_SELECTION_MARK_CLASS = "reader-active-selection-mark";
const ACTIVE_SELECTION_ROOT_CLASS = "reader-sticky-selection-active";
const SELECTION_CLEAR_KEYS = new Set(["Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

type CustomHighlight = unknown;
type CustomHighlightConstructor = new (...ranges: Range[]) => CustomHighlight;
type CustomHighlightRegistry = {
  set(name: string, highlight: CustomHighlight): void;
  delete(name: string): boolean;
};

function customHighlightSupport(): { Highlight: CustomHighlightConstructor; registry: CustomHighlightRegistry } | null {
  const globalObject = window as typeof window & {
    CSS?: { highlights?: CustomHighlightRegistry };
    Highlight?: CustomHighlightConstructor;
  };
  const registry = globalObject.CSS?.highlights;
  const Highlight = globalObject.Highlight;
  if (!registry || typeof Highlight !== "function") return null;
  return { Highlight, registry };
}

function setCustomActiveSelectionHighlight(range: Range | null): boolean {
  const support = customHighlightSupport();
  if (!support) return false;
  if (!range) {
    support.registry.delete(ACTIVE_SELECTION_HIGHLIGHT);
    return true;
  }
  ensureActiveSelectionHighlightStyle();
  support.registry.set(ACTIVE_SELECTION_HIGHLIGHT, new support.Highlight(range));
  return true;
}

function setStickySelectionActive(active: boolean): void {
  document.documentElement.classList.toggle(ACTIVE_SELECTION_ROOT_CLASS, active);
}

function textNodesInRange(range: Range): Text[] {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) return [root as Text];
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch {
        return NodeFilter.FILTER_REJECT;
      }
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function markActiveSelectionFallback(range: Range): () => void {
  const doc = range.startContainer.ownerDocument ?? document;
  const marks: HTMLElement[] = [];
  const visualRange = range.cloneRange();
  const nodes = textNodesInRange(visualRange);

  for (const node of nodes.reverse()) {
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.data.length;
    if (start >= end) continue;

    const markRange = doc.createRange();
    markRange.setStart(node, start);
    markRange.setEnd(node, end);
    const mark = doc.createElement("span");
    mark.className = ACTIVE_SELECTION_MARK_CLASS;
    try {
      markRange.surroundContents(mark);
      marks.push(mark);
    } catch {
      markRange.detach();
    }
  }

  return () => {
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) continue;
      mark.replaceWith(...Array.from(mark.childNodes));
    }
  };
}

function ensureActiveSelectionHighlightStyle(): void {
  if (document.getElementById(ACTIVE_SELECTION_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ACTIVE_SELECTION_STYLE_ID;
  style.textContent = `
    ::highlight(${ACTIVE_SELECTION_HIGHLIGHT}) {
      background-color: var(--reader-selection-bg);
      color: var(--reader-selection-text);
    }
  `;
  document.head.appendChild(style);
}

function selectionOffsetsForRange(anchorContainer: HTMLElement | null, range: Range): SelectionOffsets | undefined {
  if (!anchorContainer || !anchorContainer.contains(range.commonAncestorContainer)) return undefined;
  return offsetsFromRange(anchorContainer, range) ?? undefined;
}

function readSelection(container: HTMLElement | null, anchorContainer: HTMLElement | null): SelectionState | null {
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
    range: clonedRange,
    offsets: selectionOffsetsForRange(anchorContainer, clonedRange),
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

function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  const editable = element.closest("[contenteditable]");
  return editable !== null && editable.getAttribute("contenteditable") !== "false";
}

function hasExternalSelectionIntent(container: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (active instanceof Element && isEditableElement(active) && !isInside(container, active)) return true;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  return container === null || !container.contains(range.commonAncestorContainer);
}

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function sameOffsets(a: SelectionOffsets | undefined, b: SelectionOffsets | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.startOffset === b.startOffset && a.length === b.length;
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
    sameOffsets(a.offsets, b.offsets) &&
    sameRect(a.rect, b.rect)
  );
}

function hasPointerEvents(): boolean {
  return typeof window.PointerEvent === "function";
}

function sameRange(a: Range, b: Range): boolean {
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

function clearWindowSelection(): void {
  window.getSelection()?.removeAllRanges();
}

function restoreWindowSelection(range: Range): void {
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount === 1 && sameRange(sel.getRangeAt(0), range)) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function rangeFromSelectionState(state: SelectionState | null, anchorContainer: HTMLElement | null): Range | null {
  if (!state) return null;
  if (state.offsets && anchorContainer) {
    return anchorRangeFromDom(anchorContainer, state.offsets.startOffset, state.offsets.length) ?? state.range;
  }
  return state.range;
}

export function useSelection(container: HTMLElement | null, options: SelectionOptions = {}): SelectionResult {
  const [state, setState] = useState<SelectionState | null>(null);
  const frameRef = useRef<number | null>(null);
  const restoreFrameRef = useRef<number | null>(null);
  const activeMarkCleanupRef = useRef<(() => void) | null>(null);
  const pointerDownActiveRef = useRef(false);
  const restoringRef = useRef(false);
  const hasSelection = state !== null;
  const anchorContainer = options.anchorContainer ?? null;
  const persistentVisual = options.persistentVisual ?? "custom-highlight";

  const suppressSelectionChangeForFrame = useCallback(() => {
    restoringRef.current = true;
    if (restoreFrameRef.current !== null) cancelFrame(restoreFrameRef.current);
    restoreFrameRef.current = requestFrame(() => {
      restoreFrameRef.current = null;
      restoringRef.current = false;
    });
  }, []);

  const clearActiveSelectionVisual = useCallback(() => {
    if (activeMarkCleanupRef.current) suppressSelectionChangeForFrame();
    setCustomActiveSelectionHighlight(null);
    activeMarkCleanupRef.current?.();
    activeMarkCleanupRef.current = null;
    setStickySelectionActive(false);
  }, [suppressSelectionChangeForFrame]);

  const syncActiveSelectionVisual = useCallback((range: Range | null) => {
    if (!range) {
      clearActiveSelectionVisual();
      return;
    }
    if (persistentVisual === "none") return;
    setStickySelectionActive(true);
    if (persistentVisual === "dom-mark") {
      suppressSelectionChangeForFrame();
      setCustomActiveSelectionHighlight(null);
      activeMarkCleanupRef.current?.();
      activeMarkCleanupRef.current = markActiveSelectionFallback(range);
      return;
    }
    if (setCustomActiveSelectionHighlight(range)) {
      activeMarkCleanupRef.current?.();
      activeMarkCleanupRef.current = null;
      return;
    }
    suppressSelectionChangeForFrame();
    activeMarkCleanupRef.current?.();
    activeMarkCleanupRef.current = markActiveSelectionFallback(range);
  }, [clearActiveSelectionVisual, persistentVisual, suppressSelectionChangeForFrame]);

  useLayoutEffect(() => {
    if (!container) return;
    syncActiveSelectionVisual(rangeFromSelectionState(state, anchorContainer));
    return clearActiveSelectionVisual;
  }, [
    anchorContainer,
    clearActiveSelectionVisual,
    container,
    state?.offsets?.length,
    state?.offsets?.startOffset,
    state?.range,
    syncActiveSelectionVisual,
  ]);

  const update = useCallback(() => {
    const next = readSelection(container, anchorContainer);
    setState((prev) => (sameSelection(prev, next) ? prev : next));
  }, [anchorContainer, container]);

  const updateGeometry = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const range = rangeFromSelectionState(prev, anchorContainer) ?? prev.range;
      const next: SelectionState = {
        ...prev,
        range,
        rect: range.getBoundingClientRect(),
      };
      return sameSelection(prev, next) ? prev : next;
    });
  }, [anchorContainer]);

  const clearSelection = useCallback(() => {
    suppressSelectionChangeForFrame();
    setState(null);
    clearActiveSelectionVisual();
    clearWindowSelection();
  }, [clearActiveSelectionVisual, suppressSelectionChangeForFrame]);

  const clearTrackedSelection = useCallback(() => {
    setState(null);
    clearActiveSelectionVisual();
  }, [clearActiveSelectionVisual]);

  const restoreTrackedSelection = useCallback((range: Range) => {
    suppressSelectionChangeForFrame();
    restoreWindowSelection(range);
  }, [suppressSelectionChangeForFrame]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      update();
    });
  }, [update]);

  const scheduleGeometryUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      updateGeometry();
    });
  }, [updateGeometry]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (restoringRef.current || pointerDownActiveRef.current) return;
      if (state && !readSelection(container, anchorContainer)) {
        if (hasExternalSelectionIntent(container)) {
          clearTrackedSelection();
          return;
        }
        const range = rangeFromSelectionState(state, anchorContainer);
        if (range) restoreTrackedSelection(range);
        return;
      }
      scheduleUpdate();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [anchorContainer, clearTrackedSelection, container, restoreTrackedSelection, scheduleUpdate, state]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (isToolbarTarget(event.target)) return;
      clearSelection();

      if (!isInside(container, event.target)) {
        pointerDownActiveRef.current = false;
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

    const downEvent = hasPointerEvents() ? "pointerdown" : "mousedown";
    const upEvent = hasPointerEvents() ? "pointerup" : "mouseup";
    const cancelEvent = hasPointerEvents() ? "pointercancel" : null;
    document.addEventListener(downEvent, handlePointerDown, true);
    window.addEventListener(upEvent, handlePointerUp, true);
    if (cancelEvent) window.addEventListener(cancelEvent, handlePointerUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener(downEvent, handlePointerDown, true);
      window.removeEventListener(upEvent, handlePointerUp, true);
      if (cancelEvent) window.removeEventListener(cancelEvent, handlePointerUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      if (frameRef.current !== null) {
        cancelFrame(frameRef.current);
        frameRef.current = null;
      }
      if (restoreFrameRef.current !== null) {
        cancelFrame(restoreFrameRef.current);
        restoreFrameRef.current = null;
      }
      restoringRef.current = false;
      clearActiveSelectionVisual();
    };
  }, [clearActiveSelectionVisual, clearSelection, container, scheduleUpdate]);

  useLayoutEffect(() => {
    if (!state) return;
    const range = rangeFromSelectionState(state, anchorContainer);
    if (range) restoreTrackedSelection(range);
  }, [anchorContainer, restoreTrackedSelection, state]);

  useLayoutEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isToolbarTarget(event.target)) return;
      if (event.shiftKey && event.key !== "Escape") return;
      if (SELECTION_CLEAR_KEYS.has(event.key) && readSelection(container, anchorContainer)) clearSelection();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [anchorContainer, clearSelection, container]);

  useEffect(() => {
    if (!hasSelection) return;
    const handleGeometryChange = () => {
      scheduleGeometryUpdate();
    };

    document.addEventListener("scroll", handleGeometryChange, true);
    window.addEventListener("resize", handleGeometryChange);
    return () => {
      document.removeEventListener("scroll", handleGeometryChange, true);
      window.removeEventListener("resize", handleGeometryChange);
    };
  }, [hasSelection, scheduleGeometryUpdate]);

  return { selection: state, clearSelection };
}
