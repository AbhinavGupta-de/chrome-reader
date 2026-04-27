export interface DictDefinition {
  definition: string;
  example?: string;
}

export interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
}

export interface DictEntry {
  word: string;
  phonetic?: string;
  meanings: DictMeaning[];
}

interface RawEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
}

export function parseEntries(raw: RawEntry[]): DictEntry | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  const phonetic = first.phonetic ?? first.phonetics?.find((p) => p.text)?.text;
  return {
    word: first.word,
    phonetic,
    meanings: first.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.map((d) => ({
        definition: d.definition,
        example: d.example,
      })),
    })),
  };
}

function firstWord(text: string): string {
  const cleaned = text.replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim();
  return cleaned.split(/\s+/)[0]?.toLowerCase() ?? "";
}

export async function defineWord(text: string): Promise<DictEntry | null> {
  const word = firstWord(text);
  if (!word) return null;
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as RawEntry[];
  return parseEntries(json);
}
