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
  return { text, rect: range.getBoundingClientRect(), range };
}

export function useSelection(container: HTMLElement | null): SelectionState | null {
  const [state, setState] = useState<SelectionState | null>(null);

  const update = useCallback(() => {
    setState(readSelection(container));
  }, [container]);

  useEffect(() => {
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [update]);

  return state;
}
