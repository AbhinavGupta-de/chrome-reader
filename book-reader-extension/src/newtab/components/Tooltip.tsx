import React, { useState, useRef, useCallback } from "react";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  label: string;
  position?: TooltipPosition;
  delay?: number;
  shortcut?: string;
  children: React.ReactElement;
}

/**
 * Clay-styled tooltip that appears on hover after an optional delay.
 * Renders a portal-free absolutely-positioned bubble relative to the wrapper.
 *
 * Usage:
 *   <Tooltip label="Open library" shortcut="⌘L">
 *     <button>...</button>
 *   </Tooltip>
 */
export default function Tooltip({
  label,
  position = "top",
  delay = 400,
  shortcut,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const positionClasses: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<TooltipPosition, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-clay-black border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-clay-black border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-clay-black border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-clay-black border-y-transparent border-l-transparent",
  };

  const arrowSize: Record<TooltipPosition, string> = {
    top: "border-[4px]",
    bottom: "border-[4px]",
    left: "border-[4px]",
    right: "border-[4px]",
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-100 whitespace-nowrap pointer-events-none tooltip-fade-in ${positionClasses[position]}`}
        >
          <span className="inline-flex items-center gap-1.5 bg-clay-black text-clay-white text-[11px] font-medium px-2.5 py-1 rounded-[8px] shadow-md">
            {label}
            {shortcut && (
              <kbd className="text-[10px] font-mono opacity-60 bg-white/10 px-1 rounded-[3px]">
                {shortcut}
              </kbd>
            )}
          </span>
          <span
            className={`absolute w-0 h-0 ${arrowSize[position]} ${arrowClasses[position]}`}
          />
        </span>
      )}
    </span>
  );
}
