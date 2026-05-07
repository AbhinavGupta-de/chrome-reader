import React from "react";
import RailButton from "./RailButton";
import type { LeftPanelId } from "../../hooks/usePanelState";

export const LEFT_RAIL_WIDTH_PX = 60;

interface LeftRailProps {
  activePanelId: LeftPanelId | null;
  visible: boolean;
  onActivatePanel: (panelId: LeftPanelId) => void;
  onOpenSettings: () => void;
}

export default function LeftRail({
  activePanelId,
  visible,
  onActivatePanel,
  onOpenSettings,
}: LeftRailProps) {
  if (!visible) return null;
  return (
    <nav
      aria-label="Primary navigation"
      className="flex flex-col items-center justify-between py-3 border-r border-oat bg-cream/60 flex-shrink-0"
      style={{ width: LEFT_RAIL_WIDTH_PX }}
    >
      <div className="flex flex-col gap-1">
        <RailButton
          label="Table of Contents"
          active={activePanelId === "toc"}
          onClick={() => onActivatePanel("toc")}
        >
          <TocIcon />
        </RailButton>
        <RailButton
          label="Library"
          active={activePanelId === "library"}
          onClick={() => onActivatePanel("library")}
        >
          <LibraryIcon />
        </RailButton>
      </div>
      <div>
        <RailButton label="Settings" active={false} onClick={onOpenSettings}>
          <SettingsIcon />
        </RailButton>
      </div>
    </nav>
  );
}

function TocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h12M3 9h12M3 14h8" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h3v12H3zM7 3h3v12H7zM12 4l3 1-2 11-3-1z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" />
    </svg>
  );
}
