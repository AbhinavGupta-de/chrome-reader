/**
 * Theme system types.
 *
 * Theme tokens map directly to CSS custom property names (without the leading `--`).
 * Each key MUST be a valid CSS custom-property name (kebab-case where needed).
 * Themes override the *values* of existing tokens — names are never renamed
 * because Tailwind v4 utilities (bg-cream, text-clay-black, etc.) depend on them.
 */

export type ThemeMode = "light" | "dark";
export type PdfTint = "normal" | "dark" | "sepia";

export interface ThemeTokens {
  cream: string;
  black: string;
  white: string;
  oat: string;
  "oat-light": string;
  silver: string;
  charcoal: string;
  "dark-charcoal": string;
  "cool-border": string;
  "matcha-300": string;
  "matcha-600": string;
  "matcha-800": string;
  "slushie-500": string;
  "lemon-400": string;
  "lemon-500": string;
  "ube-300": string;
  "ube-800": string;
  "pomegranate-400": string;
  "blueberry-800": string;
  "light-frost": string;
  "shadow-clay": string;
  "shadow-hover": string;
  "shadow-hover-sm": string;
  "reader-prose-bg"?: string;
}

export interface BuiltInThemeDef {
  readonly id: string;
  readonly name: string;
  readonly mode: ThemeMode;
  readonly pdfTint: PdfTint;
  readonly isCustom: false;
}

export interface CustomThemeDef {
  readonly id: string; // "custom-<uuid>"
  readonly name: string;
  readonly mode: ThemeMode;
  readonly pdfTint: PdfTint;
  readonly baseId: string; // preset this was forked from
  readonly tokens: Partial<ThemeTokens>;
  readonly createdAt: number;
  readonly isCustom: true;
}

export type ThemeDef = BuiltInThemeDef | CustomThemeDef;
