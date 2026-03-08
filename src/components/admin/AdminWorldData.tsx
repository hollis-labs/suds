"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const LORE_SOURCES = ["room", "npc", "item", "search", "combat"];
const QUEST_STATUSES = ["available", "active", "completed", "failed"];

type SubTab = "lore" | "rooms" | "npcs" | "stores" | "quests";

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

function jsonPreview(data: unknown): string {
  if (data == null) return "—";
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return str.length > 80 ? str.slice(0, 80) + "..." : str;
}

function jsonFull(data: unknown): string {
  if (data == null) return "—";
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

export function AdminWorldData({ isAdmin }: { isAdmin: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>("lore");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [characterFilter, setCharacterFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 50;

  const countsQuery = trpc.admin.getWorldDataCounts.useQuery(undefined, {
    enabled: isAdmin,
  });
  const charNamesQuery = trpc.admin.getCharacterNames.useQuery(undefined, {
    enabled: isAdmin,
  });

  const counts = countsQuery.data ?? { lore: 0, rooms: 0, npcs: 0, stores: 0, quests: 0 };
  const charNames = charNamesQuery.data ?? [];

  function resetFilters() {
    setSearch("");
    setPage(0);
    setCharacterFilter("");
    setSourceFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setExpandedId(null);
  }

  function switchTab(tab: SubTab) {
    setSubTab(tab);
    resetFilters();
  }

  const SUB_TABS: { id: SubTab; label: string; count: number }[] = [
    { id: "lore", label: "Lore", count: counts.lore },
    { id: "rooms", label: "Rooms", count: counts.rooms },
    { id: "npcs", label: "NPCs", count: counts.npcs },
    { id: "stores", label: "Stores", count: counts.stores },
    { id: "quests", label: "Quests", count: counts.quests },
  ];

  const totalCount = counts.lore + counts.rooms + counts.npcs + counts.stores + counts.quests;

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-terminal-amber mb-2">=== WORLD DATA ===</h2>
        <p className="text-terminal-dim text-xs pl-2 mb-3">
          AI-generated game content across all characters.{" "}
          <span className="text-terminal-green-bright">{totalCount}</span> total entries.
        </p>
      </section>

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-terminal-border pb-2 pl-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
              subTab === tab.id
                ? "text-terminal-green border-b-2 border-terminal-green font-bold"
                : "text-terminal-dim hover:text-terminal-green"
            }`}
          >
            {tab.label}{" "}
            <span className="text-terminal-dim">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Shared filters */}
      <div className="pl-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <label className="text-terminal-dim text-xs">Search:</label>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search name/title..."
            className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-48 text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-terminal-dim text-xs">Character:</label>
          <select
            value={characterFilter}
            onChange={(e) => { setCharacterFilter(e.target.value); setPage(0); }}
            className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
          >
            <option value="">All</option>
            {charNames.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.className})
              </option>
            ))}
          </select>
        </div>

        {subTab === "lore" && (
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Source:</label>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
            >
              <option value="">All</option>
              {LORE_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {subTab === "rooms" && (
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Type:</label>
            <input
              type="text"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              placeholder="e.g. dungeon"
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-28 text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
            />
          </div>
        )}

        {subTab === "quests" && (
          <>
            <div className="flex items-center gap-1">
              <label className="text-terminal-dim text-xs">Type:</label>
              <input
                type="text"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
                placeholder="e.g. fetch"
                className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-28 text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-terminal-dim text-xs">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
              >
                <option value="">All</option>
                {QUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Sub-tab content */}
      {subTab === "lore" && (
        <LoreTable
          search={search}
          sourceFilter={sourceFilter}
          characterFilter={characterFilter}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          isAdmin={isAdmin}
        />
      )}
      {subTab === "rooms" && (
        <RoomsTable
          search={search}
          typeFilter={typeFilter}
          characterFilter={characterFilter}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          isAdmin={isAdmin}
        />
      )}
      {subTab === "npcs" && (
        <NpcsTable
          search={search}
          characterFilter={characterFilter}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          isAdmin={isAdmin}
        />
      )}
      {subTab === "stores" && (
        <StoresTable
          search={search}
          characterFilter={characterFilter}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          isAdmin={isAdmin}
        />
      )}
      {subTab === "quests" && (
        <QuestsTable
          search={search}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          characterFilter={characterFilter}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ─── Shared pagination component ─────────────────────────────────────────────

function Pagination({
  page,
  setPage,
  totalPages,
  total,
  shown,
}: {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  total: number;
  shown: number;
}) {
  return (
    <div className="pl-2 mt-3 flex items-center gap-3 text-xs">
      <span className="text-terminal-dim">
        Showing {shown} of {total}
      </span>
      {totalPages > 1 && (
        <>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-terminal-green hover:text-terminal-green-bright disabled:text-terminal-dim border border-terminal-border px-2 py-0.5"
          >
            [PREV]
          </button>
          <span className="text-terminal-dim">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="text-terminal-green hover:text-terminal-green-bright disabled:text-terminal-dim border border-terminal-border px-2 py-0.5"
          >
            [NEXT]
          </button>
        </>
      )}
    </div>
  );
}

// ─── Lore Table ──────────────────────────────────────────────────────────────

function LoreTable({
  search,
  sourceFilter,
  characterFilter,
  page,
  setPage,
  pageSize,
  expandedId,
  setExpandedId,
  isAdmin,
}: {
  search: string;
  sourceFilter: string;
  characterFilter: string;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  isAdmin: boolean;
}) {
  const query = trpc.admin.getWorldLore.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      sourceFilter: sourceFilter || undefined,
      characterFilter: characterFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (query.isLoading) return <p className="text-terminal-dim pl-2">Loading...</p>;

  return (
    <>
      <div className="pl-2 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-2">Title</th>
              <th className="text-left py-1 pr-2">Source</th>
              <th className="text-left py-1 pr-2">Character</th>
              <th className="text-left py-1 pr-2">Discovered</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <td className="py-1 pr-2 text-terminal-green-bright">{entry.title}</td>
                <td className="py-1 pr-2 text-terminal-amber">{entry.source}</td>
                <td className="py-1 pr-2 text-terminal-dim">{entry.characterName ?? "—"}</td>
                <td className="py-1 pr-2 text-terminal-dim">{timeAgo(entry.discoveredAt)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-terminal-dim">No lore entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (() => {
        const entry = entries.find((e) => e.id === expandedId);
        if (!entry) return null;
        return (
          <div className="pl-2 border border-terminal-border p-3 mx-2">
            <p className="text-terminal-amber text-xs mb-1">LORE CONTENT</p>
            <div className="text-xs space-y-1 mb-2">
              <p><span className="text-terminal-dim">Source ID: </span>{entry.sourceId ?? "—"}</p>
            </div>
            <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">
              {entry.content}
            </pre>
          </div>
        );
      })()}

      <Pagination page={page} setPage={setPage} totalPages={totalPages} total={total} shown={entries.length} />
    </>
  );
}

// ─── Rooms Table ─────────────────────────────────────────────────────────────

function RoomsTable({
  search,
  typeFilter,
  characterFilter,
  page,
  setPage,
  pageSize,
  expandedId,
  setExpandedId,
  isAdmin,
}: {
  search: string;
  typeFilter: string;
  characterFilter: string;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  isAdmin: boolean;
}) {
  const query = trpc.admin.getWorldRooms.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      typeFilter: typeFilter || undefined,
      characterFilter: characterFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (query.isLoading) return <p className="text-terminal-dim pl-2">Loading...</p>;

  return (
    <>
      <div className="pl-2 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-2">Name</th>
              <th className="text-left py-1 pr-2">Type</th>
              <th className="text-left py-1 pr-2">Coords</th>
              <th className="text-left py-1 pr-2">Depth</th>
              <th className="text-left py-1 pr-2">Character</th>
              <th className="text-left py-1 pr-2">Enc</th>
              <th className="text-left py-1 pr-2">Visited</th>
              <th className="text-left py-1 pr-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <td className="py-1 pr-2 text-terminal-green-bright">{entry.name}</td>
                <td className="py-1 pr-2 text-terminal-amber">{entry.type}</td>
                <td className="py-1 pr-2">({entry.x},{entry.y})</td>
                <td className="py-1 pr-2">{entry.depth}</td>
                <td className="py-1 pr-2 text-terminal-dim">{entry.characterName ?? "—"}</td>
                <td className="py-1 pr-2">{entry.hasEncounter ? "Y" : "—"}</td>
                <td className="py-1 pr-2">{entry.visited ? "Y" : "—"}</td>
                <td className="py-1 pr-2 text-terminal-dim">{timeAgo(entry.createdAt)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} className="py-2 text-terminal-dim">No rooms found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (() => {
        const entry = entries.find((e) => e.id === expandedId);
        if (!entry) return null;
        return (
          <div className="pl-2 border border-terminal-border p-3 mx-2 space-y-2">
            <p className="text-terminal-amber text-xs">ROOM DETAILS</p>
            <div className="text-xs space-y-1">
              <p><span className="text-terminal-dim">Exits: </span>{entry.exits.join(", ") || "none"}</p>
            </div>
            <div>
              <p className="text-terminal-dim text-xs mb-1">Description:</p>
              <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                {entry.description}
              </pre>
            </div>
            {entry.roomFeatures != null && Object.keys(entry.roomFeatures as object).length > 0 && (
              <div>
                <p className="text-terminal-dim text-xs mb-1">Room Features:</p>
                <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                  {jsonFull(entry.roomFeatures)}
                </pre>
              </div>
            )}
            {entry.encounterData != null && (
              <div>
                <p className="text-terminal-dim text-xs mb-1">Encounter Data:</p>
                <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                  {jsonFull(entry.encounterData)}
                </pre>
              </div>
            )}
            {entry.lootData != null && (
              <div>
                <p className="text-terminal-dim text-xs mb-1">Loot Data:</p>
                <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                  {jsonFull(entry.lootData)}
                </pre>
              </div>
            )}
          </div>
        );
      })()}

      <Pagination page={page} setPage={setPage} totalPages={totalPages} total={total} shown={entries.length} />
    </>
  );
}

// ─── NPCs Table ──────────────────────────────────────────────────────────────

function NpcsTable({
  search,
  characterFilter,
  page,
  setPage,
  pageSize,
  expandedId,
  setExpandedId,
  isAdmin,
}: {
  search: string;
  characterFilter: string;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  isAdmin: boolean;
}) {
  const query = trpc.admin.getWorldNpcs.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      characterFilter: characterFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (query.isLoading) return <p className="text-terminal-dim pl-2">Loading...</p>;

  return (
    <>
      <div className="pl-2 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-2">Name</th>
              <th className="text-left py-1 pr-2">Location</th>
              <th className="text-left py-1 pr-2">Character</th>
              <th className="text-left py-1 pr-2">Quest?</th>
              <th className="text-left py-1 pr-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <td className="py-1 pr-2 text-terminal-green-bright">{entry.name}</td>
                <td className="py-1 pr-2">({entry.roomX},{entry.roomY})</td>
                <td className="py-1 pr-2 text-terminal-dim">{entry.characterName ?? "—"}</td>
                <td className="py-1 pr-2">{entry.questId ? "Y" : "—"}</td>
                <td className="py-1 pr-2 text-terminal-dim">{timeAgo(entry.createdAt)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-terminal-dim">No NPCs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (() => {
        const entry = entries.find((e) => e.id === expandedId);
        if (!entry) return null;
        return (
          <div className="pl-2 border border-terminal-border p-3 mx-2 space-y-2">
            <p className="text-terminal-amber text-xs">NPC DETAILS</p>
            {entry.description && (
              <div>
                <p className="text-terminal-dim text-xs mb-1">Description:</p>
                <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                  {entry.description}
                </pre>
              </div>
            )}
            <div>
              <p className="text-terminal-dim text-xs mb-1">Dialogue:</p>
              <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">
                {jsonFull(entry.dialogue)}
              </pre>
            </div>
            {entry.questId && (
              <p className="text-xs">
                <span className="text-terminal-dim">Quest ID: </span>
                <span className="text-terminal-amber">{entry.questId}</span>
              </p>
            )}
          </div>
        );
      })()}

      <Pagination page={page} setPage={setPage} totalPages={totalPages} total={total} shown={entries.length} />
    </>
  );
}

// ─── Stores Table ────────────────────────────────────────────────────────────

function StoresTable({
  search,
  characterFilter,
  page,
  setPage,
  pageSize,
  expandedId,
  setExpandedId,
  isAdmin,
}: {
  search: string;
  characterFilter: string;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  isAdmin: boolean;
}) {
  const query = trpc.admin.getWorldStores.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      characterFilter: characterFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (query.isLoading) return <p className="text-terminal-dim pl-2">Loading...</p>;

  function inventoryCount(inv: unknown): number {
    if (Array.isArray(inv)) return inv.length;
    if (inv && typeof inv === "object") return Object.keys(inv).length;
    return 0;
  }

  return (
    <>
      <div className="pl-2 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-2">Name</th>
              <th className="text-left py-1 pr-2">Location</th>
              <th className="text-left py-1 pr-2">Character</th>
              <th className="text-left py-1 pr-2">Items</th>
              <th className="text-left py-1 pr-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <td className="py-1 pr-2 text-terminal-green-bright">{entry.name}</td>
                <td className="py-1 pr-2">({entry.roomX},{entry.roomY})</td>
                <td className="py-1 pr-2 text-terminal-dim">{entry.characterName ?? "—"}</td>
                <td className="py-1 pr-2">{inventoryCount(entry.inventory)}</td>
                <td className="py-1 pr-2 text-terminal-dim">{timeAgo(entry.createdAt)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-terminal-dim">No stores found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (() => {
        const entry = entries.find((e) => e.id === expandedId);
        if (!entry) return null;
        return (
          <div className="pl-2 border border-terminal-border p-3 mx-2 space-y-2">
            <p className="text-terminal-amber text-xs">STORE INVENTORY</p>
            <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">
              {jsonFull(entry.inventory)}
            </pre>
          </div>
        );
      })()}

      <Pagination page={page} setPage={setPage} totalPages={totalPages} total={total} shown={entries.length} />
    </>
  );
}

// ─── Quests Table ────────────────────────────────────────────────────────────

function QuestsTable({
  search,
  typeFilter,
  statusFilter,
  characterFilter,
  page,
  setPage,
  pageSize,
  expandedId,
  setExpandedId,
  isAdmin,
}: {
  search: string;
  typeFilter: string;
  statusFilter: string;
  characterFilter: string;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  isAdmin: boolean;
}) {
  const query = trpc.admin.getWorldQuests.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      typeFilter: typeFilter || undefined,
      statusFilter: statusFilter || undefined,
      characterFilter: characterFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (query.isLoading) return <p className="text-terminal-dim pl-2">Loading...</p>;

  const statusColor: Record<string, string> = {
    available: "text-terminal-blue",
    active: "text-terminal-green-bright",
    completed: "text-terminal-amber",
    failed: "text-terminal-red",
  };

  return (
    <>
      <div className="pl-2 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-2">Title</th>
              <th className="text-left py-1 pr-2">Type</th>
              <th className="text-left py-1 pr-2">Status</th>
              <th className="text-left py-1 pr-2">Character</th>
              <th className="text-left py-1 pr-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <td className="py-1 pr-2 text-terminal-green-bright">{entry.title}</td>
                <td className="py-1 pr-2 text-terminal-amber">{entry.type}</td>
                <td className={`py-1 pr-2 ${statusColor[entry.status] ?? "text-terminal-dim"}`}>
                  {entry.status}
                </td>
                <td className="py-1 pr-2 text-terminal-dim">{entry.characterName ?? "—"}</td>
                <td className="py-1 pr-2 text-terminal-dim">{timeAgo(entry.createdAt)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-terminal-dim">No quests found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (() => {
        const entry = entries.find((e) => e.id === expandedId);
        if (!entry) return null;
        return (
          <div className="pl-2 border border-terminal-border p-3 mx-2 space-y-2">
            <p className="text-terminal-amber text-xs">QUEST DETAILS</p>
            <div>
              <p className="text-terminal-dim text-xs mb-1">Description:</p>
              <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                {entry.description}
              </pre>
            </div>
            <div>
              <p className="text-terminal-dim text-xs mb-1">Objectives:</p>
              <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                {jsonFull(entry.objectives)}
              </pre>
            </div>
            <div>
              <p className="text-terminal-dim text-xs mb-1">Rewards:</p>
              <pre className="text-terminal-green whitespace-pre-wrap text-xs max-h-40 overflow-y-auto">
                {jsonFull(entry.rewards)}
              </pre>
            </div>
            {entry.givenBy && (
              <p className="text-xs">
                <span className="text-terminal-dim">Given By (NPC ID): </span>
                <span className="text-terminal-amber">{entry.givenBy}</span>
              </p>
            )}
          </div>
        );
      })()}

      <Pagination page={page} setPage={setPage} totalPages={totalPages} total={total} shown={entries.length} />
    </>
  );
}
