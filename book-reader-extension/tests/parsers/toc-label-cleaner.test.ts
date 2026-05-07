import { describe, it, expect } from "vitest";
import { cleanTocLabel } from "../../src/newtab/lib/parsers/toc-quality";

describe("cleanTocLabel", () => {
  it("trimsLeadingAndTrailingWhitespace", () => {
    // Arrange
    const rawLabel = "  Chapter 1 ";

    // Act
    const cleaned = cleanTocLabel(rawLabel);

    // Assert
    expect(cleaned).toBe("Chapter 1");
  });

  it("returnsEmptyForFilenameOnlyLabels", () => {
    expect(cleanTocLabel("ch01.xhtml")).toBe("");
    expect(cleanTocLabel("part_2.html")).toBe("");
    expect(cleanTocLabel("toc.htm")).toBe("");
    expect(cleanTocLabel("nav.xml")).toBe("");
    expect(cleanTocLabel("CHAPTER.XHTML")).toBe("");
  });

  it("returnsEmptyForLongAllCapsJunk", () => {
    // 40 chars all uppercase letters — the hallmark of "TOC label is just a generated id".
    const longAllCaps = "A".repeat(40);

    expect(cleanTocLabel(longAllCaps)).toBe("");
  });

  it("returnsEmptyForLongPunctuationOnlyJunk", () => {
    const longJunk = "!@#$%^&*()_+{}|:<>?~`-=[]\\;',./".repeat(2);

    expect(cleanTocLabel(longJunk)).toBe("");
  });

  it("keepsShortAllCapsTitlesLikeRomanNumerals", () => {
    // Roman numerals and short caps are valid section labels — must not be
    // discarded by the all-caps-junk heuristic.
    expect(cleanTocLabel("I")).toBe("I");
    expect(cleanTocLabel("XIV")).toBe("XIV");
    expect(cleanTocLabel("PROLOGUE")).toBe("PROLOGUE");
  });

  it("keepsLabelsWithMixedCaseEvenIfLong", () => {
    const longMixed = "An Extraordinarily Long Chapter Title That Goes On And On";

    expect(cleanTocLabel(longMixed)).toBe(longMixed);
  });

  it("returnsEmptyForEmptyInput", () => {
    expect(cleanTocLabel("")).toBe("");
    expect(cleanTocLabel("   ")).toBe("");
  });
});
