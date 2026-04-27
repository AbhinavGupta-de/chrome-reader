import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineWord, parseEntries } from "../../src/newtab/lib/dictionary";

const FIXTURE = [
  {
    word: "book",
    phonetic: "/bʊk/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          { definition: "A written or printed work.", example: "I read a book." },
          { definition: "A long written work." },
        ],
      },
      {
        partOfSpeech: "verb",
        definitions: [{ definition: "Reserve in advance." }],
      },
    ],
  },
];

describe("parseEntries", () => {
  it("returns word, phonetic, and grouped meanings", () => {
    const out = parseEntries(FIXTURE as any);
    expect(out).not.toBeNull();
    expect(out!.word).toBe("book");
    expect(out!.phonetic).toBe("/bʊk/");
    expect(out!.meanings).toHaveLength(2);
    expect(out!.meanings[0].partOfSpeech).toBe("noun");
    expect(out!.meanings[0].definitions[0].definition).toBe("A written or printed work.");
    expect(out!.meanings[0].definitions[0].example).toBe("I read a book.");
  });

  it("returns null for empty array", () => {
    expect(parseEntries([])).toBeNull();
  });
});

describe("defineWord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the API with the first lowercased word and returns parsed entries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(FIXTURE), { status: 200 })
    );
    const result = await defineWord("Book Reader");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/book"
    );
    expect(result?.word).toBe("book");
  });

  it("returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    expect(await defineWord("xyzqq")).toBeNull();
  });

  it("strips punctuation from the lookup token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(FIXTURE), { status: 200 })
    );
    await defineWord('"Hello," she said.');
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/hello"
    );
  });
});
