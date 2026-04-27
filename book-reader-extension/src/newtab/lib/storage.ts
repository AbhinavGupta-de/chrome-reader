import { openDB, IDBPDatabase } from "idb";
import SHA256 from "crypto-js/sha256";
import encHex from "crypto-js/enc-hex";
import WordArray from "crypto-js/lib-typedarrays";

const DB_NAME = "book-reader";
const DB_VERSION = 1;
const BOOKS_STORE = "books";
const META_STORE = "metadata";

export interface BookMetadata {
  hash: string;
  title: string;
  author: string;
  format: "epub" | "pdf" | "txt";
  addedAt: number;
  totalChapters?: number;
  totalPages?: number;
  fileSize: number;
}

export interface ReadingPosition {
  bookHash: string;
  chapterIndex: number;
  scrollOffset: number;
  percentage: number;
  updatedAt: number;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "hash" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "hash" });
      }
    },
  });
}

export function computeFileHash(arrayBuffer: ArrayBuffer): string {
  const copy = arrayBuffer.slice(0);
  const wordArray = WordArray.create(copy as any);
  return SHA256(wordArray).toString(encHex);
}

export async function saveBook(
  hash: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await getDB();
  const copy = data.slice(0);
  await db.put(BOOKS_STORE, { hash, data: copy });
}

export async function getBook(hash: string): Promise<ArrayBuffer | null> {
  const db = await getDB();
  const record = await db.get(BOOKS_STORE, hash);
  if (!record?.data) return null;
  return (record.data as ArrayBuffer).slice(0);
}

export async function deleteBook(hash: string): Promise<void> {
  const db = await getDB();
  await db.delete(BOOKS_STORE, hash);
  await db.delete(META_STORE, hash);
  await removeBookMeta(hash);
}

export async function saveBookMeta(meta: BookMetadata): Promise<void> {
  const db = await getDB();
  await db.put(META_STORE, meta);
}

export async function getBookMeta(hash: string): Promise<BookMetadata | null> {
  const db = await getDB();
  return (await db.get(META_STORE, hash)) ?? null;
}

export async function getAllBookMetas(): Promise<BookMetadata[]> {
  const db = await getDB();
  return db.getAll(META_STORE);
}

async function removeBookMeta(hash: string): Promise<void> {
  const db = await getDB();
  await db.delete(META_STORE, hash);
}

// Reading position — stored in chrome.storage.local for fast sync-compatible access
const POSITION_KEY_PREFIX = "pos_";
const CURRENT_BOOK_KEY = "current_book";

export async function savePosition(position: ReadingPosition): Promise<void> {
  const key = POSITION_KEY_PREFIX + position.bookHash;
  await chrome.storage.local.set({ [key]: position });
}

export async function getPosition(
  bookHash: string
): Promise<ReadingPosition | null> {
  const key = POSITION_KEY_PREFIX + bookHash;
  const result = await chrome.storage.local.get(key);
  return (result[key] as ReadingPosition | undefined) ?? null;
}

export async function setCurrentBook(hash: string | null): Promise<void> {
  await chrome.storage.local.set({ [CURRENT_BOOK_KEY]: hash });
}

export async function getCurrentBook(): Promise<string | null> {
  const result = await chrome.storage.local.get(CURRENT_BOOK_KEY);
  return (result[CURRENT_BOOK_KEY] as string | undefined) ?? null;
}

// Settings
export type PdfViewMode = "single" | "continuous" | "spread";
export type PdfColorMode = "normal" | "dark" | "sepia";

export interface ReaderSettings {
  theme: "light" | "dark";
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  translateTo: string;
  pinToolbar: boolean;
  pdfViewMode: PdfViewMode;
  pdfColorMode: PdfColorMode;
  pdfShowThumbnails: boolean;
  pdfShowViewMode: boolean;
  pdfShowPageNav: boolean;
  pdfShowColorMode: boolean;
  pdfShowZoom: boolean;
}

const SETTINGS_KEY = "reader_settings";

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "light",
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: "'DM Sans', Arial, sans-serif",
  translateTo: "en",
  pinToolbar: false,
  pdfViewMode: "continuous",
  pdfColorMode: "normal",
  pdfShowThumbnails: false,
  pdfShowViewMode: true,
  pdfShowPageNav: true,
  pdfShowColorMode: true,
  pdfShowZoom: true,
};

export async function saveSettings(settings: ReaderSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getSettings(): Promise<ReaderSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<ReaderSettings> | undefined;
  if (!stored) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...stored };
}
