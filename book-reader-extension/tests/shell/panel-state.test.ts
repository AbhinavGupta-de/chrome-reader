import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  DEFAULT_PANEL_WIDTH_PX,
  MAX_PANEL_WIDTH_PX,
  MIN_PANEL_WIDTH_PX,
  PANEL_STATE_STORAGE_KEY,
  usePanelState,
} from "../../src/newtab/hooks/usePanelState";
import { resetChromeStorageStub } from "../setup";

describe("usePanelState", () => {
  beforeEach(() => {
    resetChromeStorageStub();
  });

  it("startsWithBothPanelsClosedAndDefaultWidth", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.panelState.left).toBeNull();
    expect(result.current.panelState.right).toBeNull();
    expect(result.current.getPanelWidth("toc")).toBe(DEFAULT_PANEL_WIDTH_PX);
  });

  it("opensLeftPanelByActivatingTocIcon", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.openLeftPanel("toc"));
    expect(result.current.panelState.left).toBe("toc");
  });

  it("togglesLeftPanelClosedWhenSameIconClickedTwice", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.toggleLeftPanel("library"));
    expect(result.current.panelState.left).toBe("library");
    act(() => result.current.toggleLeftPanel("library"));
    expect(result.current.panelState.left).toBeNull();
  });

  it("replacesLeftPanelWhenDifferentIconActivated", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.openLeftPanel("toc"));
    act(() => result.current.openLeftPanel("library"));
    expect(result.current.panelState.left).toBe("library");
  });

  it("keepsLeftAndRightPanelsIndependentSoOnlyOnePerSideAtATime", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => {
      result.current.openLeftPanel("toc");
      result.current.openRightPanel("ai");
    });
    expect(result.current.panelState.left).toBe("toc");
    expect(result.current.panelState.right).toBe("ai");
  });

  it("clampsPanelWidthBelowMinimumAndAboveMaximum", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.setPanelWidth("toc", 50));
    expect(result.current.getPanelWidth("toc")).toBe(MIN_PANEL_WIDTH_PX);
    act(() => result.current.setPanelWidth("toc", 9999));
    expect(result.current.getPanelWidth("toc")).toBe(MAX_PANEL_WIDTH_PX);
  });

  it("persistsPanelWidthAcrossReload", async () => {
    const first = renderHook(() => usePanelState());
    await waitFor(() => expect(first.result.current.hydrated).toBe(true));
    act(() => first.result.current.setPanelWidth("library", 350));
    await waitFor(() => {
      const stored = (chrome.storage.local as unknown as { _store: Record<string, unknown> })._store[
        PANEL_STATE_STORAGE_KEY
      ] as { widths: Record<string, number> } | undefined;
      expect(stored?.widths.library).toBe(350);
    });

    const reloaded = renderHook(() => usePanelState());
    await waitFor(() => expect(reloaded.result.current.hydrated).toBe(true));
    expect(reloaded.result.current.getPanelWidth("library")).toBe(350);
  });

  it("syncsAcrossTabsViaChromeStorageOnChanged", async () => {
    const { result } = renderHook(() => usePanelState());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await chrome.storage.local.set({
        [PANEL_STATE_STORAGE_KEY]: {
          left: "library",
          right: "highlights",
          widths: { highlights: 320 },
        },
      });
    });
    expect(result.current.panelState.left).toBe("library");
    expect(result.current.panelState.right).toBe("highlights");
    expect(result.current.getPanelWidth("highlights")).toBe(320);
  });
});
