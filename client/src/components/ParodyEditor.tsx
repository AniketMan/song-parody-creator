/**
 * ParodyEditor -- Full-featured dual-panel parody writing tool:
 * - Multiple songs / catalog (localStorage persisted)
 * - Editable song title
 * - Bilingual dictionary (Romanized Hindi <-> English) with toggle
 * - Original-to-parody auto-alignment on left-side edits
 * - Word-level diff highlighting (scroll-synced overlay)
 * - Cross-panel scroll sync
 * - Syllable/meter counter per line
 * - Replace All popup on highlighted words
 *
 * Desktop: side-by-side + sidebar. Mobile: vertical stack + collapsible tools.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  BarChart2,
  BookOpen,
  Copy,
  Plus,
  Trash2,
  ChevronDown,
  X,
  Eye,
  Loader2,
  Zap,
} from "lucide-react";

// -- Types --

interface DictEntry {
  id: string;
  foreign: string;
  english: string;
}

interface Song {
  id: string;
  title: string;
  originalText: string;
  parodyText: string;
  dictionary: DictEntry[];
}

interface ReplaceAllPopup {
  originalWord: string;
  newWord: string;
  x: number;
  y: number;
}

type ToolTab = "meter" | "dictionary";

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

/** Convert text using dictionary mappings (Hindi <-> English) */
function convertText(
  text: string,
  dictionary: DictEntry[],
  toEnglish: boolean
): string {
  if (!text || dictionary.length === 0) return text;
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const tokens = line.split(/(\s+|[.,!?;:'"()\-])/);
      return tokens
        .map((token) => {
          if (!token.trim() || /^[.,!?;:'"()\-]+$/.test(token)) return token;
          const clean = token.toLowerCase();
          if (toEnglish) {
            const match = dictionary.find(
              (d) => d.foreign && d.foreign.toLowerCase() === clean
            );
            if (match && match.english) {
              const isTitleCase =
                token[0] === token[0].toUpperCase() && token.length > 1;
              let rep = match.english;
              if (isTitleCase) rep = rep[0].toUpperCase() + rep.slice(1);
              return rep;
            }
          } else {
            const match = dictionary.find(
              (d) => d.english && d.english.toLowerCase() === clean
            );
            if (match && match.foreign) {
              const isTitleCase =
                token[0] === token[0].toUpperCase() && token.length > 1;
              let rep = match.foreign;
              if (isTitleCase) rep = rep[0].toUpperCase() + rep.slice(1);
              return rep;
            }
          }
          return token;
        })
        .join("");
    })
    .join("\n");
}

/** Auto-align parody when original changes */
function alignParody(
  newOriginal: string,
  oldOriginal: string,
  currentParody: string
): string {
  const newLines = newOriginal.split("\n");
  const oldLines = oldOriginal.split("\n");
  const parodyLines = currentParody.split("\n");

  const aligned = newLines.map((line, idx) => {
    const oldLine = oldLines[idx];
    const parodyLine = parodyLines[idx];
    // If no parody line exists yet, use the new original line
    if (parodyLine === undefined) return line;
    // If parody was untouched (same as old original), update it to match new original
    if (parodyLine.trim() === "" || parodyLine === oldLine) return line;
    // Otherwise keep the user's parody edits
    return parodyLine;
  });

  return aligned.join("\n");
}

// -- Storage --

const STORAGE_KEY = "parody_creator_songs_v2";

function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [];
  } catch {
    return [];
  }
}

function saveSongs(songs: Song[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch {
    // Storage restricted
  }
}

function createEmptySong(): Song {
  return {
    id: "song-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    title: "Untitled Song",
    originalText: "",
    parodyText: "",
    dictionary: [],
  };
}

// -- Auto-translation via MyMemory API --

async function autoTranslateWords(
  text: string,
  existingDict: DictEntry[]
): Promise<DictEntry[]> {
  const allWords = text
    .split(/[\n\s]+/)
    .map((w) => w.replace(/[.,!?;:'"()\-]/g, "").toLowerCase())
    .filter((w) => w.length > 0);
  const uniqueWords = [...new Set(allWords)];
  const existingForeign = new Set(existingDict.map((d) => d.foreign.toLowerCase()));
  const wordsToTranslate = uniqueWords.filter((w) => !existingForeign.has(w));

  if (wordsToTranslate.length === 0) return existingDict;

  const newEntries: DictEntry[] = [];
  const chunkSize = 15;

  for (let i = 0; i < wordsToTranslate.length; i += chunkSize) {
    const chunk = wordsToTranslate.slice(i, i + chunkSize);
    const joined = chunk.join(" | ");
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(joined)}&langpair=hi|en`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const translated: string = data?.responseData?.translatedText || "";
      const translatedParts = translated.split(" | ").map((p: string) => p.trim().toLowerCase());

      chunk.forEach((word, idx) => {
        const eng = translatedParts[idx];
        if (eng && eng !== word && eng.length > 0) {
          newEntries.push({
            id: "d-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            foreign: word,
            english: eng,
          });
        }
      });
    } catch {
      continue;
    }
  }

  return [...existingDict, ...newEntries];
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
  getDiffClass: (
    side: "original" | "parody",
    lineIdx: number,
    wordIdx: number
  ) => string;
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

  useEffect(() => {
    syncHighlight();
  }, [text, syncHighlight]);

  // Handle clicks on the textarea to detect taps on modified words (mobile fix)
  const handleTextareaClick = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!onWordClick) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const caretPos = textarea.selectionStart;
      if (caretPos === undefined || caretPos === null) return;

      // Map caret position to line and word index
      const lines = text.split("\n");
      let charCount = 0;
      let targetLineIdx = -1;
      let posInLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineLen = lines[i].length + 1; // +1 for newline
        if (charCount + lineLen > caretPos) {
          targetLineIdx = i;
          posInLine = caretPos - charCount;
          break;
        }
        charCount += lineLen;
      }

      if (targetLineIdx === -1) {
        targetLineIdx = lines.length - 1;
        posInLine = (lines[targetLineIdx] || "").length;
      }

      // Find which word the caret is in
      const line = lines[targetLineIdx] || "";
      const lineWords = line.split(/\s+/).filter((w) => w.length > 0);
      let wordStart = 0;
      let targetWordIdx = -1;

      for (let w = 0; w < lineWords.length; w++) {
        const idx = line.indexOf(lineWords[w], wordStart);
        const wordEnd = idx + lineWords[w].length;
        if (posInLine >= idx && posInLine <= wordEnd) {
          targetWordIdx = w;
          break;
        }
        wordStart = wordEnd;
      }

      if (targetWordIdx === -1) return;

      // Only trigger if this word is modified
      const cls = getDiffClass(side, targetLineIdx, targetWordIdx);
      if (cls === "") return;

      onWordClick(e as unknown as React.MouseEvent, targetLineIdx, targetWordIdx);
    },
    [onWordClick, textareaRef, text, getDiffClass, side]
  );

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
          onClick={handleTextareaClick}
          spellCheck={false}
          className="absolute inset-0 w-full h-full p-3 sm:p-4 md:p-6 font-mono text-[13px] md:text-[14px] leading-6 sm:leading-7 bg-transparent text-foreground resize-none focus:outline-none caret-primary whitespace-pre-wrap break-words overflow-auto"
        />
      </div>
    </div>
  );
}

// -- Main Component --

export function ParodyEditor() {
  // Load songs from storage
  const initialSongs = useMemo(() => {
    const stored = loadSongs();
    return stored.length > 0 ? stored : [createEmptySong()];
  }, []);

  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [currentSongId, setCurrentSongId] = useState(initialSongs[0].id);
  const [popup, setPopup] = useState<ReplaceAllPopup | null>(null);
  const [isEnglishMode, setIsEnglishMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolTab>("meter");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Dictionary manual entry
  const [newForeign, setNewForeign] = useState("");
  const [newEnglish, setNewEnglish] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<HTMLTextAreaElement>(null);
  const parodyRef = useRef<HTMLTextAreaElement>(null);
  const scrollLockRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  const currentSong = songs.find((s) => s.id === currentSongId) || songs[0];

  // Persist songs on change
  useEffect(() => {
    saveSongs(songs);
  }, [songs]);

  // -- Song management --

  const updateCurrentSong = useCallback(
    (updater: (song: Song) => Song) => {
      setSongs((prev) =>
        prev.map((s) => (s.id === currentSongId ? updater(s) : s))
      );
    },
    [currentSongId]
  );

  const createNewSong = useCallback(() => {
    const newSong = createEmptySong();
    setSongs((prev) => [newSong, ...prev]);
    setCurrentSongId(newSong.id);
    setIsEnglishMode(false);
    setCatalogOpen(false);
  }, []);

  const deleteSong = useCallback(
    (id: string) => {
      setSongs((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length === 0) {
          const fresh = createEmptySong();
          setCurrentSongId(fresh.id);
          return [fresh];
        }
        if (id === currentSongId) {
          setCurrentSongId(filtered[0].id);
        }
        return filtered;
      });
    },
    [currentSongId]
  );

  // -- Text handling with auto-alignment and English mode --

  const handleOriginalChange = useCallback(
    (value: string) => {
      updateCurrentSong((song) => {
        let rawValue = value;
        // If in English mode, convert back to Hindi before storing
        if (isEnglishMode) {
          rawValue = convertText(value, song.dictionary, false);
        }
        const alignedParody = alignParody(
          rawValue,
          song.originalText,
          song.parodyText
        );
        return { ...song, originalText: rawValue, parodyText: alignedParody };
      });
    },
    [updateCurrentSong, isEnglishMode]
  );

  const handleParodyChange = useCallback(
    (value: string) => {
      updateCurrentSong((song) => {
        let rawValue = value;
        if (isEnglishMode) {
          rawValue = convertText(value, song.dictionary, false);
        }
        return { ...song, parodyText: rawValue };
      });
      setPopup(null);
    },
    [updateCurrentSong, isEnglishMode]
  );

  // Display text (possibly translated to English)
  const displayOriginal = useMemo(
    () =>
      isEnglishMode
        ? convertText(
            currentSong.originalText,
            currentSong.dictionary,
            true
          )
        : currentSong.originalText,
    [isEnglishMode, currentSong.originalText, currentSong.dictionary]
  );

  const displayParody = useMemo(
    () =>
      isEnglishMode
        ? convertText(currentSong.parodyText, currentSong.dictionary, true)
        : currentSong.parodyText,
    [isEnglishMode, currentSong.parodyText, currentSong.dictionary]
  );

  // -- Parsing --

  const parseWords = useCallback((text: string): string[][] => {
    return text.split("\n").map((line) =>
      line.split(/\s+/).filter((w) => w.length > 0)
    );
  }, []);

  const originalWords = useMemo(
    () => parseWords(displayOriginal),
    [displayOriginal, parseWords]
  );
  const parodyWords = useMemo(
    () => parseWords(displayParody),
    [displayParody, parseWords]
  );

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

  // -- Handlers --

  const handlePaste = useCallback(
    (text: string) => {
      updateCurrentSong((song) => ({
        ...song,
        originalText: text,
        parodyText: text,
      }));
      // Auto-translate in background
      setIsTranslating(true);
      autoTranslateWords(text, currentSong.dictionary)
        .then((newDict) => {
          updateCurrentSong((song) => ({ ...song, dictionary: newDict }));
        })
        .finally(() => setIsTranslating(false));
    },
    [updateCurrentSong, currentSong.dictionary]
  );

  const retranslate = useCallback(() => {
    if (!currentSong.originalText.trim()) return;
    setIsTranslating(true);
    autoTranslateWords(currentSong.originalText, [])
      .then((newDict) => {
        updateCurrentSong((song) => ({ ...song, dictionary: newDict }));
      })
      .finally(() => setIsTranslating(false));
  }, [currentSong.originalText, updateCurrentSong]);

  const copyParody = useCallback(() => {
    navigator.clipboard.writeText(currentSong.parodyText);
  }, [currentSong.parodyText]);

  const clearCurrent = useCallback(() => {
    updateCurrentSong((song) => ({
      ...song,
      originalText: "",
      parodyText: "",
    }));
    setPopup(null);
  }, [updateCurrentSong]);

  // -- Diff highlighting --

  const getDiffClass = useCallback(
    (
      side: "original" | "parody",
      lineIdx: number,
      wordIdx: number
    ): string => {
      const orig = originalWords[lineIdx]?.[wordIdx] ?? "";
      const paro = parodyWords[lineIdx]?.[wordIdx] ?? "";
      if (orig === paro) return "";
      if (side === "original") return "bg-[#ff3b30]/10 dark:bg-[#ff453a]/15";
      return "bg-[#0066cc]/10 dark:bg-[#2997ff]/15";
    },
    [originalWords, parodyWords]
  );

  // -- Replace All popup --

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

    const newParodyLines = displayParody.split("\n").map((line, lineIdx) => {
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
            if (correspondingOrig === correspondingOrig.toUpperCase())
              return newWord.toUpperCase();
            if (correspondingOrig[0] === correspondingOrig[0].toUpperCase())
              return newWord[0].toUpperCase() + newWord.slice(1);
            return newWord;
          }
          return token;
        })
        .join("");
    });

    const newText = newParodyLines.join("\n");
    // If in English mode, convert back before storing
    const stored = isEnglishMode
      ? convertText(newText, currentSong.dictionary, false)
      : newText;
    updateCurrentSong((song) => ({ ...song, parodyText: stored }));
    setPopup(null);
  }, [
    popup,
    displayParody,
    originalWords,
    isEnglishMode,
    currentSong.dictionary,
    updateCurrentSong,
  ]);

  const dismissPopup = useCallback(() => setPopup(null), []);

  // -- Cross-panel scroll sync --

  const handleOriginalScroll = useCallback(() => {
    if (scrollLockRef.current && scrollLockRef.current !== "original") return;
    scrollLockRef.current = "original";
    if (originalRef.current && parodyRef.current) {
      parodyRef.current.scrollTop = originalRef.current.scrollTop;
    }
    setTimeout(() => {
      scrollLockRef.current = null;
    }, 50);
  }, []);

  const handleParodyScroll = useCallback(() => {
    if (scrollLockRef.current && scrollLockRef.current !== "parody") return;
    scrollLockRef.current = "parody";
    if (parodyRef.current && originalRef.current) {
      originalRef.current.scrollTop = parodyRef.current.scrollTop;
    }
    setTimeout(() => {
      scrollLockRef.current = null;
    }, 50);
  }, []);

  // -- Dictionary management --

  const addDictEntry = useCallback(() => {
    if (!newForeign.trim() || !newEnglish.trim()) return;
    const entry: DictEntry = {
      id: "d-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      foreign: newForeign.trim().toLowerCase(),
      english: newEnglish.trim().toLowerCase(),
    };
    updateCurrentSong((song) => ({
      ...song,
      dictionary: [...song.dictionary, entry],
    }));
    setNewForeign("");
    setNewEnglish("");
  }, [newForeign, newEnglish, updateCurrentSong]);

  const removeDictEntry = useCallback(
    (id: string) => {
      updateCurrentSong((song) => ({
        ...song,
        dictionary: song.dictionary.filter((d) => d.id !== id),
      }));
    },
    [updateCurrentSong]
  );

  // -- Syllable data --

  const syllableData = useMemo(() => {
    const origLines = displayOriginal.split("\n");
    const parodyLines = displayParody.split("\n");
    const maxLen = Math.max(origLines.length, parodyLines.length);
    const data: {
      origLine: string;
      parodyLine: string;
      origSyl: number;
      parodySyl: number;
      match: boolean;
    }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const oL = origLines[i] ?? "";
      const pL = parodyLines[i] ?? "";
      const oS = countSyllables(oL);
      const pS = countSyllables(pL);
      data.push({
        origLine: oL,
        parodyLine: pL,
        origSyl: oS,
        parodySyl: pS,
        match: oS === pS,
      });
    }
    return data;
  }, [displayOriginal, displayParody]);

  // -- Render: Paste prompt if no text --

  const initialized = currentSong.originalText.trim().length > 0;

  if (!initialized) {
    return (
      <div className="h-full flex flex-col">
        {/* Song catalog bar */}
        <CatalogBar
          songs={songs}
          currentSongId={currentSongId}
          setCurrentSongId={(id) => {
            setCurrentSongId(id);
            setIsEnglishMode(false);
          }}
          createNewSong={createNewSong}
          deleteSong={deleteSong}
          catalogOpen={catalogOpen}
          setCatalogOpen={setCatalogOpen}
          isMobile={isMobile}
        />
        <PastePrompt onPaste={handlePaste} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" onClick={dismissPopup}>
      {/* Song catalog + title bar */}
      <CatalogBar
        songs={songs}
        currentSongId={currentSongId}
        setCurrentSongId={(id) => {
          setCurrentSongId(id);
          setIsEnglishMode(false);
        }}
        createNewSong={createNewSong}
        deleteSong={deleteSong}
        catalogOpen={catalogOpen}
        setCatalogOpen={setCatalogOpen}
        isMobile={isMobile}
      />

      {/* Title + controls bar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2 border-b border-border/60 bg-secondary/30 shrink-0">
        {/* Editable title */}
        <input
          type="text"
          value={currentSong.title}
          onChange={(e) =>
            updateCurrentSong((song) => ({ ...song, title: e.target.value }))
          }
          className="bg-transparent text-[13px] sm:text-[14px] font-semibold text-foreground focus:outline-none focus:border-b focus:border-primary px-1 py-0.5 min-w-0 flex-shrink"
          placeholder="Song title..."
        />

        {/* English toggle */}
        <button
          onClick={() => setIsEnglishMode(!isEnglishMode)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] sm:text-[12px] font-medium rounded-full border transition-colors shrink-0 ${
            isEnglishMode
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground border-border hover:bg-secondary"
          }`}
          title="Toggle English translation view"
        >
          <Eye size={12} />
          <span className="hidden sm:inline">
            {isEnglishMode ? "English" : "Hindi"}
          </span>
        </button>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={copyParody}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-primary rounded-full border border-primary/30 hover:bg-primary/5 transition-colors"
          title="Copy parody text"
        >
          <span className="hidden sm:inline">Copy Parody</span>
          <Copy size={14} className="sm:hidden" />
        </button>
        <button
          onClick={clearCurrent}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-muted-foreground rounded-full border border-border hover:bg-secondary transition-colors"
          title="Clear lyrics"
        >
          <span className="hidden sm:inline">Clear</span>
          <Trash2 size={14} className="sm:hidden" />
        </button>
        {isMobile && (
          <button
            onClick={() => setToolsOpen(!toolsOpen)}
            className={`px-2.5 py-1 text-[12px] font-medium rounded-full border transition-colors ${toolsOpen ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-secondary"}`}
          >
            Tools
          </button>
        )}
        <span className="text-[11px] sm:text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">
          {modifiedCount} {modifiedCount === 1 ? "change" : "changes"}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative" ref={containerRef}>
        {/* Editor panels */}
        <div className="flex-1 flex min-w-0 min-h-0">
          <div
            className={`flex overflow-hidden min-h-0 flex-1 ${isMobile ? "flex-col" : "flex-row"}`}
          >
            <div
              className={`min-w-0 min-h-0 ${isMobile ? "flex-1 border-b border-border/60" : "flex-1 border-r border-border/60"}`}
            >
              <EditorPane
                label={isEnglishMode ? "Original (English)" : "Original (Hindi)"}
                text={displayOriginal}
                setText={handleOriginalChange}
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
                text={displayParody}
                setText={handleParodyChange}
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

        {/* Tools sidebar */}
        {(isMobile ? toolsOpen : true) && (
          <div
            className={`${isMobile ? "absolute inset-0 z-40 bg-background/95 backdrop-blur-sm" : "w-72 xl:w-80 border-l border-border/60 shrink-0"} flex flex-col`}
          >
            {isMobile && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
                <span className="text-[13px] font-semibold">Tools</span>
                <button
                  onClick={() => setToolsOpen(false)}
                  className="text-muted-foreground text-[13px] hover:text-foreground"
                >
                  Done
                </button>
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex border-b border-border/60 shrink-0">
              <button
                onClick={() => setActiveTab("meter")}
                className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeTab === "meter" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BarChart2 size={12} /> Meter
              </button>
              <button
                onClick={() => setActiveTab("dictionary")}
                className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeTab === "dictionary" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BookOpen size={12} /> Dictionary
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === "meter" && <MeterPanel data={syllableData} />}
              {activeTab === "dictionary" && (
                <DictionaryPanel
                  dictionary={currentSong.dictionary}
                  newForeign={newForeign}
                  setNewForeign={setNewForeign}
                  newEnglish={newEnglish}
                  setNewEnglish={setNewEnglish}
                  addEntry={addDictEntry}
                  removeEntry={removeDictEntry}
                  isTranslating={isTranslating}
                  onRetranslate={retranslate}
                />
              )}
            </div>
          </div>
        )}

        {/* Replace All Popup */}
        {popup && (
          <div
            className="absolute z-50 bg-popover border border-border rounded-xl shadow-lg p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 min-w-[180px] sm:min-w-[200px] max-w-[calc(100vw-2rem)]"
            style={{
              left: Math.max(
                8,
                Math.min(
                  popup.x,
                  (containerRef.current?.offsetWidth ?? 300) - 200
                )
              ),
              top: Math.max(
                8,
                Math.min(
                  popup.y + 8,
                  (containerRef.current?.offsetHeight ?? 400) - 120
                )
              ),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[12px] sm:text-[13px] text-foreground leading-snug">
              Replace all{" "}
              <span className="font-semibold text-destructive">
                &quot;{popup.originalWord}&quot;
              </span>{" "}
              with{" "}
              <span className="font-semibold text-primary">
                &quot;{popup.newWord}&quot;
              </span>
              ?
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
    </div>
  );
}

// -- Catalog Bar --

function CatalogBar({
  songs,
  currentSongId,
  setCurrentSongId,
  createNewSong,
  deleteSong,
  catalogOpen,
  setCatalogOpen,
  isMobile,
}: {
  songs: Song[];
  currentSongId: string;
  setCurrentSongId: (id: string) => void;
  createNewSong: () => void;
  deleteSong: (id: string) => void;
  catalogOpen: boolean;
  setCatalogOpen: (v: boolean) => void;
  isMobile: boolean;
}) {
  const currentSong = songs.find((s) => s.id === currentSongId);

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 py-1.5 border-b border-border/40 bg-secondary/20">
        <button
          onClick={() => setCatalogOpen(!catalogOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          <span className="truncate max-w-[150px] sm:max-w-[200px]">
            {currentSong?.title || "Untitled"}
          </span>
          <ChevronDown
            size={12}
            className={`transition-transform ${catalogOpen ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={createNewSong}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-primary rounded-lg hover:bg-primary/5 transition-colors"
          title="New song"
        >
          <Plus size={12} />
          {!isMobile && <span>New</span>}
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {songs.length} {songs.length === 1 ? "song" : "songs"}
        </span>
      </div>

      {/* Dropdown catalog */}
      {catalogOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-popover border-b border-border shadow-lg max-h-[240px] overflow-y-auto">
          {songs.map((song) => (
            <div
              key={song.id}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors ${song.id === currentSongId ? "bg-primary/5 border-l-2 border-primary" : ""}`}
              onClick={() => {
                setCurrentSongId(song.id);
                setCatalogOpen(false);
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {song.title || "Untitled"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {song.originalText
                    ? song.originalText.split("\n")[0].slice(0, 40) + "..."
                    : "Empty"}
                </p>
              </div>
              {songs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSong(song.id);
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete song"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Dictionary Panel --

function DictionaryPanel({
  dictionary,
  newForeign,
  setNewForeign,
  newEnglish,
  setNewEnglish,
  addEntry,
  removeEntry,
  isTranslating,
  onRetranslate,
}: {
  dictionary: DictEntry[];
  newForeign: string;
  setNewForeign: (v: string) => void;
  newEnglish: string;
  setNewEnglish: (v: string) => void;
  addEntry: () => void;
  removeEntry: (id: string) => void;
  isTranslating: boolean;
  onRetranslate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <BookOpen size={14} className="text-primary" /> Hindi-English Glossary
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Auto-populated when lyrics are loaded. Toggle &quot;English&quot; to
          view translated lyrics. Edit entries to fix bad translations.
        </p>
      </div>

      {/* Auto-translate status / button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRetranslate}
          disabled={isTranslating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {isTranslating ? (
            <><Loader2 size={12} className="animate-spin" /> Translating...</>
          ) : (
            <><Zap size={12} /> Re-translate All</>
          )}
        </button>
        <span className="text-[10px] text-muted-foreground">
          {dictionary.length} {dictionary.length === 1 ? "word" : "words"}
        </span>
      </div>

      {/* Entry list */}
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto hide-scrollbar">
        {dictionary.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-4">
            No entries yet. Add words below.
          </p>
        )}
        {dictionary.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/60 bg-secondary/30 text-[12px]"
          >
            <div className="flex items-center gap-2 font-mono min-w-0">
              <span className="text-primary font-semibold truncate">
                {entry.foreign}
              </span>
              <span className="text-muted-foreground shrink-0">=</span>
              <span className="text-foreground/80 truncate">
                {entry.english}
              </span>
            </div>
            <button
              onClick={() => removeEntry(entry.id)}
              className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add entry form */}
      <div className="space-y-2 border-t border-border/60 pt-3">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
          Add Mapping
        </span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={newForeign}
            onChange={(e) => setNewForeign(e.target.value)}
            placeholder="Hindi word"
            className="border border-border rounded-lg px-2.5 py-1.5 text-[12px] bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") addEntry();
            }}
          />
          <input
            type="text"
            value={newEnglish}
            onChange={(e) => setNewEnglish(e.target.value)}
            placeholder="English"
            className="border border-border rounded-lg px-2.5 py-1.5 text-[12px] bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") addEntry();
            }}
          />
        </div>
        <button
          onClick={addEntry}
          disabled={!newForeign.trim() || !newEnglish.trim()}
          className="w-full py-1.5 bg-primary text-primary-foreground text-[12px] font-medium rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// -- Meter Panel --

function MeterPanel({
  data,
}: {
  data: {
    origLine: string;
    parodyLine: string;
    origSyl: number;
    parodySyl: number;
    match: boolean;
  }[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <BarChart2 size={14} className="text-primary" /> Syllable Meter
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Compare syllable counts line-by-line. Green means your parody matches
          the original rhythm.
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
    <div className="flex-1 flex items-center justify-center p-4 md:p-8">
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
