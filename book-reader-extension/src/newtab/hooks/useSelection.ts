import { useEffect, useState, useCallback } from "react";

export interface SelectionState {
  text: string;
  rect: DOMRect;
  range: Range;
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
  return { text, rect: clonedRange.getBoundingClientRect(), range: clonedRange };
}

export function useSelection(container: HTMLElement | null): SelectionState | null {
  const [state, setState] = useState<SelectionState | null>(null);

  const update = useCallback(() => {
    const next = readSelection(container);
    setState((prev) => (prev === null && next === null ? prev : next));
  }, [container]);

  useEffect(() => {
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [update]);

  return state;
}
