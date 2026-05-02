/**
 * ParodyEditor — Core component
 * Split panel: left = original lyrics (read-only after paste), right = editable parody.
 * Words are linked line-by-line. Modified words get amber highlight.
 * Hovering a word highlights its counterpart in cyan.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface WordPair {
  original: string;
  parody: string;
  modified: boolean;
}

interface LinePair {
  words: WordPair[];
}

export function ParodyEditor() {
  const [originalText, setOriginalText] = useState("");
  const [lines, setLines] = useState<LinePair[]>([]);
  const [hoveredWord, setHoveredWord] = useState<{ line: number; word: number } | null>(null);
  const [editingWord, setEditingWord] = useState<{ line: number; word: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const hasContent = lines.length > 0;

  // Parse pasted text into linked word pairs
  const handlePaste = useCallback((text: string) => {
    setOriginalText(text);
    const rawLines = text.split("\n");
    const parsed: LinePair[] = rawLines.map((line) => {
      const words = line.split(/(\s+)/).filter((w) => w.length > 0);
      return {
        words: words.map((w) => ({
          original: w,
          parody: w,
          modified: false,
        })),
      };
    });
    setLines(parsed);
  }, []);

  // Start editing a word on the parody side
  const startEdit = useCallback((lineIdx: number, wordIdx: number) => {
    const word = lines[lineIdx]?.words[wordIdx];
    if (!word || word.original.trim() === "") return; // don't edit whitespace
    setEditingWord({ line: lineIdx, word: wordIdx });
    setEditValue(word.parody);
  }, [lines]);

  // Commit edit
  const commitEdit = useCallback(() => {
    if (!editingWord) return;
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[editingWord.line] };
      const words = [...line.words];
      const word = { ...words[editingWord.word] };
      word.parody = editValue;
      word.modified = editValue !== word.original;
      words[editingWord.word] = word;
      line.words = words;
      next[editingWord.line] = line;
      return next;
    });
    setEditingWord(null);
    setEditValue("");
  }, [editingWord, editValue]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingWord && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingWord]);

  // Export parody text
  const getParodyText = useCallback(() => {
    return lines.map((line) => line.words.map((w) => w.parody).join("")).join("\n");
  }, [lines]);

  const copyParody = useCallback(() => {
    navigator.clipboard.writeText(getParodyText());
  }, [getParodyText]);

  const clearAll = useCallback(() => {
    setOriginalText("");
    setLines([]);
    setEditingWord(null);
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
            {lines.reduce((acc, l) => acc + l.words.filter((w) => w.modified).length, 0)} words modified
          </span>
        </div>
      )}

      {/* Split panels */}
      <div className="flex-1 overflow-hidden">
        {!hasContent ? (
          <PastePrompt onPaste={handlePaste} />
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-5 py-2 border-b border-border bg-card/20">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    Original
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-7">
                  {lines.map((line, lineIdx) => (
                    <div key={lineIdx} className="min-h-[1.75rem]">
                      {line.words.map((word, wordIdx) => {
                        const isHovered =
                          hoveredWord?.line === lineIdx && hoveredWord?.word === wordIdx;
                        const isWhitespace = word.original.trim() === "";
                        return (
                          <span
                            key={wordIdx}
                            className={`inline transition-all duration-150 ${
                              isWhitespace
                                ? ""
                                : isHovered
                                ? "bg-primary/20 text-primary rounded px-0.5"
                                : word.modified
                                ? "text-muted-foreground line-through decoration-accent/50"
                                : "text-foreground"
                            }`}
                            onMouseEnter={() =>
                              !isWhitespace && setHoveredWord({ line: lineIdx, word: wordIdx })
                            }
                            onMouseLeave={() => setHoveredWord(null)}
                          >
                            {word.original}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="w-[3px] bg-border hover:bg-primary/50 transition-colors" />

            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-5 py-2 border-b border-border bg-card/20">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    Parody
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-7">
                  {lines.map((line, lineIdx) => (
                    <div key={lineIdx} className="min-h-[1.75rem]">
                      {line.words.map((word, wordIdx) => {
                        const isHovered =
                          hoveredWord?.line === lineIdx && hoveredWord?.word === wordIdx;
                        const isEditing =
                          editingWord?.line === lineIdx && editingWord?.word === wordIdx;
                        const isWhitespace = word.original.trim() === "";

                        if (isEditing) {
                          return (
                            <input
                              key={wordIdx}
                              ref={inputRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") {
                                  setEditingWord(null);
                                  setEditValue("");
                                }
                              }}
                              className="inline-block bg-primary/20 border border-primary rounded px-1 py-0 font-mono text-sm text-primary outline-none min-w-[2ch]"
                              style={{ width: `${Math.max(editValue.length, 2)}ch` }}
                            />
                          );
                        }

                        return (
                          <span
                            key={wordIdx}
                            className={`inline transition-all duration-150 ${
                              isWhitespace
                                ? ""
                                : isHovered
                                ? "bg-primary/20 text-primary rounded px-0.5 cursor-pointer"
                                : word.modified
                                ? "bg-accent/15 text-accent rounded px-0.5 cursor-pointer font-medium"
                                : "text-foreground cursor-pointer hover:text-primary/80"
                            }`}
                            onMouseEnter={() =>
                              !isWhitespace && setHoveredWord({ line: lineIdx, word: wordIdx })
                            }
                            onMouseLeave={() => setHoveredWord(null)}
                            onClick={() => !isWhitespace && startEdit(lineIdx, wordIdx)}
                          >
                            {word.parody}
                          </span>
                        );
                      })}
                    </div>
                  ))}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (value.trim()) {
      onPaste(value);
    }
  };

  // Also handle paste event directly
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
          <h2 className="text-2xl font-semibold text-foreground">Paste Your Song Lyrics</h2>
          <p className="text-sm text-muted-foreground font-mono">
            Paste the original lyrics below, then click any word on the right to write your parody
          </p>
        </div>
        <textarea
          ref={textareaRef}
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
