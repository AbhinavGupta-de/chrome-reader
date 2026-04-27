import React, { useState, useCallback, useEffect, useRef } from "react";
import { usePdfDocument } from "./usePdfDocument";
import PdfToolbar from "./PdfToolbar";
import PdfThumbnails from "./PdfThumbnails";
import PdfSingleView from "./PdfSingleView";
import PdfContinuousView from "./PdfContinuousView";
import PdfSpreadView from "./PdfSpreadView";
import { ReaderSettings, saveSettings } from "../../lib/storage";
import { useSelection } from "../../hooks/useSelection";
import SelectionToolbar, { ToolbarAction, HighlightColor } from "../SelectionToolbar";

export type PdfViewMode = "single" | "continuous" | "spread";
export type PdfColorMode = "normal" | "dark" | "sepia";

interface PdfViewerProps {
  bookHash: string;
  initialPage: number;
  initialScrollOffset: number;
  settings: ReaderSettings;
  onPositionChange: (chapterIndex: number, scrollOffset: number, percentage: number) => void;
  onSelectionAction?: (
    action: ToolbarAction,
    payload: { text: string; range: Range; rect: DOMRect; color?: HighlightColor; chapterIndex: number; chapterText: string }
  ) => void;
  hasExplain?: boolean;
  aiAvailable?: boolean;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.05;

export default function PdfViewer({ bookHash, initialPage, initialScrollOffset, settings, onPositionChange, onSelectionAction, hasExplain = false, aiAvailable = false }: PdfViewerProps) {
  const { pdfDoc, totalPages, loading, error } = usePdfDocument(bookHash);

  const startPage = Math.max(1, initialPage);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<PdfViewMode>(settings.pdfViewMode ?? "continuous");
  const [colorMode, setColorMode] = useState<PdfColorMode>(settings.pdfColorMode ?? "normal");
  const [showThumbnails, setShowThumbnails] = useState(settings.pdfShowThumbnails ?? false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const attachContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setContainerEl(el);
  }, []);
  const currentPageRef = useRef(startPage);
  const currentScrollRatioRef = useRef(initialScrollOffset);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setViewMode(settings.pdfViewMode ?? "continuous");
    setColorMode(settings.pdfColorMode ?? "normal");
    setShowThumbnails(settings.pdfShowThumbnails ?? false);
  }, [settings.pdfViewMode, settings.pdfColorMode, settings.pdfShowThumbnails]);

  const savePage = useCallback(
    (page: number, scrollRatio?: number) => {
      currentPageRef.current = page;
      const ratio = scrollRatio ?? currentScrollRatioRef.current;
      currentScrollRatioRef.current = ratio;
      const pct = totalPages > 0 ? ((page - 1 + ratio) / totalPages) * 100 : 0;
      onPositionChange(page - 1, ratio, pct);
    },
    [totalPages, onPositionChange]
  );

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages || 1));
      setCurrentPage(clamped);
      currentPageRef.current = clamped;
      currentScrollRatioRef.current = 0;
      savePage(clamped, 0);
    },
    [totalPages, savePage]
  );

  const handlePageChange = useCallback(
    (page: number, scrollRatio: number = 0) => {
      currentScrollRatioRef.current = scrollRatio;
      if (page !== currentPageRef.current) {
        setCurrentPage(page);
        currentPageRef.current = page;
      }
      savePage(page, scrollRatio);
    },
    [savePage]
  );

  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  const handleViewModeChange = useCallback((mode: PdfViewMode) => {
    setViewMode(mode);
    saveSettings({ ...settingsRef.current, pdfViewMode: mode });
  }, []);

  const handleColorModeChange = useCallback((mode: PdfColorMode) => {
    setColorMode(mode);
    saveSettings({ ...settingsRef.current, pdfColorMode: mode });
  }, []);

  const handleToggleThumbnails = useCallback(() => {
    setShowThumbnails((prev) => {
      const next = !prev;
      saveSettings({ ...settingsRef.current, pdfShowThumbnails: next });
      return next;
    });
  }, []);

  const selection = useSelection(containerEl);

  const dispatchAction = useCallback(
    (action: ToolbarAction, _payload?: { color?: HighlightColor }) => {
      if (!selection || !onSelectionAction) return;
      onSelectionAction(action, {
        text: selection.text,
        range: selection.range,
        rect: selection.rect,
        color: undefined,
        chapterIndex: currentPageRef.current - 1,
        chapterText: "",
      });
      if (action !== "highlight") {
        window.getSelection()?.removeAllRanges();
      }
    },
    [selection, onSelectionAction]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (viewMode === "single") {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goToPage(currentPageRef.current - 1); }
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); goToPage(currentPageRef.current + 1); }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); zoomOut(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, goToPage, zoomIn, zoomOut, zoomReset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else if (e.deltaY > 0) zoomOut();
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomIn, zoomOut]);

  useEffect(() => {
    if (pdfDoc && startPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
      currentPageRef.current = 1;
    }
  }, [pdfDoc, totalPages, startPage]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-cream items-center justify-center">
        <div className="w-6 h-6 border-2 border-clay-black border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-silver mt-3">Loading PDF&hellip;</p>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="flex flex-col h-full bg-cream items-center justify-center px-6">
        <p className="text-sm text-pomegranate-400 mb-2">{error || "Failed to load PDF"}</p>
        <p className="text-xs text-silver text-center">Try reloading the extension or re-importing the PDF.</p>
      </div>
    );
  }

  const viewProps = {
    pdfDoc,
    totalPages,
    currentPage,
    zoom,
    colorMode,
    onPageChange: handlePageChange,
    initialScrollOffset,
  };

  return (
    <div ref={attachContainerRef} className="flex flex-col h-full bg-cream">
      <PdfToolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        viewMode={viewMode}
        colorMode={colorMode}
        showThumbnails={showThumbnails}
        showViewMode={settings.pdfShowViewMode ?? true}
        showPageNav={settings.pdfShowPageNav ?? true}
        showColorMode={settings.pdfShowColorMode ?? true}
        showZoom={settings.pdfShowZoom ?? true}
        onGoToPage={goToPage}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onViewModeChange={handleViewModeChange}
        onColorModeChange={handleColorModeChange}
        onToggleThumbnails={handleToggleThumbnails}
        zoomMin={ZOOM_MIN}
        zoomMax={ZOOM_MAX}
      />

      <div className="flex flex-1 overflow-hidden">
        {showThumbnails && (
          <PdfThumbnails
            pdfDoc={pdfDoc}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageSelect={goToPage}
          />
        )}

        {viewMode === "single" && <PdfSingleView {...viewProps} />}
        {viewMode === "continuous" && <PdfContinuousView {...viewProps} />}
        {viewMode === "spread" && <PdfSpreadView {...viewProps} />}
      </div>

      {selection && (
        <SelectionToolbar
          rect={selection.rect}
          hasExplain={hasExplain}
          aiAvailable={aiAvailable}
          isPdf={true}
          onAction={dispatchAction}
        />
      )}
    </div>
  );
}
