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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h12" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
