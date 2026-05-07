import React from "react";
import Tooltip, { type TooltipPosition } from "../Tooltip";

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
  tooltipPosition?: TooltipPosition;
  children: React.ReactNode;
}

/**
 * Single icon button used by LeftRail and RightRail.
 * Wraps in a Clay-styled Tooltip instead of a native title.
 */
export default function RailButton({ label, active, onClick, badge, tooltipPosition = "right", children }: RailButtonProps) {
  return (
    <Tooltip label={label} position={tooltipPosition}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={`relative w-10 h-10 mx-auto flex items-center justify-center rounded-[12px] transition-colors ${
          active
            ? "bg-clay-black text-clay-white clay-shadow"
            : "text-charcoal hover:bg-frost"
        }`}
      >
        {children}
        {badge && (
          <span className="absolute -top-1 -right-1 text-[10px] font-semibold bg-pomegranate-400 text-white rounded-full px-1.5 leading-4 min-w-4 text-center">
            {badge}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
