import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import AppShell from "../../src/newtab/components/AppShell";
import {
  usePanelState,
  type UsePanelStateResult,
} from "../../src/newtab/hooks/usePanelState";
import { DEFAULT_SETTINGS, type ReaderSettings } from "../../src/newtab/lib/storage";
import { resetChromeStorageStub } from "../setup";

interface HarnessProps {
  settings: ReaderSettings;
  initialLeftPanel?: "toc" | "library" | null;
  initialRightPanel?: "ai" | "highlights" | "words" | null;
  onPanelReady?: (panel: UsePanelStateResult) => void;
  onSettingsChange?: (settings: ReaderSettings) => void;
}

function Harness({
  settings,
  initialLeftPanel = null,
  initialRightPanel = null,
  onPanelReady,
  onSettingsChange = () => undefined,
}: HarnessProps) {
  const panel = usePanelState();

  useEffect(() => {
    if (!panel.hydrated) return;
    if (initialLeftPanel) panel.openLeftPanel(initialLeftPanel);
    if (initialRightPanel) panel.openRightPanel(initialRightPanel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.hydrated]);

  // Notify parent on every render so it can read the latest panel state.
  useEffect(() => {
    onPanelReady?.(panel);
  });

  return (
    <AppShell
      settings={settings}
      onSettingsChange={onSettingsChange}
      panel={panel}
      topBarExpanded={false}
      onTopBarExpand={() => undefined}
      onTopBarCollapse={() => undefined}
      bookTitle="Book"
      bookAuthor="Author"
      bookFormat="epub"
      readingTimeMinutes={null}
      user={null}
      dueWordCount={0}
      onSignIn={() => undefined}
      onSignOut={() => undefined}
      onOpenSettings={() => undefined}
      leftPanelTitle="TOC"
      rightPanelTitle="AI"
      leftPanelContent={<div data-testid="left-content" />}
      rightPanelContent={<div data-testid="right-content" />}
    >
      <div data-testid="reader" />
    </AppShell>
  );
}

describe("AppShell rail visibility", () => {
  beforeEach(() => {
    resetChromeStorageStub();
  });

  it("hidesLeftRailWhenSettingShowLeftRailIsFalse", async () => {
    render(<Harness settings={{ ...DEFAULT_SETTINGS, showLeftRail: false }} />);
    await waitFor(() => {
      expect(screen.queryByLabelText(/primary navigation/i)).toBeNull();
    });
  });

  it("forcesLeftPanelClosedWhenLeftRailIsHidden", async () => {
    let capturedPanel: UsePanelStateResult | null = null;
    const { rerender } = render(
      <Harness
        settings={DEFAULT_SETTINGS}
        initialLeftPanel="toc"
        onPanelReady={(panel) => {
          capturedPanel = panel;
        }}
      />,
    );
    await waitFor(() => {
      expect(capturedPanel?.panelState.left).toBe("toc");
    });
    rerender(
      <Harness
        settings={{ ...DEFAULT_SETTINGS, showLeftRail: false }}
        initialLeftPanel="toc"
        onPanelReady={(panel) => {
          capturedPanel = panel;
        }}
      />,
    );
    await waitFor(() => {
      expect(capturedPanel?.panelState.left).toBeNull();
    });
  });

  it("ignoresLeftBracketShortcutWhenLeftRailIsHidden", async () => {
    let capturedPanel: UsePanelStateResult | null = null;
    render(
      <Harness
        settings={{ ...DEFAULT_SETTINGS, showLeftRail: false }}
        onPanelReady={(panel) => {
          capturedPanel = panel;
        }}
      />,
    );
    await waitFor(() => expect(capturedPanel).not.toBeNull());
    fireEvent.keyDown(window, { key: "[" });
    expect(capturedPanel?.panelState.left).toBeNull();
  });

  it("opensLeftPanelWhenLeftBracketShortcutPressedAndRailVisible", async () => {
    let capturedPanel: UsePanelStateResult | null = null;
    render(
      <Harness
        settings={DEFAULT_SETTINGS}
        onPanelReady={(panel) => {
          capturedPanel = panel;
        }}
      />,
    );
    await waitFor(() => expect(capturedPanel).not.toBeNull());
    fireEvent.keyDown(window, { key: "[" });
    expect(capturedPanel?.panelState.left).toBe("toc");
  });

  it("closesFocusedPanelOnEscape", async () => {
    let capturedPanel: UsePanelStateResult | null = null;
    render(
      <Harness
        settings={DEFAULT_SETTINGS}
        initialRightPanel="ai"
        onPanelReady={(panel) => {
          capturedPanel = panel;
        }}
      />,
    );
    await waitFor(() => {
      expect(capturedPanel?.panelState.right).toBe("ai");
    });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(capturedPanel?.panelState.right).toBeNull();
    });
  });
});
