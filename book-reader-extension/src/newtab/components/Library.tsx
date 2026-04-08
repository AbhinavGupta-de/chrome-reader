import React, { useCallback, useRef, useState } from "react";
import { BookMetadata } from "../lib/storage";

interface LibraryProps {
  books: BookMetadata[];
  currentHash: string | null;
  onSelect: (hash: string) => void;
  onUpload: (file: File) => void;
  onDelete: (hash: string) => void;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const FORMAT_BADGE: Record<string, { bg: string; text: string }> = {
  epub: { bg: "bg-matcha-300", text: "text-matcha-800" },
  pdf: { bg: "bg-pomegranate-400", text: "text-white" },
  txt: { bg: "bg-slushie-500", text: "text-white" },
};

export default function Library({ books, currentHash, onSelect, onUpload, onDelete, onClose }: LibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }, [onUpload]);

  return (
    <div className="fixed inset-0 z-50 bg-clay-black/30 flex items-center justify-center p-4 fade-in">
      <div className="clay-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden !p-0 modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-oat">
          <div>
            <h2 className="text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.4px" }}>Library</h2>
            <p className="text-xs text-silver mt-0.5">{books.length} book{books.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="clay-btn-white !p-2 !rounded-[8px]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Upload — dashed card */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mx-5 mt-4 p-5 border border-dashed rounded-[24px] text-center cursor-pointer transition-all ${
            dragging ? "border-matcha-600 bg-matcha-300/10 scale-[1.01]" : "border-oat hover:border-charcoal"
          }`}
        >
          <div className="w-10 h-10 mx-auto mb-2 rounded-[12px] bg-frost flex items-center justify-center clay-shadow">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--charcoal)" strokeWidth="1.5">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium">Drop a book here or <span className="text-matcha-600 underline underline-offset-2">browse</span></p>
          <p className="text-xs text-silver mt-1">EPUB, PDF, or TXT</p>
          <input ref={fileInputRef} type="file" accept=".epub,.pdf,.txt,.text" onChange={handleFileChange} className="hidden" />
        </div>

        {/* Book list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {books.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-silver">Your library is empty</p>
              <p className="text-xs text-silver/60 mt-1">Upload a book to start reading</p>
            </div>
          )}
          {books.map((book) => {
            const badge = FORMAT_BADGE[book.format] ?? { bg: "bg-frost", text: "text-charcoal" };
            const isActive = book.hash === currentHash;
            return (
              <div
                key={book.hash}
                onClick={() => { onSelect(book.hash); onClose(); }}
                className={`flex items-center gap-3 p-3 rounded-[12px] cursor-pointer transition-all group ${
                  isActive ? "bg-frost ring-1 ring-oat" : "hover:bg-frost/60"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{book.title}</p>
                  <p className="text-xs text-silver truncate mt-0.5">
                    {book.author} &middot; {formatSize(book.fileSize)} &middot; {timeAgo(book.addedAt)}
                  </p>
                </div>
                <span className={`clay-badge ${badge.bg} ${badge.text} uppercase`}>
                  {book.format}
                </span>
                {confirmDelete === book.hash ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { onDelete(book.hash); setConfirmDelete(null); }} className="px-2 py-1 text-xs rounded-[8px] bg-pomegranate-400 text-white font-medium">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs rounded-[8px] text-silver hover:bg-frost">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(book.hash); }}
                    className="p-1.5 rounded-[8px] text-silver opacity-0 group-hover:opacity-100 hover:text-pomegranate-400 hover:bg-pomegranate-400/10 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 6v4.5a1 1 0 01-1 1h-3a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
