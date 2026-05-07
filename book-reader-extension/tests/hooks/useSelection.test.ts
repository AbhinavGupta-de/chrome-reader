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

function mouseEvent(type: "mousedown" | "mouseup", target: HTMLElement) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
}

function pointerEvent(type: "pointerdown" | "pointerup", target: HTMLElement) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true }));
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
    window.getSelection()?.removeAllRanges();
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is selected", () => {
    const { result } = renderHook(() => useSelection(host));
    expect(result.current).toBeNull();
  });

  it("returns the selected text and a position when a selection exists inside the container", async () => {
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.text).toBe("hello world");
    expect(typeof result.current!.rect.top).toBe("number");
  });

  it("captures client rects for the visible sticky selection overlay", async () => {
    const originalGetClientRects = Range.prototype.getClientRects;
    const rect = {
      x: 12,
      y: 20,
      top: 20,
      left: 12,
      bottom: 34,
      right: 112,
      width: 100,
      height: 14,
      toJSON: () => ({}),
    } as DOMRect;
    try {
      Range.prototype.getClientRects = vi.fn(() => ({
        length: 1,
        item: (index: number) => (index === 0 ? rect : null),
        [Symbol.iterator]: function* () {
          yield rect;
        },
      }) as DOMRectList);
      const { result } = renderHook(() => useSelection(host));

      act(() => {
        selectAllInside(host.querySelector("p")!);
      });

      await waitFor(() => expect(result.current?.rects).toHaveLength(1));
      expect(result.current!.rects[0]).toMatchObject({ left: 12, top: 20, width: 100, height: 14 });
    } finally {
      Range.prototype.getClientRects = originalGetClientRects;
    }
  });

  it("ignores selections outside the container", () => {
    const outside = document.createElement("p");
    outside.textContent = "ignore me";
    document.body.appendChild(outside);
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(outside);
    });
    expect(result.current).toBeNull();
    outside.remove();
  });

  it("waits until mouseup before publishing a mouse-drag selection", async () => {
    const target = host.querySelector("p")!;
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      mouseEvent("mousedown", target);
      selectAllInside(target);
    });

    expect(result.current).toBeNull();

    act(() => {
      mouseEvent("mouseup", target);
    });

    await waitFor(() => expect(result.current?.text).toBe("hello world"));
  });

  it("waits until pointerup before publishing a pointer selection when pointer events are available", async () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const target = host.querySelector("p")!;
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      pointerEvent("pointerdown", target);
      selectAllInside(target);
    });

    expect(result.current).toBeNull();

    act(() => {
      pointerEvent("pointerup", target);
    });

    await waitFor(() => expect(result.current?.text).toBe("hello world"));
  });

  it("clears the active reader selection on outside mousedown", async () => {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    const { result } = renderHook(() => useSelection(host));

    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    await waitFor(() => expect(result.current?.text).toBe("hello world"));

    act(() => {
      mouseEvent("mousedown", outside);
    });

    expect(result.current).toBeNull();
    expect(window.getSelection()?.rangeCount).toBe(0);
    outside.remove();
  });

});
