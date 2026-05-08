import { useState, useCallback, useEffect, useRef } from "react";
import {
  savePosition,
  getPosition,
  ReadingPosition,
} from "../lib/storage";
import { syncPosition, getRemotePosition, isAuthenticated, isOnline } from "../lib/api";

interface UsePositionOptions {
  bookHash: string | null;
  bookTitle: string;
  enabled: boolean;
}

function shouldPublishPosition(prev: ReadingPosition | null, next: ReadingPosition): boolean {
  if (!prev) return true;
  if (prev.bookHash !== next.bookHash) return true;
  if (prev.chapterIndex !== next.chapterIndex) return true;
  return Math.round(prev.percentage) !== Math.round(next.percentage);
}

export function usePosition({ bookHash, bookTitle, enabled }: UsePositionOptions) {
  const [position, setPositionState] = useState<ReadingPosition | null>(null);
  const positionRef = useRef<ReadingPosition | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!bookHash || !enabled) return;

    (async () => {
      const local = await getPosition(bookHash);
      if (local) {
        setPositionState(local);
        positionRef.current = local;
      } else {
        const defaultPos: ReadingPosition = {
          bookHash,
          chapterIndex: 0,
          scrollOffset: 0,
          percentage: 0,
          updatedAt: Date.now(),
        };
        setPositionState(defaultPos);
        positionRef.current = defaultPos;
      }

      if (isAuthenticated() && isOnline()) {
        try {
          const remote = await getRemotePosition(bookHash);
          if (remote) {
            const remoteTime = new Date(remote.updatedAt).getTime();
            const localTime = local?.updatedAt ?? 0;
            if (remoteTime > localTime) {
              const merged: ReadingPosition = {
                bookHash,
                chapterIndex: remote.chapterIndex,
                scrollOffset: remote.scrollOffset,
                percentage: remote.percentage,
                updatedAt: remoteTime,
              };
              setPositionState(merged);
              positionRef.current = merged;
              await savePosition(merged);
            }
          }
        } catch {
          // Offline or unauthenticated — local position is fine
        }
      }
    })();
  }, [bookHash, enabled]);

  const updatePosition = useCallback(
    (chapterIndex: number, scrollOffset: number, percentage: number) => {
      if (!bookHash) return;

      const pos: ReadingPosition = {
        bookHash,
        chapterIndex,
        scrollOffset,
        percentage,
        updatedAt: Date.now(),
      };

      setPositionState((prev) => (shouldPublishPosition(prev, pos) ? pos : prev));
      positionRef.current = pos;

      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await savePosition(pos);
        dirtyRef.current = true;
      }, 300);
    },
    [bookHash]
  );

  // Flush latest position to storage on unload / tab hide
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimerRef.current);
      if (positionRef.current) {
        savePosition(positionRef.current);
        dirtyRef.current = true;
      }
    };
    const onVisChange = () => { if (document.hidden) flush(); };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisChange);
      clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Periodic sync — only runs when authenticated and online
  useEffect(() => {
    if (!bookHash || !enabled) return;

    syncIntervalRef.current = setInterval(async () => {
      if (!dirtyRef.current) return;
      if (!isAuthenticated() || !isOnline()) return;

      const pos = await getPosition(bookHash);
      if (!pos) return;

      try {
        await syncPosition(
          bookHash,
          bookTitle,
          pos.chapterIndex,
          pos.scrollOffset,
          pos.percentage
        );
        dirtyRef.current = false;
      } catch {
        // Will retry next interval
      }
    }, 30_000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [bookHash, bookTitle, enabled]);

  return { position, updatePosition };
}
