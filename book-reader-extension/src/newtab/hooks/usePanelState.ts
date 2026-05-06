import { useCallback, useEffect, useRef, useState } from "react";

export type LeftPanelId = "toc" | "library";
export type RightPanelId = "ai" | "highlights" | "words";
export type AnyPanelId = LeftPanelId | RightPanelId;

export interface PanelState {
  left: LeftPanelId | null;
  right: RightPanelId | null;
  widths: Partial<Record<AnyPanelId, number>>;
}

export const PANEL_STATE_STORAGE_KEY = "panel_state";
export const MIN_PANEL_WIDTH_PX = 220;
export const MAX_PANEL_WIDTH_PX = 460;
export const DEFAULT_PANEL_WIDTH_PX = 280;

const INITIAL_PANEL_STATE: PanelState = {
  left: null,
  right: null,
  widths: {},
};

function clampPanelWidth(widthPx: number): number {
  if (widthPx < MIN_PANEL_WIDTH_PX) return MIN_PANEL_WIDTH_PX;
  if (widthPx > MAX_PANEL_WIDTH_PX) return MAX_PANEL_WIDTH_PX;
  return widthPx;
}

function readStoredPanelState(): Promise<PanelState> {
  return chrome.storage.local
    .get(PANEL_STATE_STORAGE_KEY)
    .then((result: Record<string, unknown>) => {
      const stored = result[PANEL_STATE_STORAGE_KEY] as Partial<PanelState> | undefined;
      if (!stored) return INITIAL_PANEL_STATE;
      return {
        left: (stored.left ?? null) as LeftPanelId | null,
        right: (stored.right ?? null) as RightPanelId | null,
        widths: stored.widths ?? {},
      };
    });
}

function writePanelState(state: PanelState): Promise<void> {
  return chrome.storage.local.set({ [PANEL_STATE_STORAGE_KEY]: state });
}

export interface UsePanelStateResult {
  panelState: PanelState;
  hydrated: boolean;
  openLeftPanel: (panelId: LeftPanelId) => void;
  closeLeftPanel: () => void;
  toggleLeftPanel: (panelId: LeftPanelId) => void;
  openRightPanel: (panelId: RightPanelId) => void;
  closeRightPanel: () => void;
  toggleRightPanel: (panelId: RightPanelId) => void;
  setPanelWidth: (panelId: AnyPanelId, widthPx: number) => void;
  getPanelWidth: (panelId: AnyPanelId) => number;
}

export function usePanelState(): UsePanelStateResult {
  const [panelState, setPanelState] = useState<PanelState>(INITIAL_PANEL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const panelStateRef = useRef(panelState);

  useEffect(() => {
    panelStateRef.current = panelState;
  }, [panelState]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    readStoredPanelState().then((loaded) => {
      if (cancelled) return;
      setPanelState(loaded);
      hydratedRef.current = true;
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-tab sync — re-read the persisted shape when another tab writes it.
  useEffect(() => {
    const handleStorageChanged = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ): void => {
      if (areaName !== "local") return;
      const change = changes[PANEL_STATE_STORAGE_KEY];
      if (!change) return;
      const next = change.newValue as Partial<PanelState> | undefined;
      if (!next) return;
      setPanelState({
        left: (next.left ?? null) as LeftPanelId | null,
        right: (next.right ?? null) as RightPanelId | null,
        widths: next.widths ?? {},
      });
    };
    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, []);

  const persist = useCallback((next: PanelState) => {
    panelStateRef.current = next;
    setPanelState(next);
    if (hydratedRef.current) {
      void writePanelState(next);
    }
  }, []);

  const openLeftPanel = useCallback(
    (panelId: LeftPanelId) => {
      persist({ ...panelStateRef.current, left: panelId });
    },
    [persist],
  );

  const closeLeftPanel = useCallback(() => {
    persist({ ...panelStateRef.current, left: null });
  }, [persist]);

  const toggleLeftPanel = useCallback(
    (panelId: LeftPanelId) => {
      const current = panelStateRef.current.left;
      persist({
        ...panelStateRef.current,
        left: current === panelId ? null : panelId,
      });
    },
    [persist],
  );

  const openRightPanel = useCallback(
    (panelId: RightPanelId) => {
      persist({ ...panelStateRef.current, right: panelId });
    },
    [persist],
  );

  const closeRightPanel = useCallback(() => {
    persist({ ...panelStateRef.current, right: null });
  }, [persist]);

  const toggleRightPanel = useCallback(
    (panelId: RightPanelId) => {
      const current = panelStateRef.current.right;
      persist({
        ...panelStateRef.current,
        right: current === panelId ? null : panelId,
      });
    },
    [persist],
  );

  const setPanelWidth = useCallback(
    (panelId: AnyPanelId, widthPx: number) => {
      const clamped = clampPanelWidth(widthPx);
      persist({
        ...panelStateRef.current,
        widths: { ...panelStateRef.current.widths, [panelId]: clamped },
      });
    },
    [persist],
  );

  const getPanelWidth = useCallback(
    (panelId: AnyPanelId): number =>
      panelStateRef.current.widths[panelId] ?? DEFAULT_PANEL_WIDTH_PX,
    [],
  );

  return {
    panelState,
    hydrated,
    openLeftPanel,
    closeLeftPanel,
    toggleLeftPanel,
    openRightPanel,
    closeRightPanel,
    toggleRightPanel,
    setPanelWidth,
    getPanelWidth,
  };
}
