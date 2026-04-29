import React from "react";

interface Props {
  text: string;
  url?: string;
  size?: number;
  className?: string;
  lang?: string; // BCP-47, e.g. "en", "es", "fr"
}

function googleTtsUrl(text: string, lang: string): string {
  const trimmed = text.trim().slice(0, 200);
  const params = new URLSearchParams({
    ie: "UTF-8",
    tl: lang,
    client: "tw-ob",
    q: trimmed,
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

async function tryPlayUrl(src: string): Promise<boolean> {
  try {
    const a = new Audio(src);
    a.crossOrigin = "anonymous";
    await a.play();
    return true;
  } catch {
    return false;
  }
}

export default function AudioButton({ text, url, size = 14, className = "", lang = "en" }: Props) {
  const play = async () => {
    // 1. Wiktionary / dictionary audio when available
    if (url && (await tryPlayUrl(url))) return;
    // 2. Google Translate TTS — better than browser TTS, free, no key
    if (text && (await tryPlayUrl(googleTtsUrl(text, lang)))) return;
    // 3. Last resort — Web Speech API
    if (typeof speechSynthesis !== "undefined" && text) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "en" ? "en-US" : lang;
      // Pick the best available voice for the language (premium/enhanced if present)
      const voices = speechSynthesis.getVoices();
      const langPrefix = u.lang.split("-")[0].toLowerCase();
      const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
      const preferred =
        candidates.find((v) => /premium|enhanced|natural/i.test(v.name)) ??
        candidates.find((v) => v.localService) ??
        candidates[0];
      if (preferred) u.voice = preferred;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  };

  return (
    <button
      onClick={play}
      aria-label={`Pronounce ${text}`}
      title="Pronounce"
      className={`p-1 rounded-[6px] text-silver hover:text-clay-black hover:bg-oat/40 transition-colors ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6v4h2.5L9 13V3L5.5 6H3z" />
        <path d="M11.5 5.5a3 3 0 0 1 0 5" />
      </svg>
    </button>
  );
}
