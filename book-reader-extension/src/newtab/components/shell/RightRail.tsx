import React from "react";
import RailButton from "./RailButton";
import Tooltip from "../Tooltip";
import type { RightPanelId } from "../../hooks/usePanelState";

export const RIGHT_RAIL_WIDTH_PX = 60;

interface RightRailUser {
  name: string;
  email: string;
}

interface RightRailProps {
  activePanelId: RightPanelId | null;
  visible: boolean;
  onActivatePanel: (panelId: RightPanelId) => void;
  user: RightRailUser | null;
  dueWordCount: number;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function RightRail({
  activePanelId,
  visible,
  onActivatePanel,
  user,
  dueWordCount,
  onSignIn,
  onSignOut,
}: RightRailProps) {
  if (!visible) return null;
  const dueBadge = dueWordCount > 0 ? dueWordCount : undefined;
  return (
    <nav
      aria-label="Tools navigation"
      className="flex flex-col items-center justify-between py-3 border-l border-oat bg-cream/60 flex-shrink-0"
      style={{ width: RIGHT_RAIL_WIDTH_PX }}
    >
      <div className="flex flex-col gap-1">
        <RailButton
          label="AI Assistant"
          active={activePanelId === "ai"}
          onClick={() => onActivatePanel("ai")}
          tooltipPosition="left"
        >
          <SparkleIcon />
        </RailButton>
        <RailButton
          label="Highlights"
          active={activePanelId === "highlights"}
          onClick={() => onActivatePanel("highlights")}
          tooltipPosition="left"
        >
          <HighlightIcon />
        </RailButton>
        <RailButton
          label="Words"
          active={activePanelId === "words"}
          onClick={() => onActivatePanel("words")}
          badge={dueBadge}
          tooltipPosition="left"
        >
          <BookIcon />
        </RailButton>
      </div>
      <div>
        {user ? (
          <Tooltip label={`Sign out (${user.email})`} position="left">
            <button
              type="button"
              onClick={onSignOut}
              aria-label={`Signed in as ${user.name}. Click to sign out.`}
              className="w-9 h-9 rounded-full bg-ube-800 flex items-center justify-center text-clay-white text-xs font-bold clay-shadow"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Sign in with Google" position="left">
            <button
              type="button"
              onClick={onSignIn}
              aria-label="Sign in with Google"
              className="w-9 h-9 rounded-full border border-oat flex items-center justify-center text-silver hover:text-clay-black hover:border-charcoal transition-colors"
            >
              <SignInIcon />
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v3M9 13v3M2 9h3M13 9h3M4.2 4.2l2 2M11.8 11.8l2 2M4.2 13.8l2-2M11.8 6.2l2-2" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14l4-4 7 7M11 4l3 3-7 7H4v-3z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h6a3 3 0 013 3v9a2 2 0 00-2-2H3z" />
      <path d="M15 3H9a3 3 0 00-3 3v9a2 2 0 012-2h7z" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 14c.8-2.5 2.8-4 5-4s4.2 1.5 5 4" />
    </svg>
  );
}
