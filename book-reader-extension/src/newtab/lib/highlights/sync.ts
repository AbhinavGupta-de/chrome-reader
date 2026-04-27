import {
  listAllUnsynced,
  markSynced,
  putHighlight,
  listHighlights,
  getHighlight,
} from "./storage";
import { Highlight } from "./types";
import {
  listRemoteHighlights,
  putRemoteHighlight,
  deleteRemoteHighlight,
  isAuthenticated,
  isOnline,
} from "../api";

export async function pushPendingHighlights(): Promise<void> {
  if (!isAuthenticated() || !isOnline()) return;
  const pending = await listAllUnsynced();
  for (const h of pending) {
    try {
      if (h.deleted) {
        await deleteRemoteHighlight(h.bookHash, h.id);
      } else {
        await putRemoteHighlight(h.bookHash, h.id, {
          chapterIndex: h.anchor.chapterIndex,
          startOffset: h.anchor.startOffset,
          length: h.anchor.length,
          contextBefore: h.anchor.contextBefore,
          contextAfter: h.anchor.contextAfter,
          text: h.text,
          color: h.color,
          note: h.note ?? null,
        });
      }
      await markSynced(h.id, Date.now());
    } catch (e) {
      console.warn("highlight sync failed", h.id, e);
      // leave unsynced; will retry next cycle
    }
  }
}

export async function pullHighlightsForBook(bookHash: string): Promise<Highlight[]> {
  if (!isAuthenticated() || !isOnline()) return listHighlights(bookHash);
  try {
    const remote = await listRemoteHighlights(bookHash);
    for (const r of remote) {
      const remoteUpdated = new Date(r.updatedAt).getTime();
      const local: Highlight = {
        id: r.clientId,
        bookHash: r.bookHash,
        anchor: {
          chapterIndex: r.chapterIndex,
          startOffset: r.startOffset,
          length: r.length,
          contextBefore: r.contextBefore,
          contextAfter: r.contextAfter,
        },
        text: r.text,
        color: r.color as Highlight["color"],
        note: r.note ?? undefined,
        createdAt: remoteUpdated,
        updatedAt: remoteUpdated,
        syncedAt: Date.now(),
      };
      const existing = await getHighlight(r.clientId);
      if (existing) {
        const isLocallyDirty = !existing.syncedAt || existing.syncedAt < existing.updatedAt;
        if (isLocallyDirty && existing.updatedAt > remoteUpdated) {
          continue; // local has unsynced newer edits, skip remote overwrite
        }
      }
      await putHighlight(local);
    }
  } catch (e) {
    console.warn("highlight pull failed", e);
    // ignore; fall through to local
  }
  return listHighlights(bookHash);
}
