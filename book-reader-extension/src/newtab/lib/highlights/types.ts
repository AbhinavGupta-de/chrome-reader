export type HighlightColor = "yellow" | "green" | "pink" | "blue";

export interface HighlightAnchor {
  chapterIndex: number;
  startOffset: number;       // index in plain-text
  length: number;            // length in plain-text
  contextBefore: string;     // up to 50 chars before
  contextAfter: string;      // up to 50 chars after
}

export interface Highlight {
  id: string;                // uuid v4
  bookHash: string;
  anchor: HighlightAnchor;
  text: string;              // selected text snapshot
  color: HighlightColor;
  note?: string;
  createdAt: number;         // epoch ms
  updatedAt: number;
  syncedAt?: number;         // last successful sync
  deleted?: boolean;         // tombstone for sync
}
