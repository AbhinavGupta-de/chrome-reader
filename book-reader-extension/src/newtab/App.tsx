import React, { useState, useCallback, useEffect } from "react";
import Reader from "./components/Reader";
import Library from "./components/Library";
import AIPanel from "./components/AIPanel";
import ProgressBar from "./components/ProgressBar";
import Settings from "./components/Settings";
import DictionaryPopup from "./components/popups/DictionaryPopup";
import TranslatePopup from "./components/popups/TranslatePopup";
import HighlightEditPopup from "./components/popups/HighlightEditPopup";
import ReviewModal from "./components/ReviewModal";
import HighlightsPanel from "./components/HighlightsPanel";
import WordsPanel from "./components/WordsPanel";
import type { ToolbarAction, HighlightColor } from "./components/SelectionToolbar";
import { useBook } from "./hooks/useBook";
import { usePosition } from "./hooks/usePosition";
import { useAuth } from "./hooks/useAuth";
import { useAI } from "./hooks/useAI";
import { getSettings, saveSettings, ReaderSettings, DEFAULT_SETTINGS } from "./lib/storage";
import { defineWord, DictEntry } from "./lib/dictionary";
import { aiTranslate } from "./lib/api";
import { useHighlights } from "./hooks/useHighlights";
import { buildAnchor, offsetsFromRange } from "./lib/highlights/anchor";
import { useVocab } from "./hooks/useVocab";
import { VocabContext, VocabDefinition } from "./lib/vocab/types";

export default function App() {
  const { currentBook, library, loading, error, uploadBook, removeBook, switchBook } = useBook();
  const { user, signIn, signOut } = useAuth();
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [toolbarHover, setToolbarHover] = useState(false);
  const [dict, setDict] = useState<{
    loading: boolean;
    entry: DictEntry | null;
    notFoundWord: string | null;
    rect: DOMRect;
    selectionText: string;
    contextSentence: string;
    chapterIndex: number;
  } | null>(null);
  const [savedWordId, setSavedWordId] = useState<string | null>(null);
  const [translate, setTranslate] = useState<{
    loading: boolean;
    source: string;
    translation: string | null;
    error: string | null;
    targetLang: string;
    rect: DOMRect;
  } | null>(null);

  const { position, updatePosition } = usePosition({
    bookHash: currentBook?.hash ?? null,
    bookTitle: currentBook?.metadata.title ?? "",
    enabled: !!currentBook,
  });

  const ai = useAI(currentBook?.hash ?? null);
  const highlights = useHighlights(currentBook?.hash ?? null);
  const vocab = useVocab();
  const [editing, setEditing] = useState<{ id: string; rect: DOMRect } | null>(null);

  useEffect(() => { getSettings().then(setSettings); }, []);

  // Apply dark class to root
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  useEffect(() => {
    if (!user || !currentBook?.hash) return;
    highlights.refresh();
  }, [user, currentBook?.hash]);

  useEffect(() => {
    const onOnline = () => {
      import("./lib/highlights/sync").then((m) => m.pushPendingHighlights());
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const handleSettingsChange = useCallback(async (s: ReaderSettings) => {
    setSettings(s);
    await saveSettings(s);
  }, []);

  const handlePositionChange = useCallback(
    (chapterIndex: number, scrollOffset: number, percentage: number) => { updatePosition(chapterIndex, scrollOffset, percentage); },
    [updatePosition]
  );

  const handleSelectionAction = useCallback(
    (action: ToolbarAction, p: { text: string; range: Range; rect: DOMRect; color?: HighlightColor; highlightIds?: string[]; chapterIndex: number; chapterText: string }) => {
      setSelectedText(p.text); // keep AIPanel "Explain" working
      if (action === "remove_highlight") {
        const ids = p.highlightIds ?? [];
        for (const id of ids) highlights.remove(id);
        window.getSelection()?.removeAllRanges();
        return;
      }
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
        const ctxText = p.chapterText;
        const idx = ctxText.toLowerCase().indexOf(p.text.toLowerCase());
        const sentence = idx >= 0
          ? ctxText.slice(Math.max(0, idx - 60), Math.min(ctxText.length, idx + p.text.length + 60))
          : p.text;
        setDict({
          loading: true,
          entry: null,
          notFoundWord: null,
          rect: p.rect,
          selectionText: p.text,
          contextSentence: sentence,
          chapterIndex: p.chapterIndex,
        });
        setSavedWordId(null);
        defineWord(p.text).then((entry) => {
          setDict({
            loading: false,
            entry,
            notFoundWord: entry ? null : p.text.split(/\s+/)[0] ?? p.text,
            rect: p.rect,
            selectionText: p.text,
            contextSentence: sentence,
            chapterIndex: p.chapterIndex,
          });
        });
        return;
      }
      if (action === "translate") {
        if (!currentBook) return;
        setTranslate({ loading: true, source: p.text, translation: null, error: null, targetLang: settings.translateTo, rect: p.rect });
        aiTranslate(currentBook.hash, p.text, settings.translateTo)
          .then((r) =>
            setTranslate({ loading: false, source: p.text, translation: r.translation, error: null, targetLang: settings.translateTo, rect: p.rect })
          )
          .catch((e) =>
            setTranslate({ loading: false, source: p.text, translation: null, error: e instanceof Error ? e.message : "Failed", targetLang: settings.translateTo, rect: p.rect })
          );
        return;
      }
      if (action === "highlight") {
        if (!currentBook) return;
        const color = p.color ?? "yellow";

        if (currentBook.format === "pdf") {
          const node = p.range.commonAncestorContainer;
          const startNode = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
          if (!startNode) return;
          const pageWrapper = startNode.closest("[data-page]") as HTMLElement | null;
          if (!pageWrapper) return;
          const textLayer = pageWrapper.querySelector(".textLayer") as HTMLElement | null;
          if (!textLayer) return;
          const pageIndex = Number(pageWrapper.getAttribute("data-page")) - 1;
          const pageText = textLayer.textContent ?? "";
          const offs = offsetsFromRange(textLayer, p.range);
          if (!offs) return;
          const anchor = buildAnchor(pageText, offs.startOffset, offs.length, pageIndex);
          highlights.create(p.text, color, anchor);
          window.getSelection()?.removeAllRanges();
          return;
        }

        const proseEl = (p.range.commonAncestorContainer.parentElement?.closest(".prose-reader")
          ?? document.querySelector(".prose-reader")) as HTMLElement | null;
        if (!proseEl) return;
        const offs = offsetsFromRange(proseEl, p.range);
        if (!offs) return;
        const anchor = buildAnchor(p.chapterText, offs.startOffset, offs.length, p.chapterIndex);
        highlights.create(p.text, color, anchor);
        window.getSelection()?.removeAllRanges();
        return;
      }
    },
    [currentBook, ai.available, settings.translateTo, highlights.create, highlights.remove]
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
              <button
                onClick={() => setShowHighlights(!showHighlights)}
                className={`text-xs !py-1.5 !px-3 !rounded-[12px] ${showHighlights ? "clay-btn-solid" : "clay-btn-white"}`}
              >
                Highlights
              </button>
              <button
                onClick={() => setShowWords(!showWords)}
                className={`text-xs !py-1.5 !px-3 !rounded-[12px] ${showWords ? "clay-btn-solid" : "clay-btn-white"}`}
              >
                Words {vocab.dueCount > 0 && <span className="text-pomegranate-400 ml-0.5">({vocab.dueCount})</span>}
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
              highlights={highlights.items}
              onPositionChange={handlePositionChange}
              onSelectionAction={handleSelectionAction}
              onHighlightClick={(id, rect) => setEditing({ id, rect })}
              hasExplain={ai.available}
              aiAvailable={ai.available}
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

        {showHighlights && currentBook && (
          <HighlightsPanel
            items={highlights.items}
            onJump={(h) => handlePositionChange(h.anchor.chapterIndex, 0, 0)}
            onClose={() => setShowHighlights(false)}
          />
        )}

        {showWords && (
          <WordsPanel
            items={vocab.items}
            currentBookHash={currentBook?.hash ?? null}
            dueCount={vocab.dueCount}
            onClose={() => setShowWords(false)}
            onDelete={(id) => vocab.unsave(id)}
            onResetStage={(id) => vocab.resetStage(id)}
            onReview={() => setShowReview(true)}
            onQuiz={() => setShowQuiz(true)}
          />
        )}
      </div>

      {showLibrary && (
        <Library books={library} currentHash={currentBook?.hash ?? null} onSelect={switchBook} onUpload={uploadBook} onDelete={removeBook} onClose={() => setShowLibrary(false)} />
      )}
      {dict && currentBook && (
        <DictionaryPopup
          loading={dict.loading}
          entry={dict.entry}
          notFoundWord={dict.notFoundWord}
          rect={dict.rect}
          selectionText={dict.selectionText}
          contextSentence={dict.contextSentence}
          bookHash={currentBook.hash}
          bookTitle={currentBook.metadata.title}
          chapterIndex={dict.chapterIndex}
          isSaved={savedWordId !== null}
          audioUrlFromEntry={
            (dict.entry as any)?.phonetics?.find?.((p: any) => p.audio)?.audio
          }
          onAutoSave={async (entry, sentence) => {
            const audio: string | undefined = (entry as any).phonetics?.find?.((p: any) => p.audio)?.audio;
            const existing = await vocab.findByWord(entry.word);
            const defs: VocabDefinition[] = (entry.meanings ?? []).flatMap((m) =>
              m.definitions.map((d) => ({ partOfSpeech: m.partOfSpeech, definition: d.definition, example: d.example }))
            ).slice(0, 3);
            const context: VocabContext = {
              bookHash: currentBook.hash,
              bookTitle: currentBook.metadata.title,
              chapterIndex: dict.chapterIndex,
              sentence,
              savedAt: Date.now(),
            };
            if (existing) {
              const w = await vocab.save({
                word: entry.word,
                phonetic: entry.phonetic,
                audioUrl: audio,
                definitions: defs.length > 0 ? defs : existing.definitions,
                context,
              });
              setSavedWordId(w.id);
              return;
            }
            const w = await vocab.save({
              word: entry.word,
              phonetic: entry.phonetic,
              audioUrl: audio,
              definitions: defs,
              context,
            });
            setSavedWordId(w.id);
          }}
          onUnsave={async () => {
            if (savedWordId) await vocab.unsave(savedWordId);
            setSavedWordId(null);
          }}
          onClose={() => { setDict(null); setSavedWordId(null); }}
        />
      )}
      {translate && (
        <TranslatePopup
          loading={translate.loading}
          source={translate.source}
          translation={translate.translation}
          error={translate.error}
          targetLang={translate.targetLang}
          rect={translate.rect}
          onClose={() => setTranslate(null)}
        />
      )}
      {showSettings && (
        <Settings settings={settings} onChange={handleSettingsChange} onClose={() => setShowSettings(false)} isPdf={currentBook?.format === "pdf"} />
      )}
      {editing && (() => {
        const h = highlights.items.find((x) => x.id === editing.id);
        if (!h) return null;
        return (
          <HighlightEditPopup
            highlight={h}
            rect={editing.rect}
            onChangeColor={(c) => highlights.update(h.id, { color: c })}
            onChangeNote={(n) => highlights.update(h.id, { note: n })}
            onDelete={() => { highlights.remove(h.id); setEditing(null); }}
            onClose={() => setEditing(null)}
          />
        );
      })()}
      {showReview && (
        <ReviewModal
          items={vocab.items}
          onRate={async (id, rating) => { await vocab.applyReview(id, rating); }}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
