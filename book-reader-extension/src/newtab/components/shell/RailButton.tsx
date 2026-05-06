import React from "react";

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Single icon button used by LeftRail and RightRail.
 * - aria-pressed reflects active panel state
 * - tooltip shows on hover
 */
export default function RailButton({ label, active, onClick, badge, children }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
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
  );
}
