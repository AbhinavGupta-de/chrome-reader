import React, { useCallback, useEffect, useRef } from "react";
import {
  MAX_PANEL_WIDTH_PX,
  MIN_PANEL_WIDTH_PX,
} from "../../hooks/usePanelState";
import Tooltip from "../Tooltip";

export type PanelSide = "left" | "right";

interface PanelProps {
  side: PanelSide;
  widthPx: number;
  title: string;
  onClose: () => void;
  onWidthChange: (widthPx: number) => void;
  children: React.ReactNode;
}

/**
 * Generic resizable side panel container.
 *
 * - Renders a header (title + close X) and a scrollable body.
 * - Drag handle lives on the inner edge (right edge for left panels,
 *   left edge for right panels).
 * - Width is clamped to [MIN_PANEL_WIDTH_PX, MAX_PANEL_WIDTH_PX].
 */
export default function Panel({
  side,
  widthPx,
  title,
  onClose,
  onWidthChange,
  children,
}: PanelProps) {
  const isLeftPanel = side === "left";
  const handlePointerDown = useDragResizeHandle(side, onWidthChange);

  const borderClass = isLeftPanel ? "border-r" : "border-l";
  const handleAlignment = isLeftPanel ? "right-0" : "left-0";
  const slideAnimation = isLeftPanel ? "slide-in-left" : "slide-in-right";

  return (
    <aside
      role="complementary"
      aria-label={title}
      className={`${borderClass} border-oat bg-clay-white flex flex-col h-full relative ${slideAnimation}`}
      style={{ width: widthPx, minWidth: MIN_PANEL_WIDTH_PX, maxWidth: MAX_PANEL_WIDTH_PX }}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-oat flex-shrink-0">
        <h3 className="text-sm font-semibold tracking-tight" style={{ letterSpacing: "-0.2px" }}>
          {title}
        </h3>
        <Tooltip label="Close panel" position="bottom">
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title} panel`}
            className="clay-btn-white !p-1.5 !rounded-[8px]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </Tooltip>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
      <button
        type="button"
        aria-label="Drag to resize panel"
        onPointerDown={handlePointerDown}
        className={`absolute top-0 ${handleAlignment} h-full w-1 cursor-col-resize bg-transparent hover:bg-matcha-300/40 active:bg-matcha-600/60 transition-colors`}
      />
    </aside>
  );
}

function useDragResizeHandle(
  side: PanelSide,
  onWidthChange: (widthPx: number) => void,
) {
  const onWidthChangeRef = useRef(onWidthChange);
  useEffect(() => {
    onWidthChangeRef.current = onWidthChange;
  }, [onWidthChange]);

  return useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = (event.currentTarget.parentElement as HTMLElement | null)
        ?.getBoundingClientRect().width ?? 0;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const nextWidth = side === "left" ? startWidth + deltaX : startWidth - deltaX;
        onWidthChangeRef.current(nextWidth);
      };
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [side],
  );
}
