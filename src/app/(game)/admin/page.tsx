"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Terminal } from "@/components/terminal";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminUsersInvites } from "@/components/admin/AdminUsersInvites";
import { AdminClasses } from "@/components/admin/AdminClasses";
import { AdminItems } from "@/components/admin/AdminItems";
import { AdminMonsters } from "@/components/admin/AdminMonsters";
import { AdminCharacters } from "@/components/admin/AdminCharacters";
import { AdminContentLibrary } from "@/components/admin/AdminContentLibrary";
import { AdminGameConfig } from "@/components/admin/AdminGameConfig";
import { AdminWorldData } from "@/components/admin/AdminWorldData";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "characters", label: "Characters" },
  { id: "classes", label: "Classes" },
  { id: "items", label: "Items" },
  { id: "monsters", label: "Monsters" },
  { id: "content", label: "Content" },
  { id: "world", label: "World" },
  { id: "config", label: "Config" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const adminCheck = trpc.admin.isAdmin.useQuery(undefined, {
    retry: false,
  });

  const isAdmin = adminCheck.data?.isAdmin === true;

  if (adminCheck.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Terminal title="ADMIN" className="w-full max-w-5xl">
          <p className="text-terminal-dim">Verifying access...</p>
        </Terminal>
      </div>
    );
  }

  if (adminCheck.isError || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Terminal title="ADMIN" className="w-full max-w-5xl">
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

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Terminal title="ADMIN CONSOLE" className="w-full max-w-5xl">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-terminal-amber text-lg font-bold">
              SUDS ADMIN CONSOLE
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
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex flex-wrap gap-1 border-b border-terminal-border pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                  activeTab === tab.id
                    ? "text-terminal-green border-b-2 border-terminal-green font-bold"
                    : "text-terminal-dim hover:text-terminal-green"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[400px]">
            {activeTab === "overview" && <AdminOverview isAdmin={isAdmin} />}
            {activeTab === "users" && <AdminUsersInvites isAdmin={isAdmin} />}
            {activeTab === "characters" && <AdminCharacters isAdmin={isAdmin} />}
            {activeTab === "classes" && <AdminClasses isAdmin={isAdmin} />}
            {activeTab === "items" && <AdminItems isAdmin={isAdmin} />}
            {activeTab === "monsters" && <AdminMonsters isAdmin={isAdmin} />}
            {activeTab === "content" && <AdminContentLibrary isAdmin={isAdmin} />}
            {activeTab === "world" && <AdminWorldData isAdmin={isAdmin} />}
            {activeTab === "config" && <AdminGameConfig isAdmin={isAdmin} />}
          </div>
        </div>
      </Terminal>
    </div>
  );
}
