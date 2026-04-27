import { openDB, IDBPDatabase } from "idb";
import { Highlight } from "./types";

const DB = "book-reader-highlights";
const STORE = "highlights";

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("byBook", "bookHash", { unique: false });
          s.createIndex("byUnsynced", "syncedAt", { unique: false });
        }
      },
      blocking() {
        // Another connection is trying to upgrade or delete; close ours.
        dbPromise?.then((d) => d.close()).catch(() => {});
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

export async function putHighlight(h: Highlight): Promise<void> {
  const db = await getDB();
  await db.put(STORE, h);
}

export async function getHighlight(id: string): Promise<Highlight | null> {
  const db = await getDB();
  return ((await db.get(STORE, id)) as Highlight | undefined) ?? null;
}

export async function listHighlights(bookHash: string): Promise<Highlight[]> {
  const db = await getDB();
  const all = (await db.getAllFromIndex(STORE, "byBook", bookHash)) as Highlight[];
  return all
    .filter((h) => !h.deleted)
    .sort(
      (a, b) =>
        a.anchor.chapterIndex - b.anchor.chapterIndex ||
        a.anchor.startOffset - b.anchor.startOffset
    );
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(STORE, id)) as Highlight | undefined;
  if (!existing) return;
  existing.deleted = true;
  existing.updatedAt = Date.now();
  existing.syncedAt = undefined;
  await db.put(STORE, existing);
}

export async function listAllUnsynced(): Promise<Highlight[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as Highlight[];
  return all.filter((h) => !h.syncedAt || h.syncedAt < h.updatedAt);
}

export async function markSynced(id: string, at: number): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(STORE, id)) as Highlight | undefined;
  if (!existing) return;
  existing.syncedAt = at;
  await db.put(STORE, existing);
}

export async function purgeTombstones(): Promise<void> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as Highlight[];
  for (const h of all) {
    if (h.deleted && h.syncedAt) await db.delete(STORE, h.id);
  }
}
