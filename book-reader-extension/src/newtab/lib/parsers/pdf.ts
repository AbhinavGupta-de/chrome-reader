export interface ParsedPdf {
  title: string;
  author: string;
  totalPages: number;
  blobUrl: string;
}

export async function parsePdf(arrayBuffer: ArrayBuffer): Promise<ParsedPdf> {
  const copy = arrayBuffer.slice(0);
  const blob = new Blob([copy], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  const title = "PDF Document";
  const author = "Unknown Author";

  // Rough page count estimate: PDFs average ~3KB per page for text-heavy,
  // ~100KB per page for image-heavy. We use a middle estimate.
  const estimatedPages = Math.max(1, Math.round(copy.byteLength / 30000));

  return { title, author, totalPages: estimatedPages, blobUrl };
}

export function revokePdfUrl(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Already revoked
  }
}
