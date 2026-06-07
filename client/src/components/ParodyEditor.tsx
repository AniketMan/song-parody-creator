/**
 * ParodyEditor — Both sides editable with Replace All
 * Left: Original lyrics (editable textarea).
 * Right: Parody lyrics (editable textarea).
 * Words linked by line/position. Modified words get highlighted.
 * Clicking a highlighted word on the parody side offers "Replace All" to swap every
 * instance of the original word with the new parody word.
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface ReplaceAllPopup {
  originalWord: string;
  newWord: string;
  x: number;
  y: number;
}

export function ParodyEditor() {
  const [originalText, setOriginalText] = useState("");
  const [parodyText, setParodyText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [popup, setPopup] = useState<ReplaceAllPopup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse text into lines of words
  const parseWords = useCallback((text: string): string[][] => {
    return text.split("\n").map((line) =>
      line.split(/\s+/).filter((w) => w.length > 0)
    );
  }, []);

  const originalWords = useMemo(() => parseWords(originalText), [originalText, parseWords]);
  const parodyWords = useMemo(() => parseWords(parodyText), [parodyText, parseWords]);

  // Count modified words
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

  // Handle initial paste
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

  // Determine diff status for a word position
  const getDiffClass = useCallback(
    (side: "original" | "parody", lineIdx: number, wordIdx: number): string => {
      const orig = originalWords[lineIdx]?.[wordIdx] ?? "";
      const paro = parodyWords[lineIdx]?.[wordIdx] ?? "";
      if (orig === paro) return "";
      if (side === "original") return "bg-destructive/20";
      return "bg-accent/20";
    },
    [originalWords, parodyWords]
  );

  // Handle clicking a highlighted parody word to show Replace All popup
  const handleParodyWordClick = useCallback(
    (e: React.MouseEvent, lineIdx: number, wordIdx: number) => {
      const orig = originalWords[lineIdx]?.[wordIdx] ?? "";
      const paro = parodyWords[lineIdx]?.[wordIdx] ?? "";
      if (orig === paro || !orig || !paro) return;

      // Count how many other instances of the original word exist
      let instanceCount = 0;
      for (const line of originalWords) {
        for (const w of line) {
          if (w.toLowerCase() === orig.toLowerCase()) instanceCount++;
        }
      }

      // Only show popup if there are other instances to replace
      if (instanceCount <= 1) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const x = e.clientX - (rect?.left ?? 0);
      const y = e.clientY - (rect?.top ?? 0);

      setPopup({ originalWord: orig, newWord: paro, x, y });
    },
    [originalWords, parodyWords]
  );

  // Replace all instances of originalWord with newWord in parody text
  const handleReplaceAll = useCallback(() => {
    if (!popup) return;
    const { originalWord, newWord } = popup;

    // Build new parody by replacing every word that matches the original
    const newParodyLines = parodyText.split("\n").map((line, lineIdx) => {
      const words = line.split(/(\s+)/); // preserve whitespace
      const origLine = originalWords[lineIdx] ?? [];
      let origWordIdx = 0;

      return words
        .map((token) => {
          if (token.match(/^\s*$/) || token.length === 0) return token;
          const correspondingOrig = origLine[origWordIdx] ?? "";
          origWordIdx++;
          // If the original word at this position matches and the parody word hasn't been changed yet
          if (correspondingOrig.toLowerCase() === originalWord.toLowerCase() && token.toLowerCase() === originalWord.toLowerCase()) {
            // Preserve case pattern
            if (correspondingOrig === correspondingOrig.toUpperCase()) return newWord.toUpperCase();
            if (correspondingOrig[0] === correspondingOrig[0].toUpperCase()) return newWord[0].toUpperCase() + newWord.slice(1);
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
      <div className="flex items-center gap-3 px-5 py-2 border-b border-border bg-card/30">
        <button
          onClick={copyParody}
          className="px-3 py-1.5 text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/30 rounded hover:bg-primary/20 transition-colors"
        >
          Copy Parody
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 text-xs font-mono font-medium bg-destructive/10 text-destructive border border-destructive/30 rounded hover:bg-destructive/20 transition-colors"
        >
          Clear All
        </button>
        <span className="ml-auto text-xs font-mono text-muted-foreground">
          {modifiedCount} word{modifiedCount !== 1 ? "s" : ""} modified
        </span>
      </div>

      {/* Split panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left: Original */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="px-5 py-2 border-b border-border bg-card/20">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Original
                </span>
              </div>
              <div className="flex-1 overflow-y-auto relative">
                {/* Highlight layer */}
                <div
                  className="absolute inset-0 p-5 font-mono text-sm leading-7 pointer-events-none whitespace-pre-wrap break-words"
                  aria-hidden="true"
                >
                  {originalWords.map((line, lineIdx) => (
                    <div key={lineIdx} className="min-h-[1.75rem]">
                      {line.length === 0 && <br />}
                      {line.map((word, wordIdx) => {
                        const cls = getDiffClass("original", lineIdx, wordIdx);
                        return (
                          <span
                            key={wordIdx}
                            className={`inline-block mr-[0.5ch] rounded px-0.5 text-transparent ${cls}`}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Editable textarea */}
                <textarea
                  value={originalText}
                  onChange={(e) => setOriginalText(e.target.value)}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full p-5 font-mono text-sm leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-[3px] bg-border hover:bg-primary/50 transition-colors" />

          {/* Right: Parody */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="px-5 py-2 border-b border-border bg-card/20">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Parody
                </span>
              </div>
              <div className="flex-1 overflow-y-auto relative">
                {/* Highlight layer — clickable for Replace All */}
                <div
                  className="absolute inset-0 p-5 font-mono text-sm leading-7 whitespace-pre-wrap break-words z-10"
                  style={{ pointerEvents: "none" }}
                >
                  {parodyWords.map((line, lineIdx) => (
                    <div key={lineIdx} className="min-h-[1.75rem]">
                      {line.length === 0 && <br />}
                      {line.map((word, wordIdx) => {
                        const cls = getDiffClass("parody", lineIdx, wordIdx);
                        const isModified = cls !== "";
                        return (
                          <span
                            key={wordIdx}
                            onClick={isModified ? (e) => { e.stopPropagation(); handleParodyWordClick(e, lineIdx, wordIdx); } : undefined}
                            className={`inline-block mr-[0.5ch] rounded px-0.5 text-transparent ${cls} ${isModified ? "cursor-pointer pointer-events-auto hover:ring-1 hover:ring-primary/50" : ""}`}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Editable textarea */}
                <textarea
                  value={parodyText}
                  onChange={(e) => { setParodyText(e.target.value); setPopup(null); }}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full p-5 font-mono text-sm leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Replace All Popup */}
      {popup && (
        <div
          className="absolute z-50 bg-card border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2 min-w-[200px]"
          style={{ left: popup.x, top: popup.y + 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-mono text-muted-foreground">
            Replace all <span className="text-destructive font-semibold">"{popup.originalWord}"</span> with <span className="text-primary font-semibold">"{popup.newWord}"</span>?
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReplaceAll}
              className="flex-1 px-3 py-1.5 text-xs font-mono font-medium bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Replace All
            </button>
            <button
              onClick={dismissPopup}
              className="flex-1 px-3 py-1.5 text-xs font-mono font-medium bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
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
    if (value.trim()) {
      onPaste(value);
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (text.trim()) {
      e.preventDefault();
      onPaste(text);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Paste Your Song Lyrics
          </h2>
          <p className="text-sm text-muted-foreground font-mono">
            Paste the original lyrics below, then freely edit both sides
          </p>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={handlePasteEvent}
          placeholder="Paste song lyrics here..."
          className="w-full h-64 bg-card border border-border rounded-lg p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-mono font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Load Lyrics
        </button>
      </div>
    </div>
  );
}
