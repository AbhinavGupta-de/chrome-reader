import type { TocNode } from "./epub";
import { cleanTocLabel } from "./toc-quality";

/**
 * Parse an EPUB3 nav.xhtml document into a `TocNode` tree.
 *
 * Walks the `<nav epub:type="toc">` element's nested `<ol> > <li> > <a>`
 * structure recursively. Hrefs are normalised against the supplied spine
 * paths so each node carries its `spineIndex` (or `-1` if unresolvable).
 *
 * Caller passes the raw XML text from `book.archive.getText(navPath)` and
 * the list of spine hrefs from `book.spine.items`.
 */
export function parseTocFromNavXhtml(
  navXhtml: string,
  spineHrefs: string[],
): TocNode[] {
  const navDocument = parseNavDocument(navXhtml);
  if (!navDocument) return [];

  const tocNavElement = findTocNavElement(navDocument);
  if (!tocNavElement) return [];

  const rootList = tocNavElement.querySelector(":scope > ol");
  if (!rootList) return [];

  const spineHrefMap = buildSpineHrefMap(spineHrefs);
  return walkNavList(rootList, "", spineHrefMap);
}

/**
 * Parse an EPUB2 toc.ncx document into a `TocNode` tree.
 *
 * Walks `<navMap> > <navPoint>` recursively — labels come from
 * `<navLabel><text>` and hrefs from `<content src="...">`. Element names
 * are case-sensitive (XML), so the walk uses tag-name matching rather than
 * CSS selectors.
 */
export function parseTocFromNcx(
  ncxXml: string,
  spineHrefs: string[],
): TocNode[] {
  const ncxDocument = parseXml(ncxXml, "application/xml");
  if (!ncxDocument) return [];

  const navMap = findChildByLocalName(ncxDocument.documentElement, "navMap");
  if (!navMap) return [];

  const spineHrefMap = buildSpineHrefMap(spineHrefs);
  const topNavPoints = findChildrenByLocalName(navMap, "navPoint");
  return topNavPoints.map((navPoint, index) =>
    buildNcxNode(navPoint, String(index), spineHrefMap),
  );
}

// ---------------------------------------------------------------------------
// EPUB3 nav.xhtml helpers
// ---------------------------------------------------------------------------

function parseNavDocument(navXhtml: string): Document | null {
  // XHTML is stricter than HTML; if it parses cleanly we use it. On parse
  // error fall back to lenient HTML mode (some publishers emit nav files
  // with subtly malformed XHTML — Calibre, etc.).
  const xhtmlAttempt = parseXml(navXhtml, "application/xhtml+xml");
  if (xhtmlAttempt && !hasParserError(xhtmlAttempt)) return xhtmlAttempt;

  const htmlAttempt = parseXml(navXhtml, "text/html");
  if (htmlAttempt && !hasParserError(htmlAttempt)) return htmlAttempt;

  return null;
}

function findTocNavElement(navDocument: Document): Element | null {
  const navElements = Array.from(navDocument.getElementsByTagName("nav"));
  for (const navElement of navElements) {
    const epubType =
      navElement.getAttributeNS(
        "http://www.idpf.org/2007/ops",
        "type",
      ) ?? navElement.getAttribute("epub:type");
    if (epubType === "toc") return navElement;
  }
  // Some publishers emit a single bare <nav> with no epub:type. Fall back
  // to the first one rather than refusing to parse.
  return navElements[0] ?? null;
}

function walkNavList(
  listElement: Element,
  parentId: string,
  spineHrefMap: Map<string, number>,
): TocNode[] {
  const childItems = Array.from(listElement.children).filter(
    (child) => child.tagName.toLowerCase() === "li",
  );
  return childItems.map((listItem, index) =>
    buildNavNode(listItem, treePathId(parentId, index), spineHrefMap),
  );
}

function buildNavNode(
  listItem: Element,
  nodeId: string,
  spineHrefMap: Map<string, number>,
): TocNode {
  const anchor = Array.from(listItem.children).find(
    (child) => child.tagName.toLowerCase() === "a",
  );
  const rawHref = anchor?.getAttribute("href") ?? "";
  const rawLabel = (anchor?.textContent ?? "").replace(/\s+/g, " ").trim();

  const nestedList = Array.from(listItem.children).find(
    (child) => child.tagName.toLowerCase() === "ol",
  );
  const children = nestedList ? walkNavList(nestedList, nodeId, spineHrefMap) : [];

  return buildResolvedNode(nodeId, rawLabel, rawHref, spineHrefMap, children);
}

// ---------------------------------------------------------------------------
// EPUB2 toc.ncx helpers
// ---------------------------------------------------------------------------

function buildNcxNode(
  navPoint: Element,
  nodeId: string,
  spineHrefMap: Map<string, number>,
): TocNode {
  const navLabel = findChildByLocalName(navPoint, "navLabel");
  const labelText = navLabel
    ? findChildByLocalName(navLabel, "text")
    : null;
  const rawLabel = (labelText?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const contentElement = findChildByLocalName(navPoint, "content");
  const rawHref = contentElement?.getAttribute("src") ?? "";

  const childNavPoints = findChildrenByLocalName(navPoint, "navPoint");
  const children = childNavPoints.map((childPoint, childIndex) =>
    buildNcxNode(childPoint, treePathId(nodeId, childIndex), spineHrefMap),
  );

  return buildResolvedNode(nodeId, rawLabel, rawHref, spineHrefMap, children);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildResolvedNode(
  nodeId: string,
  rawLabel: string,
  rawHref: string,
  spineHrefMap: Map<string, number>,
  children: TocNode[],
): TocNode {
  const { pathPart, fragment } = splitHrefAndFragment(rawHref);
  const spineIndex = resolveSpineIndex(pathPart, spineHrefMap);
  const cleanedLabel = cleanTocLabel(rawLabel);
  const fallbackLabel =
    spineIndex >= 0 ? `Chapter ${spineIndex + 1}` : `Section ${nodeId}`;

  return {
    id: nodeId,
    label: cleanedLabel || fallbackLabel,
    href: rawHref,
    spineIndex,
    fragment,
    children,
  };
}

/** Tree-path id assignment: "0", "0.1", "0.1.2". */
function treePathId(parentId: string, childIndex: number): string {
  return parentId === "" ? String(childIndex) : `${parentId}.${childIndex}`;
}

interface HrefParts {
  pathPart: string;
  fragment: string | null;
}

function splitHrefAndFragment(rawHref: string): HrefParts {
  if (!rawHref) return { pathPart: "", fragment: null };
  const hashIndex = rawHref.indexOf("#");
  if (hashIndex < 0) return { pathPart: rawHref, fragment: null };
  const pathPart = rawHref.slice(0, hashIndex);
  const rawFragment = rawHref.slice(hashIndex + 1);
  if (!rawFragment) return { pathPart, fragment: null };
  let urlDecodedFragment: string;
  try {
    urlDecodedFragment = decodeURIComponent(rawFragment);
  } catch {
    urlDecodedFragment = rawFragment;
  }
  return { pathPart, fragment: urlDecodedFragment };
}

/**
 * Build a lookup keyed by both the raw spine href and a "normalised" form
 * (no leading "./", no trailing fragment). Hrefs in nav/ncx files are
 * relative to the nav file's directory; hrefs in `book.spine.items` may
 * include a directory prefix like `OEBPS/`. Storing both forms lets us
 * match either.
 */
function buildSpineHrefMap(spineHrefs: string[]): Map<string, number> {
  const map = new Map<string, number>();
  spineHrefs.forEach((spineHref, index) => {
    const variants = hrefVariants(spineHref);
    for (const variant of variants) {
      if (!map.has(variant)) map.set(variant, index);
    }
  });
  return map;
}

function hrefVariants(href: string): string[] {
  const variants = new Set<string>();
  variants.add(href);
  const noLeadingDot = href.replace(/^\.\//, "");
  variants.add(noLeadingDot);
  const lastSlash = noLeadingDot.lastIndexOf("/");
  if (lastSlash >= 0) variants.add(noLeadingDot.slice(lastSlash + 1));
  return Array.from(variants);
}

function resolveSpineIndex(
  rawPath: string,
  spineHrefMap: Map<string, number>,
): number {
  if (!rawPath) return -1;
  const candidates = hrefVariants(rawPath);
  for (const candidate of candidates) {
    const index = spineHrefMap.get(candidate);
    if (index !== undefined) return index;
  }
  return -1;
}

function parseXml(xmlString: string, mimeType: DOMParserSupportedType): Document | null {
  if (!xmlString) return null;
  const parser = new DOMParser();
  try {
    return parser.parseFromString(xmlString, mimeType);
  } catch {
    return null;
  }
}

function hasParserError(document: Document): boolean {
  return document.getElementsByTagName("parsererror").length > 0;
}

function findChildByLocalName(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (matchesLocalName(child, localName)) return child;
  }
  return null;
}

function findChildrenByLocalName(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((child) =>
    matchesLocalName(child, localName),
  );
}

function matchesLocalName(element: Element, localName: string): boolean {
  // NCX is case-sensitive XML — local names match exactly. The browser
  // sometimes lowercases tag names when parsing as HTML; check both.
  if (element.localName === localName) return true;
  if (element.tagName === localName) return true;
  return false;
}
