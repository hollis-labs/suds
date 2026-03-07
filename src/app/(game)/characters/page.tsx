"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Terminal, TerminalText } from "@/components/terminal";
import { cn } from "@/lib/utils";
import { CLASS_DEFINITIONS, THEMES } from "@/lib/constants";
import type { CharacterClass, Theme } from "@/lib/constants";
import { trpc } from "@/lib/trpc";

function formatLastPlayed(date: Date | null): string {
  if (!date) return "New";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "New";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export default function CharactersPage() {
  const router = useRouter();

  const { data: characters, isLoading } = trpc.character.list.useQuery();

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/play/${id}`);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === "n") {
        e.preventDefault();
        router.push("/characters/new");
        return;
      }

      if (key === "d") {
        e.preventDefault();
        // TODO: Delete flow with confirmation modal
        return;
      }

      if (key === "l") {
        e.preventDefault();
        router.push("/login");
        return;
      }

      if (key === "h") {
        e.preventDefault();
        router.push("/leaderboard");
        return;
      }

      if (!characters) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= characters.length) {
        e.preventDefault();
        handleSelect(characters[num - 1].id);
      }
    },
    [router, characters, handleSelect]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Terminal title="CHARACTER ROSTER" className="w-full max-w-2xl">
          <TerminalText text="Loading personnel files..." className="text-terminal-green-dim" />
        </Terminal>
      </div>
    );
  }

  const chars = characters ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Terminal title="CHARACTER ROSTER" className="w-full max-w-2xl">
        <div className="space-y-6">
          {/* Leaderboard Banner */}
          <button
            onClick={() => router.push("/leaderboard")}
            className="group w-full border border-terminal-amber/30 hover:border-terminal-amber/60 bg-terminal-amber/5 hover:bg-terminal-amber/10 px-4 py-2 transition-all duration-300 flex items-center justify-center gap-3"
          >
            <span className="text-terminal-amber/60 group-hover:text-terminal-amber transition-colors text-xs tracking-widest">
              {">>>"}
            </span>
            <span className="text-terminal-amber font-bold text-sm tracking-wider animate-pulse">
              HALL OF FAME
            </span>
            <span className="text-terminal-amber/40 group-hover:text-terminal-amber/80 transition-colors text-xs">
              See who tops the leaderboard
            </span>
            <span className="text-terminal-amber/60 group-hover:text-terminal-amber transition-colors text-xs tracking-widest">
              {"<<<"}
            </span>
          </button>

          <h1 className="text-lg text-terminal-green terminal-glow font-bold">
            CHARACTER ROSTER
          </h1>

          {chars.length === 0 ? (
            <TerminalText
              text="No adventurers found. Create one to begin."
              speed={25}
              className="text-terminal-green-dim text-sm"
            />
          ) : (
            <div className="space-y-1 font-mono">
              {chars.map((char, index) => {
                const classDef = CLASS_DEFINITIONS[char.class as CharacterClass];
                const themeDef = THEMES[char.theme as Theme];
                const lastPlayed = formatLastPlayed(char.createdAt);

                return (
                  <button
                    key={char.id}
                    onClick={() => handleSelect(char.id)}
                    className={cn(
                      "w-full text-left px-2 py-1 transition-colors",
                      "text-terminal-green-dim hover:text-terminal-green hover:terminal-glow hover:bg-terminal-green/5"
                    )}
                  >
                    <span className="text-terminal-green">[{index + 1}]</span>{" "}
                    <span className="text-terminal-green font-bold">{char.name}</span>
                    {" — "}
                    <span className="text-terminal-green-dim">
                      Level {char.level} {classDef?.name ?? char.class}
                    </span>{" "}
                    <span className="text-terminal-amber">({themeDef?.name ?? char.theme})</span>
                    {" — "}
                    <span className="text-terminal-green-dim text-xs">{lastPlayed}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-terminal-border pt-4 space-y-1 font-mono text-sm">
            <button
              onClick={() => router.push("/characters/new")}
              className="block w-full text-left px-2 py-0.5 text-terminal-green-dim hover:text-terminal-green hover:terminal-glow transition-colors"
            >
              <span className="text-terminal-amber">[N]</span> New Character
            </button>
            <button
              onClick={() => {
                /* TODO: Delete flow */
              }}
              className="block w-full text-left px-2 py-0.5 text-terminal-green-dim hover:text-terminal-green hover:terminal-glow transition-colors"
            >
              <span className="text-terminal-amber">[D]</span> Delete Character
            </button>
            <button
              onClick={() => router.push("/leaderboard")}
              className="block w-full text-left px-2 py-0.5 text-terminal-green-dim hover:text-terminal-green hover:terminal-glow transition-colors"
            >
              <span className="text-terminal-amber">[H]</span> Hall of Fame
            </button>
            <button
              onClick={() => router.push("/login")}
              className="block w-full text-left px-2 py-0.5 text-terminal-green-dim hover:text-terminal-green hover:terminal-glow transition-colors"
            >
              <span className="text-terminal-amber">[L]</span> Logout
            </button>
          </div>
        </div>
      </Terminal>
    </div>
  );
}
