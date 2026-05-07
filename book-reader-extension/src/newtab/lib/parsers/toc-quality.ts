import type { TocNode } from "./epub";

/**
 * Threshold a TOC must clear to be considered useful enough to show without
 * falling back to the spine. 60% of nodes carrying real (non-default,
 * non-empty) labels is the empirical sweet spot.
 */
export const MIN_QUALITY_SCORE = 0.6;

/**
 * A TOC must have at least this many nodes total to be considered usable.
 * One node is enough — even a single real chapter title beats the flat
 * spine with `Chapter 1 … N`.
 */
export const MIN_USEFUL_TOC_NODES = 1;

/**
 * Above this length, an all-uppercase or all-punctuation label is treated as
 * generated junk (typically an internal id). Short caps strings like roman
 * numerals or "PROLOGUE" must remain valid.
 */
export const MAX_ALLCAPS_JUNK_LENGTH = 30;

const FILENAME_PATTERN = /\.(x?html?|xml|htm)$/i;
const ALLCAPS_OR_PUNCT_PATTERN =
  /^[A-Z0-9!@#$%^&*()\-_=+{}\[\]|\\;:'",.<>?/~`\s]+$/;

const DEFAULT_LABEL_PATTERN = /^(?:Chapter|Section)\s+\d+$/;

/**
 * Normalise a raw TOC label into something fit for display.
 * Returns "" when the label is unsalvageable so callers can substitute a
 * generated default (e.g. `Chapter <N>`).
 */
export function cleanTocLabel(rawLabel: string): string {
  const trimmed = rawLabel.trim();
  if (!trimmed) return "";
  if (FILENAME_PATTERN.test(trimmed)) return "";
  if (
    trimmed.length > MAX_ALLCAPS_JUNK_LENGTH &&
    ALLCAPS_OR_PUNCT_PATTERN.test(trimmed)
  ) {
    return "";
  }
  return trimmed;
}

function isUsefulLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (DEFAULT_LABEL_PATTERN.test(trimmed)) return false;
  return true;
}

function countNodes(toc: TocNode[]): number {
  let total = 0;
  const walkAndCount = (nodes: TocNode[]): void => {
    for (const node of nodes) {
      total += 1;
      if (node.children.length > 0) walkAndCount(node.children);
    }
  };
  walkAndCount(toc);
  return total;
}

function countUsefulNodes(toc: TocNode[]): number {
  let useful = 0;
  const walkAndCount = (nodes: TocNode[]): void => {
    for (const node of nodes) {
      if (isUsefulLabel(node.label)) useful += 1;
      if (node.children.length > 0) walkAndCount(node.children);
    }
  };
  walkAndCount(toc);
  return useful;
}

/**
 * Fraction of TOC nodes (recursive, including children) whose label is a
 * real human-readable title — i.e. not empty and not the auto-generated
 * `Chapter N` / `Section N` default. Returns 0 for an empty tree.
 */
export function tocQualityScore(toc: TocNode[]): number {
  const totalNodes = countNodes(toc);
  if (totalNodes === 0) return 0;
  const usefulNodes = countUsefulNodes(toc);
  return usefulNodes / totalNodes;
}

/**
 * Whether a TOC clears the bar to ship to the user (vs falling back to the
 * flat spine numbering). True iff the score meets `MIN_QUALITY_SCORE` and
 * the tree has at least `MIN_USEFUL_TOC_NODES` nodes.
 */
export function isTocGoodEnough(toc: TocNode[]): boolean {
  if (countNodes(toc) < MIN_USEFUL_TOC_NODES) return false;
  return tocQualityScore(toc) >= MIN_QUALITY_SCORE;
}
