/**
 * Song Parody Creator — Apple-style clean interface
 * System-following light/dark with toggle.
 */
import { ParodyEditor } from "@/components/ParodyEditor";
import { useTheme } from "@/contexts/ThemeContext";
import { Monitor, Moon, Sun } from "lucide-react";

export default function Home() {
  const { mode, cycle } = useTheme();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/60">
        <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
          Song Parody Creator
        </h1>
        <button
          onClick={cycle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title={`Theme: ${mode}`}
        >
          {mode === "system" && <Monitor size={14} />}
          {mode === "light" && <Sun size={14} />}
          {mode === "dark" && <Moon size={14} />}
          <span className="capitalize">{mode}</span>
        </button>
      </header>

      {/* Main editor area */}
      <main className="flex-1 overflow-hidden">
        <ParodyEditor />
      </main>
    </div>
  );
}
