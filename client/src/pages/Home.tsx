/**
 * Song Parody Creator — Studio Console Design
 * Dark DAW-inspired interface with split panel layout.
 * Left: Original lyrics (paste). Right: Editable parody with word-level linking.
 * Cyan connection lines on hover, amber highlights on modified words.
 */
import { ParodyEditor } from "@/components/ParodyEditor";

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header strip */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          <h1 className="text-sm font-semibold font-mono tracking-wide uppercase text-foreground">
            Song Parody Creator
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-muted-foreground">
            Paste original on left, edit parody on right
          </span>
        </div>
      </header>

      {/* Main editor area */}
      <main className="flex-1 overflow-hidden">
        <ParodyEditor />
      </main>
    </div>
  );
}
