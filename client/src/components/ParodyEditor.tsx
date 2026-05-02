/**
 * ParodyEditor — Free-typing version
 * Left: Original lyrics (read-only display after paste).
 * Right: Freely editable textarea for parody.
 * Words are linked by line and position automatically.
 * Hovering a word on the original side highlights the corresponding word on the parody side and vice versa.
 * Modified words (different from original) get amber highlight on both sides.
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function ParodyEditor() {
  const [originalText, setOriginalText] = useState("");
  const [parodyText, setParodyText] = useState("");
  const [hoveredWord, setHoveredWord] = useState<{ line: number; word: number } | null>(null);
  const parodyRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = originalText.trim().length > 0;

  // Parse text into lines of words (non-whitespace tokens)
  const parseWords = useCallback((text: string): string[][] => {
    return text.split("\n").map((line) =>
      line.split(/\s+/).filter((w) => w.length > 0)
    );
  }, []);

  const originalWords = useMemo(() => parseWords(originalText), [originalText, parseWords]);
  const parodyWords = useMemo(() => parseWords(parodyText), [parodyText, parseWords]);

  // Determine which words differ
  const getDiffStatus = useCallback(
    (lineIdx: number, wordIdx: number): boolean => {
      const orig = originalWords[lineIdx]?.[wordIdx] ?? "";
      const paro = parodyWords[lineIdx]?.[wordIdx] ?? "";
      if (orig === "" && paro === "") return false;
      return orig !== paro;
    },
    [originalWords, parodyWords]
  );

  // Count modified words
  const modifiedCount = useMemo(() => {
    let count = 0;
    const maxLines = Math.max(originalWords.length, parodyWords.length);
    for (let l = 0; l < maxLines; l++) {
      const maxWords = Math.max(
        originalWords[l]?.length ?? 0,
        parodyWords[l]?.length ?? 0
      );
      for (let w = 0; w < maxWords; w++) {
        if (getDiffStatus(l, w)) count++;
      }
    }
    return count;
  }, [originalWords, parodyWords, getDiffStatus]);

  // Handle initial paste
  const handlePaste = useCallback((text: string) => {
    setOriginalText(text);
    setParodyText(text);
  }, []);

  // Copy parody to clipboard
  const copyParody = useCallback(() => {
    navigator.clipboard.writeText(parodyText);
  }, [parodyText]);

  // Clear everything
  const clearAll = useCallback(() => {
    setOriginalText("");
    setParodyText("");
    setHoveredWord(null);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      {hasContent && (
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
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!hasContent ? (
          <PastePrompt onPaste={handlePaste} />
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left panel: Original (read-only, word-highlighted) */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-5 py-2 border-b border-border bg-card/20">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    Original
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-7">
                  {originalWords.map((line, lineIdx) => (
                    <div key={lineIdx} className="min-h-[1.75rem]">
                      {line.length === 0 && <br />}
                      {line.map((word, wordIdx) => {
                        const isHovered =
                          hoveredWord?.line === lineIdx &&
                          hoveredWord?.word === wordIdx;
                        const isModified = getDiffStatus(lineIdx, wordIdx);
                        return (
                          <span
                            key={wordIdx}
                            className={`inline-block mr-[0.5ch] transition-all duration-150 rounded px-0.5 ${
                              isHovered
                                ? "bg-primary/25 text-primary"
                                : isModified
                                ? "text-muted-foreground line-through decoration-accent/60"
                                : "text-foreground"
                            }`}
                            onMouseEnter={() =>
                              setHoveredWord({ line: lineIdx, word: wordIdx })
                            }
                            onMouseLeave={() => setHoveredWord(null)}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="w-[3px] bg-border hover:bg-primary/50 transition-colors" />

            {/* Right panel: Parody (free-typing textarea + word overlay for highlights) */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-5 py-2 border-b border-border bg-card/20">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    Parody
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto relative">
                  {/* Highlight layer (behind textarea) */}
                  <div
                    className="absolute inset-0 p-5 font-mono text-sm leading-7 pointer-events-none whitespace-pre-wrap break-words text-transparent"
                    aria-hidden="true"
                  >
                    {parodyWords.map((line, lineIdx) => (
                      <div key={lineIdx} className="min-h-[1.75rem]">
                        {line.length === 0 && <br />}
                        {line.map((word, wordIdx) => {
                          const isHovered =
                            hoveredWord?.line === lineIdx &&
                            hoveredWord?.word === wordIdx;
                          const isModified = getDiffStatus(lineIdx, wordIdx);
                          return (
                            <span
                              key={wordIdx}
                              className={`inline-block mr-[0.5ch] rounded px-0.5 ${
                                isHovered
                                  ? "bg-primary/25"
                                  : isModified
                                  ? "bg-accent/15"
                                  : ""
                              }`}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {/* Editable textarea (on top, transparent background) */}
                  <textarea
                    ref={parodyRef}
                    value={parodyText}
                    onChange={(e) => setParodyText(e.target.value)}
                    spellCheck={false}
                    className="absolute inset-0 w-full h-full p-5 font-mono text-sm leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words"
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
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
            Paste the original lyrics below, then freely edit your parody on the right
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
