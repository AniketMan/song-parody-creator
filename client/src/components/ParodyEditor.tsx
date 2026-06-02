/**
 * ParodyEditor — Both sides editable
 * Left: Original lyrics (editable textarea).
 * Right: Parody lyrics (editable textarea).
 * Words linked by line/position. Modified words get amber highlight on parody, strikethrough on original.
 */
import { useState, useCallback, useMemo } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function ParodyEditor() {
  const [originalText, setOriginalText] = useState("");
  const [parodyText, setParodyText] = useState("");
  const [initialized, setInitialized] = useState(false);

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

  if (!initialized) {
    return <PastePrompt onPaste={handlePaste} />;
  }

  return (
    <div className="h-full flex flex-col">
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
                {/* Highlight layer */}
                <div
                  className="absolute inset-0 p-5 font-mono text-sm leading-7 pointer-events-none whitespace-pre-wrap break-words"
                  aria-hidden="true"
                >
                  {parodyWords.map((line, lineIdx) => (
                    <div key={lineIdx} className="min-h-[1.75rem]">
                      {line.length === 0 && <br />}
                      {line.map((word, wordIdx) => {
                        const cls = getDiffClass("parody", lineIdx, wordIdx);
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
                  value={parodyText}
                  onChange={(e) => setParodyText(e.target.value)}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full p-5 font-mono text-sm leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
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
