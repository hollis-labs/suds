"use client";

import { useState } from "react";
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

export function AdminUsersInvites({ isAdmin }: { isAdmin: boolean }) {
  const [inviteCountInput, setInviteCountInput] = useState("5");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  const userList = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const inviteList = trpc.admin.listInvites.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const generateInvites = trpc.admin.generateInvites.useMutation({
    onSuccess: (data) => {
      setGeneratedCodes(data.codes);
      inviteList.refetch();
    },
  });

  function handleGenerate() {
    const num = parseInt(inviteCountInput, 10);
    if (isNaN(num) || num < 1 || num > 50) return;
    setGeneratedCodes([]);
    generateInvites.mutate({ count: num });
  }

  return (
    <div className="space-y-6">
      {/* Generate Invites */}
      <section>
        <h2 className="text-terminal-amber mb-2">=== GENERATE INVITES ===</h2>
        <div className="pl-2 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-terminal-dim text-sm">Count (1-50):</label>
            <input
              type="number"
              min={1}
              max={50}
              value={inviteCountInput}
              onChange={(e) => setInviteCountInput(e.target.value)}
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-20 text-sm focus:outline-none focus:border-terminal-green"
            />
            <button
              onClick={handleGenerate}
              disabled={generateInvites.isPending}
              className="text-terminal-green hover:text-terminal-green-bright text-sm border border-terminal-border px-3 py-1 hover:border-terminal-green transition-colors disabled:opacity-50"
            >
              [GENERATE]
            </button>
          </div>
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
        <h2 className="text-terminal-amber mb-2">
          === USERS ({userList.data?.length ?? 0}) ===
        </h2>
        {userList.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : userList.data && userList.data.length > 0 ? (
          <div className="space-y-1 pl-2">
            {userList.data.map((user, i) => (
              <p key={user.id} className="text-sm">
                <span className="text-terminal-dim">[{i + 1}]</span>{" "}
                <span className="text-terminal-green-bright">
                  {user.email ?? "no email"}
                </span>{" "}
                <span className="text-terminal-dim">--</span>{" "}
                {user.characterCount} character
                {user.characterCount !== 1 ? "s" : ""}{" "}
                <span className="text-terminal-dim">
                  -- joined {timeAgo(user.createdAt)}
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
        <h2 className="text-terminal-amber mb-2">
          === INVITES ({inviteList.data?.length ?? 0}) ===
        </h2>
        {inviteList.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
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
                <span className="text-terminal-dim">--</span>{" "}
                {invite.usedBy ? (
                  <span className="text-terminal-amber">
                    used {timeAgo(invite.usedAt)}
                  </span>
                ) : (
                  <span className="text-terminal-green">available</span>
                )}{" "}
                <span className="text-terminal-dim">
                  -- created {timeAgo(invite.createdAt)}
                </span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-terminal-dim pl-2">No invites found.</p>
        )}
      </section>
    </div>
  );
}
