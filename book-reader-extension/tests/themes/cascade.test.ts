import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyTheme } from "../../src/newtab/lib/themes/apply";

const PROJECT_ROOT = process.cwd();
const THEMES_CSS_PATH = resolve(PROJECT_ROOT, "src/newtab/themes.css");

const LIGHT_DEFAULT_BASE_CSS = `
  :root {
    --cream: #faf9f7;
    --black: #000000;
    --reader-prose-bg: transparent;
    --pdf-tint: normal;
  }
  .dark { /* empty marker */ }
`;

function readComputedCream(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--cream")
    .trim();
}

beforeAll(() => {
  const themesCss = readFileSync(THEMES_CSS_PATH, "utf8");
  const styleEl = document.createElement("style");
  styleEl.textContent = `${LIGHT_DEFAULT_BASE_CSS}\n${themesCss}`;
  document.head.appendChild(styleEl);
});

describe("theme cascade", () => {
  it("usesLightRootDefaultWhenNoThemeIsActive", () => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");

    expect(readComputedCream()).toBe("#faf9f7");
  });

  it("draculaOverridesCreamRegardlessOfCascadeOrder", () => {
    applyTheme("dracula", []);

    expect(readComputedCream()).toBe("#282a36");
  });

  it("nordOverridesCream", () => {
    applyTheme("nord", []);

    expect(readComputedCream()).toBe("#2e3440");
  });

  it("returnsToLightDefaultWhenLightIsReapplied", () => {
    applyTheme("dracula", []);

    applyTheme("light", []);

    expect(readComputedCream()).toBe("#faf9f7");
  });
});
