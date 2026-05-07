import React, { useCallback, useMemo, useRef, useState } from "react";
import { BookMetadata } from "../../lib/storage";
import Tooltip from "../Tooltip";
import {
  buildLibraryEntries,
  filterBySearch,
  groupForDisplay,
  LibraryEntry,
  LibrarySort,
  timeAgo,
} from "./library-helpers";

interface LibraryPanelProps {
  books: ReadonlyArray<BookMetadata>;
  currentHash: string | null;
  progressByHash: Record<string, number>;
  onSelect: (hash: string) => void;
  onUpload: (file: File) => void;
  onDelete: (hash: string) => void;
}

const FORMAT_BADGE: Record<BookMetadata["format"], { bg: string; text: string }> = {
  epub: { bg: "bg-matcha-300", text: "text-matcha-800" },
  pdf: { bg: "bg-pomegranate-400", text: "text-white" },
  txt: { bg: "bg-slushie-500", text: "text-white" },
};

export default function LibraryPanel({
  books,
  currentHash,
  progressByHash,
  onSelect,
  onUpload,
  onDelete,
}: LibraryPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<LibrarySort>("recent");
  const [draggingFile, setDraggingFile] = useState(false);
  const [confirmDeleteHash, setConfirmDeleteHash] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const all = buildLibraryEntries(books, progressByHash);
    const filtered = filterBySearch(all, searchQuery);
    return groupForDisplay(filtered, sortKey);
  }, [books, progressByHash, searchQuery, sortKey]);

  const handleDropFile = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDraggingFile(false);
      const file = event.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) onUpload(file);
      event.target.value = "";
    },
    [onUpload],
  );

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(event) => {
        event.preventDefault();
        setDraggingFile(true);
      }}
      onDragLeave={() => setDraggingFile(false)}
      onDrop={handleDropFile}
    >
      <div className="px-4 py-3 border-b border-oat space-y-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search title or author"
          className="w-full px-3 py-1.5 text-xs rounded-[8px] border border-oat bg-clay-white text-clay-black placeholder:text-silver focus:outline-2 focus:outline-matcha-600"
          aria-label="Search library"
        />
        <div className="flex items-center justify-between text-[11px] text-silver">
          <span>{books.length} book{books.length === 1 ? "" : "s"}</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as LibrarySort)}
            className="px-2 py-1 rounded-[6px] border border-oat bg-clay-white text-clay-black"
            aria-label="Sort library"
          >
            <option value="recent">Recent</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <LibraryGroup
          label="Recent"
          entries={grouped.recent}
          currentHash={currentHash}
          confirmDeleteHash={confirmDeleteHash}
          onSelect={onSelect}
          onDelete={onDelete}
          onConfirmDelete={setConfirmDeleteHash}
        />
        <LibraryGroup
          label={`Reading (${grouped.reading.length})`}
          entries={grouped.reading}
          currentHash={currentHash}
          confirmDeleteHash={confirmDeleteHash}
          onSelect={onSelect}
          onDelete={onDelete}
          onConfirmDelete={setConfirmDeleteHash}
        />
        <LibraryGroup
          label={`Unstarted (${grouped.unstarted.length})`}
          entries={grouped.unstarted}
          currentHash={currentHash}
          confirmDeleteHash={confirmDeleteHash}
          onSelect={onSelect}
          onDelete={onDelete}
          onConfirmDelete={setConfirmDeleteHash}
        />
        <LibraryGroup
          label={`Finished (${grouped.finished.length})`}
          entries={grouped.finished}
          currentHash={currentHash}
          confirmDeleteHash={confirmDeleteHash}
          onSelect={onSelect}
          onDelete={onDelete}
          onConfirmDelete={setConfirmDeleteHash}
        />
        {books.length === 0 && (
          <p className="text-xs text-silver text-center py-12">
            Your library is empty. Drop a book below to start reading.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`m-3 p-3 border border-dashed rounded-[16px] text-center transition-all ${
          draggingFile
            ? "border-matcha-600 bg-matcha-300/10"
            : "border-oat hover:border-charcoal"
        }`}
      >
        <p className="text-xs font-medium">Drop or click to add a book</p>
        <p className="text-[10px] text-silver mt-0.5">EPUB, PDF, or TXT</p>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.pdf,.txt,.text"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}

interface LibraryGroupProps {
  label: string;
  entries: ReadonlyArray<LibraryEntry>;
  currentHash: string | null;
  confirmDeleteHash: string | null;
  onSelect: (hash: string) => void;
  onDelete: (hash: string) => void;
  onConfirmDelete: (hash: string | null) => void;
}

function LibraryGroup({
  label,
  entries,
  currentHash,
  confirmDeleteHash,
  onSelect,
  onDelete,
  onConfirmDelete,
}: LibraryGroupProps) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h4 className="clay-label mb-1 px-1">{label}</h4>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <LibraryRow
            key={entry.meta.hash}
            entry={entry}
            isActive={entry.meta.hash === currentHash}
            isConfirmingDelete={confirmDeleteHash === entry.meta.hash}
            onSelect={onSelect}
            onDelete={onDelete}
            onConfirmDelete={onConfirmDelete}
          />
        ))}
      </ul>
    </section>
  );
}

interface LibraryRowProps {
  entry: LibraryEntry;
  isActive: boolean;
  isConfirmingDelete: boolean;
  onSelect: (hash: string) => void;
  onDelete: (hash: string) => void;
  onConfirmDelete: (hash: string | null) => void;
}

function LibraryRow({
  entry,
  isActive,
  isConfirmingDelete,
  onSelect,
  onDelete,
  onConfirmDelete,
}: LibraryRowProps) {
  const { meta, progressPercent, status } = entry;
  const badge = FORMAT_BADGE[meta.format] ?? { bg: "bg-frost", text: "text-charcoal" };
  const progressLabel =
    status === "finished"
      ? "Done"
      : progressPercent > 0
        ? `${Math.round(progressPercent)}%`
        : "—";
  return (
    <li>
      <div
        className={`flex items-center gap-2 p-2 rounded-[10px] cursor-pointer group transition-all ${
          isActive ? "ring-1 ring-matcha-600 bg-matcha-300/10" : "hover:bg-frost/60"
        }`}
        onClick={() => onSelect(meta.hash)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{meta.title}</p>
          <p className="text-[11px] text-silver truncate">
            {meta.author} &middot; {timeAgo(meta.lastOpenedAt)}
          </p>
          <div className="mt-1 h-0.5 bg-oat/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-matcha-600"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`clay-badge ${badge.bg} ${badge.text} uppercase text-[9px]`}>
            {meta.format}
          </span>
          <span className="text-[10px] tabular-nums text-silver">{progressLabel}</span>
        </div>
        {isConfirmingDelete ? (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                onDelete(meta.hash);
                onConfirmDelete(null);
              }}
              className="clay-btn-ghost danger !text-[10px] !py-1 !px-2 bg-pomegranate-400 !text-white !rounded-[8px]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => onConfirmDelete(null)}
              className="clay-btn-ghost !text-[10px] !py-1 !px-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <Tooltip label="Delete book" position="left">
            <button
              type="button"
              aria-label={`Delete ${meta.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onConfirmDelete(meta.hash);
              }}
              className="clay-btn-icon !p-1.5 opacity-0 group-hover:opacity-100"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 3h7M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M8 5v4.5a1 1 0 01-1 1H5a1 1 0 01-1-1V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}
