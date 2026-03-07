"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Terminal, TerminalText } from "@/components/terminal";

const EVENT_ICONS: Record<string, string> = {
  move: ">",
  combat_start: "!",
  combat_victory: "*",
  combat_defeat: "X",
  combat_flee: "~",
  level_up: "^",
  item_loot: "+",
  item_buy: "$",
  item_sell: "$",
  search: "?",
  rest: "z",
  shrine: "o",
  npc_talk: '"',
  death: "X",
  respawn: "@",
};

const EVENT_COLORS: Record<string, string> = {
  move: "text-terminal-green-dim",
  combat_start: "text-terminal-red",
  combat_victory: "text-terminal-green-bright",
  combat_defeat: "text-terminal-red",
  combat_flee: "text-terminal-amber",
  level_up: "text-terminal-purple",
  item_loot: "text-terminal-amber",
  item_buy: "text-terminal-amber",
  item_sell: "text-terminal-amber",
  search: "text-terminal-green",
  rest: "text-terminal-cyan",
  shrine: "text-terminal-purple",
  npc_talk: "text-terminal-green",
  death: "text-terminal-red",
  respawn: "text-terminal-green-bright",
};

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityPage() {
  const router = useRouter();

  const adminCheck = trpc.admin.isAdmin.useQuery(undefined, { retry: false });
  const isAdmin = adminCheck.data?.isAdmin === true;

  const events = trpc.admin.getGameEvents.useQuery(
    { limit: 100 },
    { enabled: isAdmin, refetchInterval: 5000 }
  );

  const aiUsage = trpc.admin.getAIUsage.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") {
        e.preventDefault();
        router.push("/admin");
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (adminCheck.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Terminal title="ACTIVITY" className="w-full max-w-4xl">
          <TerminalText text="Verifying access..." animate />
        </Terminal>
      </div>
    );
  }

  if (adminCheck.isError || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Terminal title="ACTIVITY" className="w-full max-w-4xl">
          <div className="space-y-4">
            <p className="text-terminal-red text-lg font-bold terminal-glow">
              ACCESS DENIED
            </p>
            <button
              onClick={() => router.push("/")}
              className="text-terminal-green hover:text-terminal-green-bright underline"
            >
              Return to game
            </button>
          </div>
        </Terminal>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Terminal title="ACTIVITY MONITOR" className="w-full max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-terminal-amber text-lg font-bold">
                LIVE ACTIVITY
              </h1>
              <span className="flex items-center gap-1 text-xs text-terminal-green-dim">
                <span className="inline-block w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
                refreshing every 5s
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/admin")}
                className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
              >
                [Q] ADMIN
              </button>
              <button
                onClick={() => events.refetch()}
                className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
              >
                [REFRESH]
              </button>
            </div>
          </div>

          <div className="border-t border-terminal-border" />

          {/* AI Usage Summary */}
          {aiUsage.data && (
            <section>
              <h2 className="text-terminal-amber mb-2">=== AI USAGE & COST ===</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-2 text-sm">
                <div>
                  <span className="text-terminal-green">24h:</span>{" "}
                  <span className="text-terminal-green-bright">
                    {aiUsage.data.daily.calls}
                  </span>{" "}
                  calls,{" "}
                  <span className="text-terminal-dim">
                    {(aiUsage.data.daily.inputTokens + aiUsage.data.daily.outputTokens).toLocaleString()} tokens
                  </span>{" "}
                  <span className="text-terminal-amber">
                    ~${aiUsage.data.daily.estimatedCost.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-terminal-green">7d:</span>{" "}
                  <span className="text-terminal-green-bright">
                    {aiUsage.data.weekly.calls}
                  </span>{" "}
                  calls,{" "}
                  <span className="text-terminal-dim">
                    {(aiUsage.data.weekly.inputTokens + aiUsage.data.weekly.outputTokens).toLocaleString()} tokens
                  </span>{" "}
                  <span className="text-terminal-amber">
                    ~${aiUsage.data.weekly.estimatedCost.toFixed(4)}
                  </span>
                </div>
              </div>

              {aiUsage.data.recentCalls.length > 0 && (
                <div className="mt-2 pl-2">
                  <p className="text-terminal-green text-xs mb-1">RECENT AI CALLS:</p>
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {aiUsage.data.recentCalls.slice(0, 10).map((call) => (
                      <p key={call.id} className="text-xs">
                        <span className="text-terminal-dim">
                          {timeAgo(call.createdAt)}
                        </span>{" "}
                        <span className="text-terminal-green">
                          {call.feature}
                        </span>{" "}
                        <span className="text-terminal-dim">
                          {call.inputTokens}+{call.outputTokens} tok
                        </span>{" "}
                        <span className="text-terminal-dim">
                          {call.durationMs ? `${call.durationMs}ms` : ""}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="border-t border-terminal-border" />

          {/* Event Feed */}
          <section>
            <h2 className="text-terminal-amber mb-2">=== GAME EVENTS ===</h2>
            {events.isLoading ? (
              <p className="text-terminal-dim pl-2">Loading events...</p>
            ) : events.data && events.data.length > 0 ? (
              <div className="space-y-0.5 pl-2 max-h-[60vh] overflow-y-auto font-mono text-xs">
                {events.data.map((event) => {
                  const icon = EVENT_ICONS[event.type] ?? "·";
                  const color = EVENT_COLORS[event.type] ?? "text-terminal-green-dim";

                  return (
                    <div key={event.id} className="flex gap-2 items-baseline">
                      <span className="text-terminal-dim w-14 shrink-0 text-right">
                        {timeAgo(event.createdAt)}
                      </span>
                      <span className={`w-3 shrink-0 text-center ${color}`}>
                        {icon}
                      </span>
                      <span className="text-terminal-green-bright shrink-0">
                        {event.characterName}
                      </span>
                      <span className={color}>
                        {event.detail ?? event.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-terminal-dim pl-2">
                No game events yet. Play the game to generate activity!
              </p>
            )}
          </section>
        </div>
      </Terminal>
    </div>
  );
}
