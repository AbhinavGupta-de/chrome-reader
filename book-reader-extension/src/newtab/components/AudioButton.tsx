import React from "react";

interface Props {
  text: string;
  url?: string;
  size?: number;
  className?: string;
}

export default function AudioButton({ text, url, size = 14, className = "" }: Props) {
  const play = async () => {
    if (url) {
      try {
        const a = new Audio(url);
        await a.play();
        return;
      } catch {
        // fall through to TTS
      }
    }
    if (typeof speechSynthesis !== "undefined" && text) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
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
