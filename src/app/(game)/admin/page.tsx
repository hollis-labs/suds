"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Terminal,
  TerminalText,
  TerminalInput,
} from "@/components/terminal";

export default function AdminPage() {
  const router = useRouter();
  const [inviteCount, setInviteCount] = useState("");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  // Check admin status
  const adminCheck = trpc.admin.isAdmin.useQuery(undefined, {
    retry: false,
  });

  const isAdmin = adminCheck.data?.isAdmin === true;

  // Stats
  const stats = trpc.admin.getStats.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Users
  const userList = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Invites
  const inviteList = trpc.admin.listInvites.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Activity feed
  const activity = trpc.admin.getActivity.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Generate invites mutation
  const generateInvites = trpc.admin.generateInvites.useMutation({
    onSuccess: (data) => {
      setGeneratedCodes(data.codes);
      stats.refetch();
      inviteList.refetch();
    },
  });

  // Loading state
  if (adminCheck.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Terminal title="ADMIN" className="w-full max-w-3xl">
          <TerminalText text="Verifying access..." animate />
        </Terminal>
      </div>
    );
  }

  // Access denied
  if (adminCheck.isError || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Terminal title="ADMIN" className="w-full max-w-3xl">
          <div className="space-y-4">
            <p className="text-terminal-red text-lg font-bold terminal-glow">
              ACCESS DENIED
            </p>
            <p className="text-terminal-dim">
              You do not have admin privileges.
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

  function handleGenerateInvites(value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 50) return;
    setGeneratedCodes([]);
    generateInvites.mutate({ count: num });
  }

  function handleRefresh() {
    stats.refetch();
    userList.refetch();
    inviteList.refetch();
    activity.refetch();
  }

  function timeAgo(date: Date | null): string {
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

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Terminal title="ADMIN CONSOLE" className="w-full max-w-3xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-terminal-amber text-lg font-bold">
              SUDS v2 ADMIN CONSOLE
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/activity")}
                className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
              >
                [ACTIVITY]
              </button>
              <button
                onClick={() => router.push("/leaderboard")}
                className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
              >
                [LEADERBOARD]
              </button>
              <button
                onClick={handleRefresh}
                className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
              >
                [REFRESH]
              </button>
            </div>
          </div>

          <p className="text-terminal-dim text-xs">
            Auto-refreshes every 30 seconds
          </p>

          <div className="border-t border-terminal-border" />

          {/* System Stats */}
          <section>
            <h2 className="text-terminal-amber mb-2">=== SYSTEM STATS ===</h2>
            {stats.isLoading ? (
              <p className="text-terminal-dim">Loading stats...</p>
            ) : stats.data ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-2">
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
                  Rooms explored:{" "}
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

          {/* Activity Feed */}
          <section>
            <h2 className="text-terminal-amber mb-2">=== ACTIVITY FEED ===</h2>
            {activity.isLoading ? (
              <p className="text-terminal-dim pl-2">Loading activity...</p>
            ) : activity.data ? (
              <div className="space-y-4 pl-2">
                {/* Recent Signups */}
                <div>
                  <h3 className="text-terminal-green mb-1 text-sm font-bold">
                    RECENT SIGNUPS
                  </h3>
                  {activity.data.recentSignups.length > 0 ? (
                    <div className="space-y-0.5 pl-2">
                      {activity.data.recentSignups.map((user) => (
                        <p key={user.id} className="text-sm">
                          <span className="text-terminal-green-bright">
                            {user.email ?? user.name ?? "unknown"}
                          </span>{" "}
                          <span className="text-terminal-dim">
                            — {timeAgo(user.createdAt)}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-terminal-dim text-sm pl-2">
                      No signups yet.
                    </p>
                  )}
                </div>

                {/* Recent Characters */}
                <div>
                  <h3 className="text-terminal-green mb-1 text-sm font-bold">
                    RECENT CHARACTERS
                  </h3>
                  {activity.data.recentCharacters.length > 0 ? (
                    <div className="space-y-0.5 pl-2">
                      {activity.data.recentCharacters.map((char) => (
                        <p key={char.id} className="text-sm">
                          <span className="text-terminal-green-bright">
                            {char.name}
                          </span>{" "}
                          <span className="text-terminal-dim">—</span>{" "}
                          <span className="text-terminal-amber">
                            Lvl {char.level} {char.class}
                          </span>{" "}
                          <span className="text-terminal-dim">
                            ({char.theme}) — {timeAgo(char.createdAt)}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-terminal-dim text-sm pl-2">
                      No characters yet.
                    </p>
                  )}
                </div>

                {/* Top Characters */}
                <div>
                  <h3 className="text-terminal-green mb-1 text-sm font-bold">
                    TOP CHARACTERS
                  </h3>
                  {activity.data.topCharacters.length > 0 ? (
                    <div className="space-y-0.5 pl-2">
                      {activity.data.topCharacters.map((char, i) => (
                        <p key={char.id} className="text-sm">
                          <span className="text-terminal-amber">
                            #{i + 1}
                          </span>{" "}
                          <span className="text-terminal-green-bright">
                            {char.name}
                          </span>{" "}
                          <span className="text-terminal-dim">—</span>{" "}
                          Lvl {char.level} {char.class}{" "}
                          <span className="text-terminal-dim">
                            ({char.theme})
                          </span>{" "}
                          <span className="text-terminal-amber">
                            {char.gold}g
                          </span>{" "}
                          <span className="text-terminal-dim">
                            {char.xp} XP
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-terminal-dim text-sm pl-2">
                      No characters yet.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <div className="border-t border-terminal-border" />

          {/* Generate Invites */}
          <section>
            <h2 className="text-terminal-amber mb-2">
              === GENERATE INVITES ===
            </h2>
            <div className="pl-2 space-y-2">
              <p className="text-terminal-dim text-sm">
                Enter count (1-50):
              </p>
              <TerminalInput
                prompt="count >"
                onSubmit={handleGenerateInvites}
                placeholder="5"
                disabled={generateInvites.isPending}
              />
              {generateInvites.isPending && (
                <p className="text-terminal-dim">Generating...</p>
              )}
              {generatedCodes.length > 0 && (
                <div className="mt-2">
                  <p className="text-terminal-green mb-1">Generated codes:</p>
                  <div className="pl-2 space-y-0.5">
                    {generatedCodes.map((code) => (
                      <p
                        key={code}
                        className="text-terminal-green-bright font-bold tracking-wider"
                      >
                        {code}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {generateInvites.isError && (
                <p className="text-terminal-red">
                  Error: {generateInvites.error.message}
                </p>
              )}
            </div>
          </section>

          <div className="border-t border-terminal-border" />

          {/* Users */}
          <section>
            <h2 className="text-terminal-amber mb-2">=== USERS ===</h2>
            {userList.isLoading ? (
              <p className="text-terminal-dim pl-2">Loading users...</p>
            ) : userList.data && userList.data.length > 0 ? (
              <div className="space-y-1 pl-2">
                {userList.data.map((user, i) => (
                  <p key={user.id} className="text-sm">
                    <span className="text-terminal-dim">[{i + 1}]</span>{" "}
                    <span className="text-terminal-green-bright">
                      {user.email ?? "no email"}
                    </span>{" "}
                    <span className="text-terminal-dim">—</span>{" "}
                    {user.characterCount} character
                    {user.characterCount !== 1 ? "s" : ""}{" "}
                    <span className="text-terminal-dim">—</span>{" "}
                    <span className="text-terminal-dim">
                      joined {timeAgo(user.createdAt)}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-terminal-dim pl-2">No users found.</p>
            )}
          </section>

          <div className="border-t border-terminal-border" />

          {/* Invites */}
          <section>
            <h2 className="text-terminal-amber mb-2">=== INVITES ===</h2>
            {inviteList.isLoading ? (
              <p className="text-terminal-dim pl-2">Loading invites...</p>
            ) : inviteList.data && inviteList.data.length > 0 ? (
              <div className="space-y-1 pl-2">
                {inviteList.data.map((invite) => (
                  <p key={invite.id} className="text-sm">
                    <span
                      className={
                        invite.usedBy
                          ? "text-terminal-dim line-through"
                          : "text-terminal-green-bright tracking-wider"
                      }
                    >
                      {invite.code}
                    </span>{" "}
                    <span className="text-terminal-dim">—</span>{" "}
                    {invite.usedBy ? (
                      <span className="text-terminal-amber">
                        used {timeAgo(invite.usedAt)}
                      </span>
                    ) : (
                      <span className="text-terminal-green">available</span>
                    )}{" "}
                    <span className="text-terminal-dim">
                      — created {timeAgo(invite.createdAt)}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-terminal-dim pl-2">No invites found.</p>
            )}
          </section>
        </div>
      </Terminal>
    </div>
  );
}
