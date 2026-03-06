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

  // Stats
  const stats = trpc.admin.getStats.useQuery(undefined, {
    enabled: adminCheck.data?.isAdmin === true,
  });

  // Users
  const userList = trpc.admin.listUsers.useQuery(undefined, {
    enabled: adminCheck.data?.isAdmin === true,
  });

  // Invites
  const inviteList = trpc.admin.listInvites.useQuery(undefined, {
    enabled: adminCheck.data?.isAdmin === true,
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
  if (adminCheck.isError || !adminCheck.data?.isAdmin) {
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
            <button
              onClick={handleRefresh}
              className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-2 py-0.5 hover:border-terminal-green transition-colors"
            >
              [REFRESH]
            </button>
          </div>

          <div className="border-t border-terminal-border" />

          {/* System Stats */}
          <section>
            <h2 className="text-terminal-amber mb-2">=== SYSTEM STATS ===</h2>
            {stats.isLoading ? (
              <p className="text-terminal-dim">Loading stats...</p>
            ) : stats.data ? (
              <div className="space-y-1 pl-2">
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
