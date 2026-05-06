import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Settings from "../../src/newtab/components/Settings";
import { DEFAULT_SETTINGS } from "../../src/newtab/lib/storage";
import type { UseThemeResult } from "../../src/newtab/hooks/useTheme";
import { resetChromeStorageStub } from "../setup";

const themeStub: UseThemeResult = {
  activeThemeId: "light",
  presets: [],
  customThemes: [],
  setThemeId: vi.fn(),
  saveCustomTheme: vi.fn(async () => undefined),
  deleteCustomTheme: vi.fn(async () => undefined),
  resolveTheme: () => undefined,
};

describe("Settings tabs", () => {
  beforeEach(() => {
    resetChromeStorageStub();
  });

  it("doesNotRenderAppearanceTabAfterPhase3", () => {
    render(
      <Settings
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
        theme={themeStub}
      />,
    );
    expect(screen.queryByRole("button", { name: /Appearance/i })).toBeNull();
  });

  it("rendersThemesReaderAndPdfViewerTabs", () => {
    render(
      <Settings
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
        theme={themeStub}
      />,
    );
    expect(screen.getByRole("button", { name: /Themes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reader/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF Viewer/i })).toBeInTheDocument();
  });
});
