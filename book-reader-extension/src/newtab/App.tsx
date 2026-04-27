import React, { useState, useCallback, useEffect } from "react";
import Reader from "./components/Reader";
import Library from "./components/Library";
import AIPanel from "./components/AIPanel";
import ProgressBar from "./components/ProgressBar";
import Settings from "./components/Settings";
import DictionaryPopup from "./components/popups/DictionaryPopup";
import type { ToolbarAction, HighlightColor } from "./components/SelectionToolbar";
import { useBook } from "./hooks/useBook";
import { usePosition } from "./hooks/usePosition";
import { useAuth } from "./hooks/useAuth";
import { useAI } from "./hooks/useAI";
import { getSettings, saveSettings, ReaderSettings, DEFAULT_SETTINGS } from "./lib/storage";
import { defineWord, DictEntry } from "./lib/dictionary";

export default function App() {
  const { currentBook, library, loading, error, uploadBook, removeBook, switchBook } = useBook();
  const { user, signIn, signOut } = useAuth();
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [toolbarHover, setToolbarHover] = useState(false);
  const [dict, setDict] = useState<{
    loading: boolean;
    entry: DictEntry | null;
    notFoundWord: string | null;
    rect: DOMRect;
  } | null>(null);

  const { position, updatePosition } = usePosition({
    bookHash: currentBook?.hash ?? null,
    bookTitle: currentBook?.metadata.title ?? "",
    enabled: !!currentBook,
  });

  const ai = useAI(currentBook?.hash ?? null);

  useEffect(() => { getSettings().then(setSettings); }, []);

  // Apply dark class to root
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const handleSettingsChange = useCallback(async (s: ReaderSettings) => {
    setSettings(s);
    await saveSettings(s);
  }, []);

  const handlePositionChange = useCallback(
    (chapterIndex: number, scrollOffset: number, percentage: number) => { updatePosition(chapterIndex, scrollOffset, percentage); },
    [updatePosition]
  );

  const handleSelectionAction = useCallback(
    (action: ToolbarAction, p: { text: string; range: Range; rect: DOMRect; color?: HighlightColor; chapterIndex: number; chapterText: string }) => {
      setSelectedText(p.text); // keep AIPanel "Explain" working
      if (action === "search") {
        const url = `https://www.google.com/search?q=${encodeURIComponent(p.text)}`;
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      if (action === "explain") {
        setShowAI(true);
        return;
      }
      if (action === "define") {
        setDict({ loading: true, entry: null, notFoundWord: null, rect: p.rect });
        defineWord(p.text).then((entry) => {
          setDict({
            loading: false,
            entry,
            notFoundWord: entry ? null : p.text.split(/\s+/)[0] ?? p.text,
            rect: p.rect,
          });
        });
        return;
      }
      // dictionary / translate / highlight handled in later tasks
    },
    []
  );

  const getCurrentChapterText = useCallback((): string => {
    if (!currentBook || !position) return "";
    const idx = position.chapterIndex;
    if (currentBook.format === "epub" && currentBook.epub) return currentBook.epub.chapters[idx]?.content ?? "";
    if (currentBook.format === "pdf") return "";
    if (currentBook.format === "txt" && currentBook.txt) return currentBook.txt.chunks[idx] ?? "";
    return "";
  }, [currentBook, position]);

  const toolbarVisible = settings.pinToolbar || toolbarHover;

  // ── Empty state ──
  if (!currentBook && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-cream text-clay-black fade-in">
        <div className="text-center max-w-sm px-6">
          <div className="w-20 h-20 mx-auto mb-8 rounded-[24px] bg-clay-black flex items-center justify-center clay-shadow">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
            </svg>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight mb-2" style={{ letterSpacing: "-1.6px" }}>
            Instant Reader
          </h1>
          <p className="text-charcoal mb-10">Your reading space, always one tab away.</p>

          <button onClick={() => setShowLibrary(true)} className="clay-btn-solid w-full text-lg !py-3 !rounded-[12px]">
            Open a Book
          </button>

          <div className="mt-8 flex items-center justify-center gap-4">
            {[
              { label: "EPUB", color: "bg-matcha-300" },
              { label: "PDF", color: "bg-pomegranate-400" },
              { label: "TXT", color: "bg-slushie-500" },
            ].map((f) => (
              <span key={f.label} className="flex items-center gap-1.5 text-xs text-silver">
                <span className={`w-1.5 h-1.5 rounded-full ${f.color}`} /> {f.label}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs text-silver">
            Everything stays on your device &middot; Works offline
          </p>

          {!user && (
            <button onClick={signIn} className="mt-5 text-xs text-silver hover:text-matcha-600 transition-colors underline underline-offset-2">
              Sign in for cloud sync &amp; AI
            </button>
          )}

          {error && (
            <p className="mt-4 text-sm text-pomegranate-400 bg-pomegranate-400/10 px-4 py-2 rounded-[12px]">{error}</p>
          )}
        </div>

        {showLibrary && (
          <Library books={library} currentHash={null} onSelect={switchBook} onUpload={uploadBook} onDelete={removeBook} onClose={() => setShowLibrary(false)} />
        )}
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-cream text-clay-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-clay-black border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-silver">Loading your book...</p>
        </div>
      </div>
    );
  }

  // ── Reader ──
  return (
    <div className="h-full flex flex-col bg-cream text-clay-black">
      <ProgressBar percentage={position?.percentage ?? 0} />

      {/* Clay sticky nav */}
      <div
        className="relative z-40"
        onMouseEnter={() => setToolbarHover(true)}
        onMouseLeave={() => setToolbarHover(false)}
      >
        {!settings.pinToolbar && <div className="h-3 w-full" />}

        <div
          className={`transition-all duration-200 ${
            settings.pinToolbar
              ? "relative"
              : `absolute top-0 left-0 right-0 ${toolbarVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`
          }`}
        >
          <nav
            className="flex items-center justify-between px-6 py-3 border-b border-oat"
            style={{ background: settings.theme === "dark" ? "rgba(26,24,21,0.92)" : "rgba(250,249,247,0.9)", backdropFilter: "blur(12px)" }}
          >
            {/* Left — book info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-7 h-8 rounded-[8px] bg-clay-black flex items-center justify-center flex-shrink-0 clay-shadow">
                <span className="text-[10px] font-semibold" style={{ color: "var(--white)" }}>
                  {currentBook?.format.toUpperCase().charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate max-w-[200px]" style={{ letterSpacing: "-0.16px" }}>
                  {currentBook?.metadata.title}
                </p>
                <p className="text-[11px] text-silver truncate">{currentBook?.metadata.author}</p>
              </div>
            </div>

            {/* Right — actions */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowLibrary(true)} className="clay-btn-white text-xs !py-1.5 !px-3 !rounded-[12px]">
                Library
              </button>
              <button
                onClick={() => setShowAI(!showAI)}
                className={`text-xs !py-1.5 !px-3 !rounded-[12px] ${showAI ? "clay-btn-solid" : "clay-btn-white"}`}
              >
                AI {!ai.available && <span className="text-silver">*</span>}
              </button>
              <button onClick={() => setShowSettings(true)} className="clay-btn-white text-xs !py-1.5 !px-3 !rounded-[12px]">
                Settings
              </button>

              <div className="w-px h-5 bg-oat mx-1" />

              {user ? (
                <button onClick={signOut} className="clay-btn-white text-xs !py-1 !px-2 !rounded-[1584px] flex items-center gap-1.5" title={`${user.email}`}>
                  <span className="w-5 h-5 rounded-full bg-ube-800 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{user.name.charAt(0)}</span>
                  </span>
                  {user.name.split(" ")[0]}
                </button>
              ) : (
                <button onClick={signIn} className="text-xs text-silver hover:text-clay-black transition-colors" style={{ fontWeight: 500, fontSize: 15, letterSpacing: 0 }}>
                  Sign In
                </button>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {currentBook && (
          <div className="flex-1 overflow-hidden">
            <Reader
              book={currentBook}
              position={position}
              settings={settings}
              onPositionChange={handlePositionChange}
              onSelectionAction={handleSelectionAction}
              hasExplain={ai.available}
            />
          </div>
        )}

        {showAI && currentBook && (
          <AIPanel
            onSummarize={() => ai.summarize(getCurrentChapterText())}
            onAsk={(q) => ai.ask(q, getCurrentChapterText())}
            onHighlights={() => ai.highlights(getCurrentChapterText())}
            onExplain={(sel) => ai.explain(sel, getCurrentChapterText())}
            selectedText={selectedText}
            loading={ai.loading}
            error={ai.error}
            available={ai.available}
            onSignIn={signIn}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>

      {showLibrary && (
        <Library books={library} currentHash={currentBook?.hash ?? null} onSelect={switchBook} onUpload={uploadBook} onDelete={removeBook} onClose={() => setShowLibrary(false)} />
      )}
      {dict && (
        <DictionaryPopup
          loading={dict.loading}
          entry={dict.entry}
          notFoundWord={dict.notFoundWord}
          rect={dict.rect}
          onClose={() => setDict(null)}
        />
      )}
      {showSettings && (
        <Settings settings={settings} onChange={handleSettingsChange} onClose={() => setShowSettings(false)} isPdf={currentBook?.format === "pdf"} />
      )}
    </div>
  );
}
