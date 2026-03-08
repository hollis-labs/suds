"use client";

import { trpc } from "@/lib/trpc";

function timeAgo(date: Date | null | undefined): string {
  if (!date) return "unknown";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AdminOverview({ isAdmin }: { isAdmin: boolean }) {
  const stats = trpc.admin.getStats.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const activity = trpc.admin.getActivity.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      {/* System Stats */}
      <section>
        <h2 className="text-terminal-amber mb-2">=== SYSTEM STATS ===</h2>
        {stats.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : stats.data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 pl-2">
            <p>
              Users:{" "}
              <span className="text-terminal-green-bright">
                {stats.data.totalUsers.toLocaleString()}
              </span>
            </p>
            <p>
              Characters:{" "}
              <span className="text-terminal-green-bright">
                {stats.data.totalCharacters.toLocaleString()}
              </span>
            </p>
            <p>
              Rooms:{" "}
              <span className="text-terminal-green-bright">
                {stats.data.totalRooms.toLocaleString()}
              </span>
            </p>
            <p>
              Invites:{" "}
              <span className="text-terminal-green-bright">
                {stats.data.totalInvites}
              </span>{" "}
              total,{" "}
              <span className="text-terminal-amber">
                {stats.data.usedInvites}
              </span>{" "}
              used
            </p>
            {activity.data && (
              <p>
                Active (24h):{" "}
                <span className="text-terminal-green-bright">
                  {activity.data.activePlayers}
                </span>{" "}
                players
              </p>
            )}
          </div>
        ) : null}
      </section>

      <div className="border-t border-terminal-border" />

      {/* Recent Signups */}
      <section>
        <h2 className="text-terminal-amber mb-2">=== RECENT SIGNUPS ===</h2>
        {activity.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : activity.data?.recentSignups.length ? (
          <div className="space-y-0.5 pl-2">
            {activity.data.recentSignups.map((user) => (
              <p key={user.id} className="text-sm">
                <span className="text-terminal-green-bright">
                  {user.email ?? user.name ?? "unknown"}
                </span>{" "}
                <span className="text-terminal-dim">
                  -- {timeAgo(user.createdAt)}
                </span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-terminal-dim pl-2 text-sm">No signups yet.</p>
        )}
      </section>

      <div className="border-t border-terminal-border" />

      {/* Recent Characters */}
      <section>
        <h2 className="text-terminal-amber mb-2">=== RECENT CHARACTERS ===</h2>
        {activity.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : activity.data?.recentCharacters.length ? (
          <div className="space-y-0.5 pl-2">
            {activity.data.recentCharacters.map((char) => (
              <p key={char.id} className="text-sm">
                <span className="text-terminal-green-bright">{char.name}</span>{" "}
                <span className="text-terminal-dim">--</span>{" "}
                <span className="text-terminal-amber">
                  Lvl {char.level} {char.class}
                </span>{" "}
                <span className="text-terminal-dim">
                  ({char.theme}) -- {timeAgo(char.createdAt)}
                </span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-terminal-dim pl-2 text-sm">No characters yet.</p>
        )}
      </section>

      <div className="border-t border-terminal-border" />

      {/* Top Characters */}
      <section>
        <h2 className="text-terminal-amber mb-2">=== TOP 5 CHARACTERS ===</h2>
        {activity.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : activity.data?.topCharacters.length ? (
          <div className="space-y-0.5 pl-2">
            {activity.data.topCharacters.map((char, i) => (
              <p key={char.id} className="text-sm">
                <span className="text-terminal-amber">#{i + 1}</span>{" "}
                <span className="text-terminal-green-bright">{char.name}</span>{" "}
                <span className="text-terminal-dim">--</span> Lvl {char.level}{" "}
                {char.class}{" "}
                <span className="text-terminal-dim">({char.theme})</span>{" "}
                <span className="text-terminal-amber">{char.gold}g</span>{" "}
                <span className="text-terminal-dim">{char.xp} XP</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-terminal-dim pl-2 text-sm">No characters yet.</p>
        )}
      </section>
    </div>
  );
}
