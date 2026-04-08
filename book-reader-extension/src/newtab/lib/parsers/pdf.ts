export interface ParsedPdf {
  title: string;
  author: string;
  totalPages: number;
}

export async function parsePdf(arrayBuffer: ArrayBuffer): Promise<ParsedPdf> {
  if (typeof pdfjsLib !== "undefined") {
    try {
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer.slice(0),
        isEvalSupported: false,
      }).promise;
      const meta = await pdf.getMetadata().catch(() => null);
      const info = meta?.info ?? {};
      pdf.destroy();
      return {
        title: info.Title || "PDF Document",
        author: info.Author || "Unknown Author",
        totalPages: pdf.numPages,
      };
    } catch {
      // Fall through to binary parsing
    }
  }

  const raw = new TextDecoder("latin1").decode(arrayBuffer.slice(0));
  return {
    title: extractField(raw, "Title") || "PDF Document",
    author: extractField(raw, "Author") || "Unknown Author",
    totalPages: extractPageCount(raw),
  };
}

function extractPageCount(raw: string): number {
  const countRegex = /\/Count\s+(\d+)/g;
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = countRegex.exec(raw)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  if (max > 0) return max;

  let count = 0;
  const pageRegex = /\/Type\s*\/Page\b(?!s)/g;
  while (pageRegex.exec(raw) !== null) count++;
  return Math.max(1, count);
}

function extractField(raw: string, field: string): string {
  const re = new RegExp(`\\/${field}\\s*\\(([^)]{0,200})\\)`, "i");
  const m = raw.match(re);
  if (m) return m[1].trim();
  return "";
}

export function revokePdfUrl(url: string) {
  try { URL.revokeObjectURL(url); } catch { /* noop */ }
}
