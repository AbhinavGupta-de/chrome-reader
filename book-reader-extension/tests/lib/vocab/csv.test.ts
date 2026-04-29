import { describe, it, expect } from "vitest";
import { escapeCsvField, wordsToCsv } from "../../../src/newtab/lib/vocab/csv";
import { VocabWord } from "../../../src/newtab/lib/vocab/types";

const NOW = new Date("2026-04-30T12:00:00Z").getTime();

function fixture(overrides: Partial<VocabWord> = {}): VocabWord {
  return {
    id: "id1",
    word: "elucidate",
    phonetic: "/ɪˈluːsɪdeɪt/",
    definitions: [{ partOfSpeech: "verb", definition: "make clear", example: "She elucidated her point." }],
    contexts: [{ bookHash: "bookA", bookTitle: "Book A", chapterIndex: 2, sentence: "elucidate the dark matter", savedAt: NOW }],
    stage: 3,
    mastered: false,
    nextReviewAt: NOW,
    correctStreak: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("escapeCsvField", () => {
  it("returns plain text unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });
  it("wraps and doubles quotes", () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });
  it("wraps fields containing commas", () => {
    expect(escapeCsvField("a, b")).toBe('"a, b"');
  });
  it("wraps fields containing newlines", () => {
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
  });
});

describe("wordsToCsv", () => {
  it("emits header + one row per word", () => {
    const csv = wordsToCsv([fixture()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Word,Phonetic,Definition,Example,Contexts,FirstSeen,Stage");
    expect(lines).toHaveLength(2);
  });

  it("formats a row correctly with date and stage", () => {
    const csv = wordsToCsv([fixture()]);
    const row = csv.split("\n")[1];
    expect(row).toContain("elucidate");
    expect(row).toContain("/ɪˈluːsɪdeɪt/");
    expect(row).toContain("make clear");
    expect(row).toContain("2026-04-30");
    expect(row).toContain(",3");
  });

  it("renders Mastered as the literal string", () => {
    const csv = wordsToCsv([fixture({ mastered: true, stage: 5 })]);
    const row = csv.split("\n")[1];
    expect(row.endsWith(",Mastered")).toBe(true);
  });

  it("escapes contexts containing quotes / commas / newlines", () => {
    const w = fixture({
      contexts: [
        { bookHash: "b", bookTitle: 'My "Book"', chapterIndex: 1, sentence: "first, line", savedAt: NOW },
        { bookHash: "b", bookTitle: "My Book", chapterIndex: 2, sentence: "second\nline", savedAt: NOW },
      ],
    });
    const csv = wordsToCsv([w]);
    expect(csv).toContain('""My ""Book""""');
    expect(csv).toContain("first, line");
    expect(csv).toContain("second\nline");
  });

  it("emits header alone when no words", () => {
    const csv = wordsToCsv([]);
    expect(csv).toBe("Word,Phonetic,Definition,Example,Contexts,FirstSeen,Stage\n");
  });
});
