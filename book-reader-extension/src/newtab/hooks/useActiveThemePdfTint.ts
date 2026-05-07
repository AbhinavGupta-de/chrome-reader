import { useEffect, useState } from "react";
import type { PdfTint } from "../lib/themes/types";

const PDF_TINT_CSS_VAR = "--pdf-tint";
const VALID_PDF_TINTS: ReadonlySet<PdfTint> = new Set<PdfTint>(["normal", "dark", "sepia"]);
const DATA_THEME_ATTR = "data-theme";
const DARK_CLASS_NAME = "dark";
const FALLBACK_TINT: PdfTint = "normal";

function readPdfTintFromActiveTheme(): PdfTint {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(PDF_TINT_CSS_VAR).trim();
  return VALID_PDF_TINTS.has(raw as PdfTint) ? (raw as PdfTint) : FALLBACK_TINT;
}

/**
 * Tracks the currently-active theme's `--pdf-tint` so the PDF viewer can pick it up
 * whenever the user has not set an explicit `pdfTintOverride`.
 *
 * `applyTheme` writes `--pdf-tint` inline on `<html>` and toggles the `dark` class.
 * We observe both attributes so a theme switch from anywhere (Settings, hotkeys, etc.)
 * propagates without prop drilling.
 */
export function useActiveThemePdfTint(): PdfTint {
  const [tint, setTint] = useState<PdfTint>(() => readPdfTintFromActiveTheme());

  useEffect(() => {
    const html = document.documentElement;
    const updateFromCurrentStyle = () => setTint(readPdfTintFromActiveTheme());

    updateFromCurrentStyle();

    const observer = new MutationObserver(updateFromCurrentStyle);
    observer.observe(html, {
      attributes: true,
      attributeFilter: [DATA_THEME_ATTR, "style", "class"],
    });

    return () => observer.disconnect();
  }, []);

  return tint;
}

export const __testing__ = {
  PDF_TINT_CSS_VAR,
  DATA_THEME_ATTR,
  DARK_CLASS_NAME,
  FALLBACK_TINT,
};
