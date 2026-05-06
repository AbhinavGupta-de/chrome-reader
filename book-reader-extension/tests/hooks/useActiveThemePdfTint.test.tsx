import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useActiveThemePdfTint } from "../../src/newtab/hooks/useActiveThemePdfTint";

const PDF_TINT_VAR = "--pdf-tint";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  cleanup();
});

describe("useActiveThemePdfTint", () => {
  it("returns 'normal' when no --pdf-tint is set on the root", () => {
    const { result } = renderHook(() => useActiveThemePdfTint());

    expect(result.current).toBe("normal");
  });

  it("returns the inline --pdf-tint value when present", () => {
    document.documentElement.style.setProperty(PDF_TINT_VAR, "sepia");

    const { result } = renderHook(() => useActiveThemePdfTint());

    expect(result.current).toBe("sepia");
  });

  it("updates when --pdf-tint changes after mount", async () => {
    document.documentElement.style.setProperty(PDF_TINT_VAR, "normal");
    const { result } = renderHook(() => useActiveThemePdfTint());

    await act(async () => {
      document.documentElement.style.setProperty(PDF_TINT_VAR, "dark");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe("dark");
  });

  it("falls back to 'normal' when --pdf-tint is set to a value outside the allowed set", () => {
    document.documentElement.style.setProperty(PDF_TINT_VAR, "neon");

    const { result } = renderHook(() => useActiveThemePdfTint());

    expect(result.current).toBe("normal");
  });

  it("disconnects its MutationObserver on unmount", async () => {
    document.documentElement.style.setProperty(PDF_TINT_VAR, "normal");
    const { result, unmount } = renderHook(() => useActiveThemePdfTint());

    unmount();

    await act(async () => {
      document.documentElement.style.setProperty(PDF_TINT_VAR, "sepia");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe("normal");
  });
});
