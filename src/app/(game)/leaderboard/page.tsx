"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Terminal, TerminalText } from "@/components/terminal";

type LeaderboardEntry = {
  name: string;
  level: number;
  class: string;
  theme: string;
  gold: number;
  xp: number;
};

function useLeaderboardSSE() {
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/leaderboard");
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as LeaderboardEntry[];
        setData(parsed);
        setIsConnected(true);
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { data, isLoading: data === null, isConnected };
}

export default function LeaderboardPage() {
  const router = useRouter();

  const { data: leaderboard, isLoading, isConnected } = useLeaderboardSSE();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") {
        e.preventDefault();
        router.push("/characters");
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Terminal title="LEADERBOARD" className="w-full max-w-2xl">
          <TerminalText
            text="Loading hall of fame..."
            className="text-terminal-green-dim"
          />
        </Terminal>
      </div>
    );
  }

  const entries = leaderboard ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Terminal title="LEADERBOARD" className="w-full max-w-2xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-terminal-amber text-lg font-bold">
                HALL OF FAME — TOP ADVENTURERS
              </h1>
              {isConnected && (
                <span className="flex items-center gap-1 text-xs text-terminal-green">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <button
              onClick={() => router.push("/characters")}
              className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
            >
              [Q] BACK
            </button>
          </div>

          <div className="border-t border-terminal-border" />

          {entries.length === 0 ? (
            <p className="text-terminal-dim">
              No adventurers have entered the dungeon yet.
            </p>
          ) : (
            <div className="font-mono">
              {/* Table header */}
              <div className="grid grid-cols-[3rem_1fr_3.5rem_8rem_7rem_4.5rem] gap-x-2 text-terminal-amber text-sm border-b border-terminal-border pb-1 mb-1">
                <span>RANK</span>
                <span>NAME</span>
                <span>LVL</span>
                <span>CLASS</span>
                <span>THEME</span>
                <span className="text-right">GOLD</span>
              </div>

              {/* Table rows */}
              <div className="space-y-0.5">
                {entries.map((char, i) => {
                  const rank = i + 1;
                  const rankColor =
                    rank === 1
                      ? "text-terminal-amber font-bold"
                      : rank <= 3
                        ? "text-terminal-amber"
                        : "text-terminal-dim";

                  return (
                    <div
                      key={`${char.name}-${i}`}
                      className="grid grid-cols-[3rem_1fr_3.5rem_8rem_7rem_4.5rem] gap-x-2 text-sm hover:bg-terminal-green/5 px-0 py-0.5 transition-colors"
                    >
                      <span className={rankColor}>
                        {rank <= 3 ? `#${rank}` : ` ${rank}.`}
                      </span>
                      <span className="text-terminal-green-bright truncate">
                        {char.name}
                      </span>
                      <span className="text-terminal-green">
                        {char.level}
                      </span>
                      <span className="text-terminal-green-dim truncate">
                        {char.class}
                      </span>
                      <span className="text-terminal-dim truncate">
                        {char.theme}
                      </span>
                      <span className="text-terminal-amber text-right">
                        {char.gold.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-terminal-border" />

          <p className="text-terminal-dim text-xs">
            Ranked by level, then XP. Live updates every 10 seconds. Press{" "}
            <span className="text-terminal-amber">[Q]</span> or{" "}
            <span className="text-terminal-amber">[Esc]</span> to return.
          </p>
        </div>
      </Terminal>
    </div>
  );
}
