import { describe, it, expect } from "vitest";
import { buildAnchor, resolveAnchor, anchorRangeFromDom } from "../../../src/newtab/lib/highlights/anchor";

describe("buildAnchor", () => {
  it("captures offsets and bounded context", () => {
    const plain = "The quick brown fox jumps over the lazy dog";
    const anchor = buildAnchor(plain, 10, 5, 0); // "brown"
    expect(anchor.startOffset).toBe(10);
    expect(anchor.length).toBe(5);
    expect(anchor.contextBefore).toBe("The quick ");
    expect(anchor.contextAfter).toBe(" fox jumps over the lazy dog");
  });

  it("clamps context to 50 chars", () => {
    const plain = "x".repeat(100) + "TARGET" + "y".repeat(100);
    const anchor = buildAnchor(plain, 100, 6, 0);
    expect(anchor.contextBefore.length).toBe(50);
    expect(anchor.contextAfter.length).toBe(50);
  });
});

describe("resolveAnchor", () => {
  const plain = "The quick brown fox jumps over the lazy dog";

  it("finds the same offset by direct match", () => {
    const anchor = { chapterIndex: 0, startOffset: 10, length: 5, contextBefore: "The quick ", contextAfter: " fox jumps" };
    expect(resolveAnchor(plain, anchor)).toEqual({ startOffset: 10, length: 5 });
  });

  it("re-finds after content shifts (extra prefix)", () => {
    const shifted = "INTRO. " + plain;
    const anchor = { chapterIndex: 0, startOffset: 10, length: 5, contextBefore: "The quick ", contextAfter: " fox jumps" };
    expect(resolveAnchor(shifted, anchor)).toEqual({ startOffset: 17, length: 5 });
  });

  it("returns null when context cannot be located", () => {
    const anchor = { chapterIndex: 0, startOffset: 10, length: 5, contextBefore: "ZZZ ", contextAfter: " QQQ" };
    expect(resolveAnchor(plain, anchor)).toBeNull();
  });
});

describe("anchorRangeFromDom", () => {
  it("returns a Range spanning the resolved offsets", () => {
    const host = document.createElement("div");
    host.innerHTML = "<p>The quick <b>brown</b> fox</p>";
    document.body.appendChild(host);
    try {
      // plain text length 18: "The quick brown fox"
      const r = anchorRangeFromDom(host, 10, 5);
      expect(r).not.toBeNull();
      expect(r!.toString()).toBe("brown");
    } finally {
      host.remove();
    }
  });
});
