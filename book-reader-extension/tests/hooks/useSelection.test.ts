import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelection } from "../../src/newtab/hooks/useSelection";

function selectAllInside(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
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
  });

  it("returns null when nothing is selected", () => {
    const { result } = renderHook(() => useSelection(host));
    expect(result.current).toBeNull();
  });

  it("returns the selected text and a position when a selection exists inside the container", () => {
    const { result } = renderHook(() => useSelection(host));
    act(() => {
      selectAllInside(host.querySelector("p")!);
    });
    expect(result.current).not.toBeNull();
    expect(result.current!.text).toBe("hello world");
    expect(typeof result.current!.rect.top).toBe("number");
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
});
