import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSelection } from "../../src/newtab/hooks/useSelection";

function selectAllInside(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function selectTextOffsets(container: HTMLElement, startOffset: number, endOffset: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  let node = walker.nextNode();

  while (node) {
    const text = node as Text;
    const nextConsumed = consumed + text.data.length;
    if (!startNode && nextConsumed >= startOffset) {
      startNode = text;
      startNodeOffset = startOffset - consumed;
    }
    if (!endNode && nextConsumed >= endOffset) {
      endNode = text;
      endNodeOffset = endOffset - consumed;
      break;
    }
    consumed = nextConsumed;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) throw new Error("Could not map text offsets to DOM range");
  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function mouseEvent(type: "mousedown" | "mouseup", target: HTMLElement) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
}

function pointerEvent(type: "pointerdown" | "pointerup", target: HTMLElement) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true }));
}

class MockHighlight {
  ranges: Range[];

  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

function installCustomHighlightMock() {
  const store = new Map<string, MockHighlight>();
  const highlights = {
    set: vi.fn((name: string, highlight: MockHighlight) => {
      store.set(name, highlight);
    }),
    delete: vi.fn((name: string) => store.delete(name)),
    get: (name: string) => store.get(name),
    has: (name: string) => store.has(name),
  };
  vi.stubGlobal("CSS", { highlights });
  vi.stubGlobal("Highlight", MockHighlight);
  return highlights;
}

describe("useSelection", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = "<p>hello world</p>";
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    document.getElementById("reader-active-selection-style")?.remove();
    document.documentElement.classList.remove("reader-sticky-selection-active");
    window.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is selected", () => {
    const { result } = renderHook(() => useSelection(host));
    expect(result.current.selection).toBeNull();
  });

  it("returns the selected text and a position when a selection exists inside the container", async () => {
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection).not.toBeNull());
    expect(result.current.selection!.text).toBe("hello world");
    expect(typeof result.current.selection!.rect.top).toBe("number");
  });

  it("registers the active selection as a CSS custom highlight", async () => {
    const highlights = installCustomHighlightMock();
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });

    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));
    await waitFor(() => expect(highlights.get("reader-active-selection")?.ranges[0].toString()).toBe("hello world"));
    expect(document.documentElement).toHaveClass("reader-sticky-selection-active");
    expect(highlights.set).toHaveBeenCalledTimes(1);
  });

  it("falls back to inline text marks when CSS custom highlights are unavailable", async () => {
    vi.stubGlobal("CSS", {});
    vi.stubGlobal("Highlight", undefined);
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });

    await waitFor(() => expect(host.querySelector(".reader-active-selection-mark")?.textContent).toBe("hello world"));

    act(() => {
      result.current.clearSelection();
    });

    expect(host.querySelector(".reader-active-selection-mark")).toBeNull();
    expect(host.textContent).toBe("hello world");
  });

  it("uses inline text marks when configured even if CSS custom highlights are available", async () => {
    const highlights = installCustomHighlightMock();
    const { result } = renderHook(() => useSelection(host, { persistentVisual: "dom-mark" }));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });

    await waitFor(() => expect(host.querySelector(".reader-active-selection-mark")?.textContent).toBe("hello world"));
    expect(result.current.selection?.text).toBe("hello world");
    expect(highlights.set).not.toHaveBeenCalled();
  });

  it("captures stable anchor offsets before inline marks wrap the selection", async () => {
    host.innerHTML = "<p>hello <strong>wide</strong> world</p>";
    const { result } = renderHook(() => useSelection(host, { anchorContainer: host, persistentVisual: "dom-mark" }));

    act(() => {
      selectTextOffsets(host, 3, 14);
    });

    await waitFor(() => expect(result.current.selection?.text).toBe("lo wide wor"));
    await waitFor(() => expect(host.querySelector(".reader-active-selection-mark")).not.toBeNull());
    expect(result.current.selection?.offsets).toEqual({ startOffset: 3, length: 11 });
  });

  it("restores from anchor offsets after selected DOM nodes are replaced", async () => {
    installCustomHighlightMock();
    host.innerHTML = "<p>hello <strong>wide</strong> world</p>";
    const { result } = renderHook(() => useSelection(host, { anchorContainer: host }));

    act(() => {
      selectTextOffsets(host, 3, 14);
    });

    await waitFor(() => expect(result.current.selection?.offsets).toEqual({ startOffset: 3, length: 11 }));

    act(() => {
      host.innerHTML = "<p>hello <strong>wide</strong> world</p>";
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });

    await waitFor(() => expect(window.getSelection()?.toString()).toBe("lo wide wor"));
    expect(result.current.selection?.text).toBe("lo wide wor");
  });

  it("cleans fallback marks without normalizing away selected range nodes", async () => {
    const normalizeSpy = vi.spyOn(Node.prototype, "normalize");
    const { result } = renderHook(() => useSelection(host, { persistentVisual: "dom-mark" }));

    act(() => {
      selectTextOffsets(host, 0, 5);
    });

    await waitFor(() => expect(host.querySelector(".reader-active-selection-mark")?.textContent).toBe("hello"));
    const selectedNode = result.current.selection!.range.startContainer;

    act(() => {
      result.current.clearSelection();
    });

    expect(host.querySelector(".reader-active-selection-mark")).toBeNull();
    expect(selectedNode.isConnected).toBe(true);
    expect(host.textContent).toBe("hello world");
    expect(normalizeSpy).not.toHaveBeenCalled();
    normalizeSpy.mockRestore();
  });

  it("ignores selections outside the container", () => {
    const outside = document.createElement("p");
    outside.textContent = "ignore me";
    document.body.appendChild(outside);
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(outside);
    });
    expect(result.current.selection).toBeNull();
    outside.remove();
  });

  it("waits until mouseup before publishing a mouse-drag selection", async () => {
    const target = host.querySelector("p")!;
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      mouseEvent("mousedown", target);
      selectAllInside(target);
    });

    expect(result.current.selection).toBeNull();

    act(() => {
      mouseEvent("mouseup", target);
    });

    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));
  });

  it("waits until pointerup before publishing a pointer selection when pointer events are available", async () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const target = host.querySelector("p")!;
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      pointerEvent("pointerdown", target);
      selectAllInside(target);
    });

    expect(result.current.selection).toBeNull();

    act(() => {
      pointerEvent("pointerup", target);
    });

    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));
  });

  it("clears the active reader selection on outside mousedown", async () => {
    const highlights = installCustomHighlightMock();
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      mouseEvent("mousedown", outside);
    });

    expect(result.current.selection).toBeNull();
    expect(window.getSelection()?.rangeCount).toBe(0);
    expect(highlights.has("reader-active-selection")).toBe(false);
    expect(document.documentElement).not.toHaveClass("reader-sticky-selection-active");
    outside.remove();
  });

  it("keeps the active reader selection on toolbar mousedown", async () => {
    const toolbar = document.createElement("div");
    toolbar.setAttribute("data-selection-toolbar", "");
    const button = document.createElement("button");
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      mouseEvent("mousedown", button);
    });

    expect(result.current.selection?.text).toBe("hello world");
    expect(window.getSelection()?.toString()).toBe("hello world");
    toolbar.remove();
  });

  it("restores the browser selection while the toolbar state is active", async () => {
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });

    await waitFor(() => {
      expect(result.current.selection?.text).toBe("hello world");
      expect(window.getSelection()?.toString()).toBe("hello world");
    });
  });

  it("does not restore selection after explicit clearSelection", async () => {
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      result.current.clearSelection();
      document.dispatchEvent(new Event("selectionchange"));
    });

    expect(result.current.selection).toBeNull();
    expect(window.getSelection()?.rangeCount).toBe(0);
  });

  it("clears instead of restoring when keyboard navigation collapses the selection", async () => {
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });

    await waitFor(() => expect(result.current.selection).toBeNull());
    expect(window.getSelection()?.rangeCount).toBe(0);
  });

  it("keeps the active reader selection when shift-arrow extends it", async () => {
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
    });

    expect(result.current.selection?.text).toBe("hello world");
    expect(window.getSelection()?.toString()).toBe("hello world");
  });

  it("does not restore reader selection over an editable selection outside the reader", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current.selection?.text).toBe("hello world"));

    act(() => {
      input.focus();
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });

    await waitFor(() => expect(result.current.selection).toBeNull());
    expect(document.activeElement).toBe(input);
    input.remove();
  });

});
