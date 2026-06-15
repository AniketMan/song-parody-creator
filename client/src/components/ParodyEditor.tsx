/**
 * ParodyEditor -- Dual-panel editor with:
 * - Word-level diff highlighting (scroll-synced overlay)
 * - localStorage auto-save
 * - Cross-panel scroll sync (original <-> parody)
 * - Syllable/meter counter per line
 * - Replace All popup on highlighted words
 *
 * Desktop: side-by-side. Mobile: vertical stack.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { BarChart2, Copy, Trash2 } from "lucide-react";


// -- Types --

interface ReplaceAllPopup {
  originalWord: string;
  newWord: string;
  x: number;
  y: number;
}



// -- Hooks --

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

// -- Utilities --

/** Estimate syllable count for a line of text */
function countSyllables(line: string): number {
  if (!line) return 0;
  const words = line.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
  let count = 0;
  for (const word of words) {
    if (!word) continue;
    if (word.length <= 3) {
      count += 1;
      continue;
    }
    let w = word.replace(/(?:es|ed|e)$/, "");
    w = w.replace(/^y/, "");
    const vowels = w.match(/[aeiouy]{1,2}/g);
    count += vowels ? vowels.length : 1;
  }
  return count;
}


// -- Storage --

const STORAGE_KEY = "parody_creator_state_v1";

interface SavedState {
  originalText: string;
  parodyText: string;
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage restricted -- silently fail
  }
}

// -- EditorPane --

function EditorPane({
  label,
  text,
  setText,
  words,
  getDiffClass,
  side,
  onWordClick,
  textareaRef,
  onScroll,
}: {
  label: string;
  text: string;
  setText: (v: string) => void;
  words: string[][];
  getDiffClass: (side: "original" | "parody", lineIdx: number, wordIdx: number) => string;
  side: "original" | "parody";
  onWordClick?: (e: React.MouseEvent, lineIdx: number, wordIdx: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onScroll: () => void;
}) {
  const highlightRef = useRef<HTMLDivElement>(null);

  const syncHighlight = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [textareaRef]);

  const handleScroll = useCallback(() => {
    syncHighlight();
    onScroll();
  }, [syncHighlight, onScroll]);

  // Keep highlight in sync when text changes (content reflow)
  useEffect(() => {
    syncHighlight();
  }, [text, syncHighlight]);

  return (
    <div className="h-full flex flex-col min-w-0 min-h-0">
      <div className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 border-b border-border/40 shrink-0">
        <span className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Highlight overlay */}
        <div
          ref={highlightRef}
          className="absolute inset-0 p-3 sm:p-4 md:p-6 font-mono text-[13px] md:text-[14px] leading-6 sm:leading-7 whitespace-pre-wrap break-words overflow-auto pointer-events-none hide-scrollbar"
          style={{ scrollbarWidth: "none" }}
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
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="absolute inset-0 w-full h-full p-3 sm:p-4 md:p-6 font-mono text-[13px] md:text-[14px] leading-6 sm:leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words overflow-auto"
        />
      </div>
    </div>
  );
}

// -- Main Component --

export function ParodyEditor() {
  // Load persisted state
  const saved = useMemo(() => loadState(), []);

  const [originalText, setOriginalText] = useState(saved?.originalText ?? "");
  const [parodyText, setParodyText] = useState(saved?.parodyText ?? "");
  const [initialized, setInitialized] = useState(!!saved?.originalText);
  const [popup, setPopup] = useState<ReplaceAllPopup | null>(null);
  // Tool panel visibility (desktop: always visible sidebar, mobile: collapsible)
  const [toolsOpen, setToolsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<HTMLTextAreaElement>(null);
  const parodyRef = useRef<HTMLTextAreaElement>(null);
  const scrollLockRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  // Persist state on change
  useEffect(() => {
    saveState({ originalText, parodyText });
  }, [originalText, parodyText]);

  // -- Parsing --

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
      const maxW = Math.max(originalWords[l]?.length ?? 0, parodyWords[l]?.length ?? 0);
      for (let w = 0; w < maxW; w++) {
        const orig = originalWords[l]?.[w] ?? "";
        const paro = parodyWords[l]?.[w] ?? "";
        if (orig !== paro) count++;
      }
    }
    return count;
  }, [originalWords, parodyWords]);

  // -- Handlers --

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
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  // -- Diff highlighting --

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

  // -- Replace All popup (click highlighted word) --

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

  // -- Cross-panel scroll sync --

  const handleOriginalScroll = useCallback(() => {
    if (scrollLockRef.current && scrollLockRef.current !== "original") return;
    scrollLockRef.current = "original";
    if (originalRef.current && parodyRef.current) {
      parodyRef.current.scrollTop = originalRef.current.scrollTop;
    }
    setTimeout(() => { scrollLockRef.current = null; }, 50);
  }, []);

  const handleParodyScroll = useCallback(() => {
    if (scrollLockRef.current && scrollLockRef.current !== "parody") return;
    scrollLockRef.current = "parody";
    if (parodyRef.current && originalRef.current) {
      originalRef.current.scrollTop = parodyRef.current.scrollTop;
    }
    setTimeout(() => { scrollLockRef.current = null; }, 50);
  }, []);



  // -- Syllable data --

  const syllableData = useMemo(() => {
    const origLines = originalText.split("\n");
    const parodyLines = parodyText.split("\n");
    const maxLen = Math.max(origLines.length, parodyLines.length);
    const data: { origLine: string; parodyLine: string; origSyl: number; parodySyl: number; match: boolean }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const oL = origLines[i] ?? "";
      const pL = parodyLines[i] ?? "";
      const oS = countSyllables(oL);
      const pS = countSyllables(pL);
      data.push({ origLine: oL, parodyLine: pL, origSyl: oS, parodySyl: pS, match: oS === pS });
    }
    return data;
  }, [originalText, parodyText]);

  // -- Render --

  if (!initialized) {
    return <PastePrompt onPaste={handlePaste} />;
  }

  return (
    <div className="h-full flex relative" ref={containerRef} onClick={dismissPopup}>
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 border-b border-border/60 bg-secondary/50 shrink-0">
          <button
            onClick={copyParody}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-primary rounded-full border border-primary/30 hover:bg-primary/5 transition-colors"
            title="Copy parody text to clipboard"
          >
            <span className="hidden sm:inline">Copy Parody</span>
            <Copy size={14} className="sm:hidden" />
          </button>
          <button
            onClick={clearAll}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-muted-foreground rounded-full border border-border hover:bg-secondary transition-colors"
            title="Clear everything and start over"
          >
            <span className="hidden sm:inline">Start Over</span>
            <Trash2 size={14} className="sm:hidden" />
          </button>
          {isMobile && (
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-full border transition-colors ${toolsOpen ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-secondary"}`}
              title="Toggle tools panel"
            >
              Tools
            </button>
          )}
          <span className="ml-auto text-[11px] sm:text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">
            {modifiedCount} {modifiedCount === 1 ? "change" : "changes"}
          </span>
        </div>

        {/* Panels */}
        <div className={`flex-1 flex overflow-hidden min-h-0 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className={`min-w-0 min-h-0 ${isMobile ? "flex-1 border-b border-border/60" : "flex-1 border-r border-border/60"}`}>
            <EditorPane
              label="Original"
              text={originalText}
              setText={setOriginalText}
              words={originalWords}
              getDiffClass={getDiffClass}
              side="original"
              textareaRef={originalRef}
              onScroll={handleOriginalScroll}
            />
          </div>
          <div className="flex-1 min-w-0 min-h-0">
            <EditorPane
              label="Parody"
              text={parodyText}
              setText={(v) => { setParodyText(v); setPopup(null); }}
              words={parodyWords}
              getDiffClass={getDiffClass}
              side="parody"
              onWordClick={handleParodyWordClick}
              textareaRef={parodyRef}
              onScroll={handleParodyScroll}
            />
          </div>
        </div>
      </div>

      {/* Tools sidebar (desktop: always visible, mobile: overlay) */}
      {(isMobile ? toolsOpen : true) && (
        <div className={`${isMobile ? "absolute inset-0 z-40 bg-background/95 backdrop-blur-sm" : "w-72 xl:w-80 border-l border-border/60 shrink-0"} flex flex-col`}>
          {isMobile && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
              <span className="text-[13px] font-semibold">Tools</span>
              <button onClick={() => setToolsOpen(false)} className="text-muted-foreground text-[13px] hover:text-foreground">
                Done
              </button>
            </div>
          )}

          {/* Meter content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <MeterPanel data={syllableData} />
          </div>
        </div>
      )}

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


// -- Meter Panel --

function MeterPanel({ data }: { data: { origLine: string; parodyLine: string; origSyl: number; parodySyl: number; match: boolean }[] }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <BarChart2 size={14} className="text-primary" /> Syllable Meter
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Compare syllable counts line-by-line. Green means your parody matches the original rhythm.
        </p>
      </div>

      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto hide-scrollbar">
        {data.map((row, idx) => {
          if (!row.origLine.trim() && !row.parodyLine.trim()) return null;
          return (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/60 bg-secondary/30 text-[12px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-5">
                  {idx + 1}
                </span>
                <span className="truncate text-foreground/80 max-w-[120px]">
                  {row.parodyLine || "---"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {row.origSyl}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    row.match
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {row.parodySyl}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Paste Prompt --

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
