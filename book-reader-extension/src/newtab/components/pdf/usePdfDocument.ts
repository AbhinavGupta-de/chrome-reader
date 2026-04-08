import { useState, useEffect } from "react";
import { getBook } from "../../lib/storage";

export interface PdfDocState {
  pdfDoc: any | null;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

export function usePdfDocument(bookHash: string): PdfDocState {
  const [state, setState] = useState<PdfDocState>({
    pdfDoc: null,
    totalPages: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof pdfjsLib === "undefined") {
          setState({ pdfDoc: null, totalPages: 0, loading: false, error: "PDF engine not loaded" });
          return;
        }

        if (typeof chrome !== "undefined" && chrome.runtime) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
        }

        const data = await getBook(bookHash);
        if (!data || cancelled) {
          if (!cancelled) setState({ pdfDoc: null, totalPages: 0, loading: false, error: "Book data not found" });
          return;
        }

        const pdf = await pdfjsLib.getDocument({
          data: data.slice(0),
          isEvalSupported: false,
        }).promise;

        if (cancelled) return;
        setState({ pdfDoc: pdf, totalPages: pdf.numPages, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          console.error("PDF load error:", err);
          setState({ pdfDoc: null, totalPages: 0, loading: false, error: "Failed to load PDF" });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [bookHash]);

  return state;
}
