import { useEffect, useRef } from "react";

export function useDismissable<T extends HTMLElement>(
  active: boolean,
  onDismiss: () => void
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && ref.current && !ref.current.contains(target)) {
        onDismiss();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, onDismiss]);
  return ref;
}
