import { useCallback, useEffect, useRef, useState } from "react";
import { Highlight, HighlightAnchor, HighlightColor } from "../lib/highlights/types";
import {
  listHighlights,
  putHighlight,
  deleteHighlight,
  getHighlight,
} from "../lib/highlights/storage";
import { pullHighlightsForBook, pushPendingHighlights } from "../lib/highlights/sync";

export function useHighlights(bookHash: string | null) {
  const [items, setItems] = useState<Highlight[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!bookHash) return setItems([]);
    setItems(await listHighlights(bookHash));
  }, [bookHash]);

  useEffect(() => {
    if (!bookHash) return;
    pullHighlightsForBook(bookHash).then(setItems);
  }, [bookHash]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => pushPendingHighlights(), 800);
  }, []);

  const create = useCallback(
    async (text: string, color: HighlightColor, anchor: HighlightAnchor): Promise<Highlight> => {
      if (!bookHash) throw new Error("no book");
      const now = Date.now();
      const h: Highlight = {
        id: crypto.randomUUID(),
        bookHash,
        anchor,
        text,
        color,
        createdAt: now,
        updatedAt: now,
      };
      await putHighlight(h);
      await refresh();
      scheduleSync();
      return h;
    },
    [bookHash, refresh, scheduleSync]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Highlight, "color" | "note">>) => {
      const found = await getHighlight(id);
      if (!found) return;
      const updated: Highlight = { ...found, ...patch, updatedAt: Date.now(), syncedAt: undefined };
      await putHighlight(updated);
      await refresh();
      scheduleSync();
    },
    [refresh, scheduleSync]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteHighlight(id);
      await refresh();
      scheduleSync();
    },
    [refresh, scheduleSync]
  );

  return { items, create, update, remove, refresh };
}
