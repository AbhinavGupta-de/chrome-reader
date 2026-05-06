import type { BookMetadata } from "../../lib/storage";

export type LibrarySort = "recent" | "title" | "author";
export type LibraryStatus = "reading" | "finished" | "unstarted";

export interface LibraryEntry {
  meta: BookMetadata;
  progressPercent: number;
  status: LibraryStatus;
}

const RECENT_PIN_LIMIT = 3;
const FINISHED_THRESHOLD_PERCENT = 99.5;

export function classifyStatus(progressPercent: number): LibraryStatus {
  if (progressPercent >= FINISHED_THRESHOLD_PERCENT) return "finished";
  if (progressPercent <= 0) return "unstarted";
  return "reading";
}

export function buildLibraryEntries(
  books: ReadonlyArray<BookMetadata>,
  progressByHash: Record<string, number>,
): LibraryEntry[] {
  return books.map((meta) => {
    const progressPercent = progressByHash[meta.hash] ?? 0;
    return {
      meta,
      progressPercent,
      status: classifyStatus(progressPercent),
    };
  });
}

export function filterBySearch(
  entries: ReadonlyArray<LibraryEntry>,
  searchQuery: string,
): LibraryEntry[] {
  const trimmed = searchQuery.trim().toLowerCase();
  if (!trimmed) return entries.slice();
  return entries.filter((entry) => {
    const haystack = `${entry.meta.title} ${entry.meta.author}`.toLowerCase();
    return haystack.includes(trimmed);
  });
}

export function sortEntries(
  entries: ReadonlyArray<LibraryEntry>,
  sortKey: LibrarySort,
): LibraryEntry[] {
  const copy = entries.slice();
  if (sortKey === "title") {
    copy.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
    return copy;
  }
  if (sortKey === "author") {
    copy.sort((a, b) => a.meta.author.localeCompare(b.meta.author));
    return copy;
  }
  copy.sort((a, b) => {
    const aTime = a.meta.lastOpenedAt ?? a.meta.addedAt;
    const bTime = b.meta.lastOpenedAt ?? b.meta.addedAt;
    return bTime - aTime;
  });
  return copy;
}

export function pickRecentEntries(
  entries: ReadonlyArray<LibraryEntry>,
): LibraryEntry[] {
  const withTimestamps = entries.filter((entry) => entry.meta.lastOpenedAt);
  withTimestamps.sort((a, b) => (b.meta.lastOpenedAt ?? 0) - (a.meta.lastOpenedAt ?? 0));
  return withTimestamps.slice(0, RECENT_PIN_LIMIT);
}

export interface GroupedLibrary {
  recent: LibraryEntry[];
  reading: LibraryEntry[];
  unstarted: LibraryEntry[];
  finished: LibraryEntry[];
}

export function groupForDisplay(
  entries: ReadonlyArray<LibraryEntry>,
  sortKey: LibrarySort,
): GroupedLibrary {
  const sorted = sortEntries(entries, sortKey);
  const recent = pickRecentEntries(sorted);
  const recentHashes = new Set(recent.map((entry) => entry.meta.hash));
  const remaining = sorted.filter((entry) => !recentHashes.has(entry.meta.hash));

  return {
    recent,
    reading: remaining.filter((entry) => entry.status === "reading"),
    unstarted: remaining.filter((entry) => entry.status === "unstarted"),
    finished: remaining.filter((entry) => entry.status === "finished"),
  };
}

export function timeAgo(timestamp: number | undefined): string {
  if (!timestamp) return "Never opened";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
