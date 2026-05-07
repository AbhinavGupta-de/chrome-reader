import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TopBar from "../../src/newtab/components/shell/TopBar";
import { DEFAULT_SETTINGS } from "../../src/newtab/lib/storage";
import { resetChromeStorageStub } from "../setup";

describe("TopBar", () => {
  beforeEach(() => {
    resetChromeStorageStub();
  });

  function renderTopBar({
    expanded = false,
    onExpand = vi.fn(),
    onCollapse = vi.fn(),
    onSettingsChange = vi.fn(),
  }: Partial<{
    expanded: boolean;
    onExpand: () => void;
    onCollapse: () => void;
    onSettingsChange: (settings: typeof DEFAULT_SETTINGS) => void;
  }> = {}) {
    const utils = render(
      <TopBar
        bookTitle="A Tale of Two Cities"
        bookAuthor="Charles Dickens"
        bookFormat="epub"
        readingTimeMinutes={12}
        expanded={expanded}
        onExpand={onExpand}
        onCollapse={onCollapse}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={onSettingsChange}
      />,
    );
    return { ...utils, onExpand, onCollapse, onSettingsChange };
  }

  it("rendersCollapsedStripWithBookTitleAndChevron", () => {
    renderTopBar();
    expect(screen.getByText("A Tale of Two Cities")).toBeInTheDocument();
    expect(screen.getByLabelText(/expand reader controls/i)).toBeInTheDocument();
  });

  it("invokesOnExpandWhenChevronStripClicked", () => {
    const { onExpand } = renderTopBar();
    fireEvent.click(screen.getByLabelText(/expand reader controls/i));
    expect(onExpand).toHaveBeenCalled();
  });

  it("rendersInlineReaderControlsWhenExpanded", () => {
    renderTopBar({ expanded: true });
    expect(screen.getByLabelText(/Size/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Spacing/i, { selector: "input" })).toBeInTheDocument();
  });

  it("collapsesOnEscape", () => {
    const { onCollapse } = renderTopBar({ expanded: true });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCollapse).toHaveBeenCalled();
  });

  it("propagatesFontSizeChangeThroughOnSettingsChange", () => {
    const { onSettingsChange } = renderTopBar({ expanded: true });
    const sizeInput = screen.getByLabelText(/Size/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(sizeInput, { target: { value: "22" } });
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 22 }),
    );
  });
});
