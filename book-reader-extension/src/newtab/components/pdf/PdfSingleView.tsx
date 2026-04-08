import React, { useRef, useEffect, useState } from "react";
import PdfPage from "./PdfPage";
import type { PdfColorMode } from "./PdfViewer";

interface PdfSingleViewProps {
  pdfDoc: any;
  totalPages: number;
  currentPage: number;
  zoom: number;
  colorMode: PdfColorMode;
  onPageChange: (page: number) => void;
}

export default function PdfSingleView({
  pdfDoc,
  currentPage,
  zoom,
  colorMode,
}: PdfSingleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const pageMaxWidth = Math.max(200, containerWidth - 48);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto flex justify-center items-start py-6 px-6"
      style={{ background: "var(--oat, #e8e5e0)" }}
    >
      {containerWidth > 0 && (
        <PdfPage
          pdfDoc={pdfDoc}
          pageNumber={currentPage}
          zoom={zoom}
          colorMode={colorMode}
          maxWidth={pageMaxWidth}
        />
      )}
    </div>
  );
}
