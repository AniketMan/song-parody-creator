/**
 * ParodyEditor — Always side-by-side dual-panel editor.
 * Works on all screen sizes including mobile.
 * Highlight overlay scrolls in sync with the textarea via onScroll mirroring.
 * Uses a simple 50/50 flex split (no resizable on mobile for touch friendliness).
 */
import { useState, useCallback, useMemo, useRef } from "react";

interface ReplaceAllPopup {
  originalWord: string;
  newWord: string;
  x: number;
  y: number;
}

/** A single editor pane with scroll-synced highlight overlay */
function EditorPane({
  label,
  text,
  setText,
  words,
  getDiffClass,
  side,
  onWordClick,
}: {
  label: string;
  text: string;
  setText: (v: string) => void;
  words: string[][];
  getDiffClass: (side: "original" | "parody", lineIdx: number, wordIdx: number) => string;
  side: "original" | "parody";
  onWordClick?: (e: React.MouseEvent, lineIdx: number, wordIdx: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="px-3 sm:px-4 md:px-6 py-2 border-b border-border/40 shrink-0">
        <span className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {/* Highlight overlay — scrolls in sync with textarea */}
        <div
          ref={highlightRef}
          className="absolute inset-0 p-3 sm:p-4 md:p-6 font-mono text-[12px] sm:text-[13px] md:text-[14px] leading-6 sm:leading-7 whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {words.map((line, lineIdx) => (
            <div key={lineIdx} className="min-h-[1.5rem] sm:min-h-[1.75rem]">
              {line.length === 0 && <br />}
              {line.map((word, wordIdx) => {
                const cls = getDiffClass(side, lineIdx, wordIdx);
                const isModified = cls !== "";
                return (
                  <span
                    key={wordIdx}
                    onClick={
                      isModified && onWordClick
                        ? (e) => {
                            e.stopPropagation();
                            onWordClick(e, lineIdx, wordIdx);
                          }
                        : undefined
                    }
                    className={`inline-block mr-[0.4ch] sm:mr-[0.5ch] rounded-[3px] px-0.5 text-transparent ${cls} ${isModified && onWordClick ? "cursor-pointer pointer-events-auto hover:ring-1 hover:ring-primary/40" : ""}`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {/* Textarea — user types here, scroll syncs to highlight */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="absolute inset-0 w-full h-full p-3 sm:p-4 md:p-6 font-mono text-[12px] sm:text-[13px] md:text-[14px] leading-6 sm:leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words overflow-auto"
        />
      </div>
    </div>
  );
}

export function ParodyEditor() {
  const [originalText, setOriginalText] = useState("");
  const [parodyText, setParodyText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [popup, setPopup] = useState<ReplaceAllPopup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseWords = useCallback((text: string): string[][] => {
    return text.split("\n").map((line) =>
      line.split(/\s+/).filter((w) => w.length > 0)
    );
  }, []);

  const originalWords = useMemo(() => parseWords(originalText), [originalText, parseWords]);
  const parodyWords = useMemo(() => parseWords(parodyText), [parodyText, parseWords]);

  const modifiedCount = useMemo(() => {
    let count = 0;
    const maxLines = Math.max(originalWords.length, parodyWords.length);
    for (let l = 0; l < maxLines; l++) {
      const maxW = Math.max(
        originalWords[l]?.length ?? 0,
        parodyWords[l]?.length ?? 0
      );
      for (let w = 0; w < maxW; w++) {
        const orig = originalWords[l]?.[w] ?? "";
        const paro = parodyWords[l]?.[w] ?? "";
        if (orig !== paro) count++;
      }
    }
    return count;
  }, [originalWords, parodyWords]);

  const handlePaste = useCallback((text: string) => {
    setOriginalText(text);
    setParodyText(text);
    setInitialized(true);
  }, []);

  const copyParody = useCallback(() => {
    navigator.clipboard.writeText(parodyText);
  }, [parodyText]);

  const clearAll = useCallback(() => {
    setOriginalText("");
    setParodyText("");
    setInitialized(false);
    setPopup(null);
  }, []);

  const getDiffClass = useCallback(
    (side: "original" | "parody", lineIdx: number, wordIdx: number): string => {
      const orig = originalWords[lineIdx]?.[wordIdx] ?? "";
      const paro = parodyWords[lineIdx]?.[wordIdx] ?? "";
      if (orig === paro) return "";
      if (side === "original") return "bg-[#ff3b30]/10 dark:bg-[#ff453a]/15";
      return "bg-[#0066cc]/10 dark:bg-[#2997ff]/15";
    },
    [originalWords, parodyWords]
  );

  const handleParodyWordClick = useCallback(
    (e: React.MouseEvent, lineIdx: number, wordIdx: number) => {
      const orig = originalWords[lineIdx]?.[wordIdx] ?? "";
      const paro = parodyWords[lineIdx]?.[wordIdx] ?? "";
      if (orig === paro || !orig || !paro) return;

      let instanceCount = 0;
      for (const line of originalWords) {
        for (const w of line) {
          if (w.toLowerCase() === orig.toLowerCase()) instanceCount++;
        }
      }
      if (instanceCount <= 1) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const x = e.clientX - (rect?.left ?? 0);
      const y = e.clientY - (rect?.top ?? 0);
      setPopup({ originalWord: orig, newWord: paro, x, y });
    },
    [originalWords, parodyWords]
  );

  const handleReplaceAll = useCallback(() => {
    if (!popup) return;
    const { originalWord, newWord } = popup;

    const newParodyLines = parodyText.split("\n").map((line, lineIdx) => {
      const words = line.split(/(\s+)/);
      const origLine = originalWords[lineIdx] ?? [];
      let origWordIdx = 0;

      return words
        .map((token) => {
          if (token.match(/^\s*$/) || token.length === 0) return token;
          const correspondingOrig = origLine[origWordIdx] ?? "";
          origWordIdx++;
          if (
            correspondingOrig.toLowerCase() === originalWord.toLowerCase() &&
            token.toLowerCase() === originalWord.toLowerCase()
          ) {
            if (correspondingOrig === correspondingOrig.toUpperCase()) return newWord.toUpperCase();
            if (correspondingOrig[0] === correspondingOrig[0].toUpperCase())
              return newWord[0].toUpperCase() + newWord.slice(1);
            return newWord;
          }
          return token;
        })
        .join("");
    });

    setParodyText(newParodyLines.join("\n"));
    setPopup(null);
  }, [popup, parodyText, originalWords]);

  const dismissPopup = useCallback(() => setPopup(null), []);

  if (!initialized) {
    return <PastePrompt onPaste={handlePaste} />;
  }

  return (
    <div className="h-full flex flex-col relative" ref={containerRef} onClick={dismissPopup}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 border-b border-border/60 bg-secondary/50 shrink-0">
        <button
          onClick={copyParody}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-primary rounded-full border border-primary/30 hover:bg-primary/5 transition-colors"
        >
          Copy Parody
        </button>
        <button
          onClick={clearAll}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-muted-foreground rounded-full border border-border hover:bg-secondary transition-colors"
        >
          Start Over
        </button>
        <span className="ml-auto text-[11px] sm:text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">
          {modifiedCount} {modifiedCount === 1 ? "change" : "changes"}
        </span>
      </div>

      {/* Always side-by-side panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Original */}
        <div className="flex-1 border-r border-border/60 min-w-0">
          <EditorPane
            label="Original"
            text={originalText}
            setText={setOriginalText}
            words={originalWords}
            getDiffClass={getDiffClass}
            side="original"
          />
        </div>
        {/* Right: Parody */}
        <div className="flex-1 min-w-0">
          <EditorPane
            label="Parody"
            text={parodyText}
            setText={(v) => { setParodyText(v); setPopup(null); }}
            words={parodyWords}
            getDiffClass={getDiffClass}
            side="parody"
            onWordClick={handleParodyWordClick}
          />
        </div>
      </div>

      {/* Replace All Popup */}
      {popup && (
        <div
          className="absolute z-50 bg-popover border border-border rounded-xl shadow-lg p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 min-w-[180px] sm:min-w-[200px] max-w-[calc(100vw-2rem)]"
          style={{
            left: Math.min(popup.x, (containerRef.current?.offsetWidth ?? 300) - 200),
            top: popup.y + 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[12px] sm:text-[13px] text-foreground leading-snug">
            Replace all{" "}
            <span className="font-semibold text-destructive">"{popup.originalWord}"</span>
            {" "}with{" "}
            <span className="font-semibold text-primary">"{popup.newWord}"</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleReplaceAll}
              className="flex-1 px-3 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
            >
              Replace All
            </button>
            <button
              onClick={dismissPopup}
              className="flex-1 px-3 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-medium text-muted-foreground rounded-full border border-border hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Initial paste prompt */
function PastePrompt({ onPaste }: { onPaste: (text: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) onPaste(value);
  };

  const handlePasteEvent = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (text.trim()) {
      e.preventDefault();
      onPaste(text);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl flex flex-col items-center gap-5 md:gap-8">
        <div className="text-center space-y-2">
          <h2 className="text-[22px] sm:text-[24px] md:text-[28px] font-semibold tracking-tight text-foreground">
            Paste your lyrics
          </h2>
          <p className="text-[13px] sm:text-[14px] md:text-[15px] text-muted-foreground">
            Drop in the original, then edit your parody side by side.
          </p>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={handlePasteEvent}
          placeholder="Paste song lyrics here..."
          className="w-full h-44 sm:h-48 md:h-56 bg-background border border-border rounded-xl p-3 sm:p-4 md:p-5 font-mono text-[13px] sm:text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-5 sm:px-6 py-2 sm:py-2.5 bg-primary text-primary-foreground text-[14px] sm:text-[15px] font-medium rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Load Lyrics
        </button>
      </div>
    </div>
  );
}
