import { VocabWord } from "./types";

export function escapeCsvField(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function formatContexts(w: VocabWord): string {
  return w.contexts
    .map((c) => `From "${c.bookTitle}" (ch. ${c.chapterIndex + 1}): …${c.sentence}…`)
    .join("\n");
}

const HEADER = ["Word", "Phonetic", "Definition", "Example", "Contexts", "FirstSeen", "Stage"];

export function wordsToCsv(words: VocabWord[]): string {
  const lines = [HEADER.join(",")];
  for (const w of words) {
    const def = w.definitions[0]?.definition ?? "";
    const ex = w.definitions[0]?.example ?? "";
    const stageCell = w.mastered ? "Mastered" : String(w.stage);
    const row = [
      escapeCsvField(w.word),
      escapeCsvField(w.phonetic ?? ""),
      escapeCsvField(def),
      escapeCsvField(ex),
      escapeCsvField(formatContexts(w)),
      isoDate(w.createdAt),
      stageCell,
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n") + (words.length === 0 ? "\n" : "");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
