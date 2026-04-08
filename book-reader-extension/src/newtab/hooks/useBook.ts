import { useState, useCallback, useEffect } from "react";
import { parseEpub, ParsedEpub } from "../lib/parsers/epub";
import { parsePdf, ParsedPdf } from "../lib/parsers/pdf";
import { parseTxt, ParsedTxt } from "../lib/parsers/txt";
import {
  saveBook,
  getBook,
  saveBookMeta,
  getBookMeta,
  getAllBookMetas,
  deleteBook as deleteBookFromStorage,
  computeFileHash,
  getCurrentBook,
  setCurrentBook,
  BookMetadata,
} from "../lib/storage";

export type BookFormat = "epub" | "pdf" | "txt";

export interface LoadedBook {
  hash: string;
  format: BookFormat;
  metadata: BookMetadata;
  epub?: ParsedEpub;
  pdf?: ParsedPdf;
  txt?: ParsedTxt;
}

function detectFormat(file: File): BookFormat | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "epub") return "epub";
  if (ext === "pdf") return "pdf";
  if (ext === "txt" || ext === "text") return "txt";

  if (file.type === "application/epub+zip") return "epub";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("text/")) return "txt";

  return null;
}

export function useBook() {
  const [currentBook, setCurrentBookState] = useState<LoadedBook | null>(null);
  const [library, setLibrary] = useState<BookMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    const metas = await getAllBookMetas();
    setLibrary(metas.sort((a, b) => b.addedAt - a.addedAt));
  }, []);

  const loadBookFromHash = useCallback(async (hash: string) => {
    setLoading(true);
    setError(null);

    try {
      const meta = await getBookMeta(hash);
      if (!meta) throw new Error("Book metadata not found");

      const data = await getBook(hash);
      if (!data) throw new Error("Book data not found");

      const loaded: LoadedBook = { hash, format: meta.format, metadata: meta };

      switch (meta.format) {
        case "epub": {
          loaded.epub = await parseEpub(data);
          break;
        }
        case "pdf": {
          loaded.pdf = await parsePdf(data);
          break;
        }
        case "txt": {
          loaded.txt = await parseTxt(data);
          break;
        }
      }

      setCurrentBookState(loaded);
      await setCurrentBook(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load book");
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadBook = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);

      try {
        const format = detectFormat(file);
        if (!format) throw new Error("Unsupported file format. Use EPUB, PDF, or TXT.");

        const arrayBuffer = await file.arrayBuffer();
        const hash = computeFileHash(arrayBuffer);

        const existing = await getBookMeta(hash);
        if (existing) {
          await loadBookFromHash(hash);
          return;
        }

        const meta: BookMetadata = {
          hash,
          title: file.name.replace(/\.[^.]+$/, ""),
          author: "Unknown Author",
          format,
          addedAt: Date.now(),
          fileSize: file.size,
        };

        switch (format) {
          case "epub": {
            const parsed = await parseEpub(arrayBuffer);
            meta.title = parsed.title;
            meta.author = parsed.author;
            meta.totalChapters = parsed.chapters.length;
            break;
          }
          case "pdf": {
            const pdfInfo = await parsePdf(arrayBuffer);
            if (pdfInfo.title && pdfInfo.title !== "PDF Document") meta.title = pdfInfo.title;
            meta.author = pdfInfo.author;
            meta.totalPages = pdfInfo.totalPages;
            break;
          }
          case "txt": {
            const parsed = await parseTxt(arrayBuffer);
            meta.title = parsed.title;
            break;
          }
        }

        await saveBook(hash, arrayBuffer);
        await saveBookMeta(meta);
        await loadLibrary();
        await loadBookFromHash(hash);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to upload book");
        setLoading(false);
      }
    },
    [loadBookFromHash, loadLibrary]
  );

  const removeBook = useCallback(
    async (hash: string) => {
      await deleteBookFromStorage(hash);
      if (currentBook?.hash === hash) {
        setCurrentBookState(null);
        await setCurrentBook(null);
      }
      await loadLibrary();
    },
    [currentBook, loadLibrary]
  );

  const switchBook = useCallback(
    async (hash: string) => {
      await loadBookFromHash(hash);
    },
    [loadBookFromHash]
  );

  useEffect(() => {
    (async () => {
      await loadLibrary();
      const lastHash = await getCurrentBook();
      if (lastHash) {
        await loadBookFromHash(lastHash);
      } else {
        setLoading(false);
      }
    })();
  }, [loadLibrary, loadBookFromHash]);

  return {
    currentBook,
    library,
    loading,
    error,
    uploadBook,
    removeBook,
    switchBook,
    loadLibrary,
  };
}
