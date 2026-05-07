import { getPresetById, isKnownPresetId } from "./presets";
import type {
  CustomThemeDef,
  PdfTint,
  ThemeDef,
  ThemeMode,
  ThemeTokens,
} from "./types";

const FALLBACK_PRESET_ID = "light";
const APPLIED_INLINE_TOKEN_KEYS_ATTR = "data-applied-inline-tokens";
const DATA_THEME_ATTR = "data-theme";
const DARK_CLASS_NAME = "dark";
const PDF_TINT_CSS_VAR = "--pdf-tint";
const APPLIED_KEY_DELIMITER = ",";

function findThemeById(
  themeId: string,
  customThemes: ReadonlyArray<CustomThemeDef>,
): ThemeDef | undefined {
  if (isKnownPresetId(themeId)) return getPresetById(themeId);
  return customThemes.find((customTheme) => customTheme.id === themeId);
}

function clearPreviouslyAppliedInlineTokens(html: HTMLElement): void {
  const previousKeysSerialized = html.getAttribute(APPLIED_INLINE_TOKEN_KEYS_ATTR);
  if (!previousKeysSerialized) return;

  const previousKeys = previousKeysSerialized
    .split(APPLIED_KEY_DELIMITER)
    .filter(Boolean);
  for (const tokenKey of previousKeys) {
    html.style.removeProperty(`--${tokenKey}`);
  }
  html.removeAttribute(APPLIED_INLINE_TOKEN_KEYS_ATTR);
}

function applyInlineTokens(
  html: HTMLElement,
  tokens: Partial<ThemeTokens>,
): void {
  const appliedKeys: string[] = [];
  for (const [tokenKey, tokenValue] of Object.entries(tokens)) {
    if (typeof tokenValue !== "string") continue;
    html.style.setProperty(`--${tokenKey}`, tokenValue);
    appliedKeys.push(tokenKey);
  }
  if (appliedKeys.length > 0) {
    html.setAttribute(
      APPLIED_INLINE_TOKEN_KEYS_ATTR,
      appliedKeys.join(APPLIED_KEY_DELIMITER),
    );
  }
}

function applyDataThemeAttribute(html: HTMLElement, dataThemeValue: string): void {
  html.setAttribute(DATA_THEME_ATTR, dataThemeValue);
}

function applyDarkClass(html: HTMLElement, mode: ThemeMode): void {
  html.classList.toggle(DARK_CLASS_NAME, mode === "dark");
}

function applyPdfTint(html: HTMLElement, tint: PdfTint): void {
  html.style.setProperty(PDF_TINT_CSS_VAR, tint);
}

/**
 * Activates a theme by id. The only side-effects are on document.documentElement.
 *
 * Algorithm:
 *   1. Clear all CSS custom properties this function set on its previous run
 *      (tracked via the `data-applied-inline-tokens` attribute) so a switch
 *      from a custom theme back to a preset doesn't leave stale inline overrides.
 *   2. Resolve the theme definition. Unknown ids fall back to the light preset.
 *   3. For built-in presets: set `data-theme="<id>"` so the matching block in
 *      themes.css activates.
 *   4. For custom themes: set `data-theme="<baseId>"` (so unmapped tokens inherit
 *      from the base preset) and apply per-token overrides inline via setProperty.
 *   5. Toggle the `dark` class so Tailwind `dark:` variants follow theme mode.
 *   6. Write `--pdf-tint` inline so the PDF viewer can read it via getComputedStyle.
 */
export function applyTheme(
  themeId: string,
  customThemes: ReadonlyArray<CustomThemeDef>,
): void {
  const html = document.documentElement;
  const fallbackTheme = getPresetById(FALLBACK_PRESET_ID);
  if (!fallbackTheme) {
    throw new Error(
      `Theme registry is missing the required fallback preset "${FALLBACK_PRESET_ID}".`,
    );
  }
  const resolvedTheme = findThemeById(themeId, customThemes) ?? fallbackTheme;

  clearPreviouslyAppliedInlineTokens(html);

  if (resolvedTheme.isCustom) {
    applyDataThemeAttribute(html, resolvedTheme.baseId);
    applyInlineTokens(html, resolvedTheme.tokens);
  } else {
    applyDataThemeAttribute(html, resolvedTheme.id);
  }

  applyDarkClass(html, resolvedTheme.mode);
  applyPdfTint(html, resolvedTheme.pdfTint);
}
