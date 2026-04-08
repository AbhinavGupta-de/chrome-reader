export interface ParsedTxt {
  title: string;
  author: string;
  content: string;
  chunks: string[];
}

const CHUNK_SIZE = 3000;

export async function parseTxt(arrayBuffer: ArrayBuffer): Promise<ParsedTxt> {
  const decoder = new TextDecoder("utf-8");
  const text = decoder.decode(arrayBuffer);

  const lines = text.split("\n");
  const title = lines[0]?.trim().slice(0, 100) || "Untitled";

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    let end = Math.min(i + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const nextNewline = text.indexOf("\n", end);
      if (nextNewline !== -1 && nextNewline - end < 500) {
        end = nextNewline + 1;
      }
    }
    chunks.push(text.slice(i, end));
  }

  return {
    title,
    author: "Unknown Author",
    content: text,
    chunks,
  };
}
