"use client";

import { useState, Fragment } from "react";
import { trpc } from "@/lib/trpc";

const RARITY_COLORS: Record<string, string> = {
  common: "text-terminal-white",
  uncommon: "text-green-400",
  rare: "text-terminal-blue",
  epic: "text-terminal-purple",
  legendary: "text-terminal-gold",
};

const CLASS_OPTIONS = [
  "fighter", "wizard", "rogue", "cleric", "barbarian", "bard",
  "druid", "monk", "paladin", "ranger", "sorcerer", "warlock",
];

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

export function AdminCharacters({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 25;

  const charsQuery = trpc.admin.listAllCharacters.useQuery(
    {
      limit: pageSize,
      offset: page * pageSize,
      search: search || undefined,
      classFilter: classFilter || undefined,
    },
    { enabled: isAdmin }
  );

  const detailQuery = trpc.admin.getCharacterDetail.useQuery(
    { characterId: expandedId! },
    { enabled: isAdmin && !!expandedId }
  );

  const characters = charsQuery.data?.characters ?? [];
  const total = charsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-terminal-amber mb-2">=== CHARACTER BROWSER ===</h2>

        {/* Filters */}
        <div className="pl-2 mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Search:</label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Character name..."
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-48 text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Class:</label>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(0);
              }}
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
            >
              <option value="">All</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <span className="text-terminal-dim text-xs">
            {total} total characters
          </span>
        </div>

        {charsQuery.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : (
          <>
            <div className="pl-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-terminal-dim border-b border-terminal-border">
                    <th className="text-left py-1 pr-2">Name</th>
                    <th className="text-left py-1 pr-2">Class</th>
                    <th className="text-left py-1 pr-2">Lvl</th>
                    <th className="text-left py-1 pr-2">HP</th>
                    <th className="text-left py-1 pr-2">Gold</th>
                    <th className="text-left py-1 pr-2">Rooms</th>
                    <th className="text-left py-1">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.map((char) => (
                    <Fragment key={char.id}>
                      <tr
                        className="border-b border-terminal-border/30 cursor-pointer hover:bg-terminal-green/5"
                        onClick={() =>
                          setExpandedId(
                            expandedId === char.id ? null : char.id
                          )
                        }
                      >
                        <td className="py-1 pr-2 text-terminal-green-bright">
                          {expandedId === char.id ? "[-] " : "[+] "}
                          {char.name}
                        </td>
                        <td className="py-1 pr-2 text-terminal-amber">
                          {char.class}
                        </td>
                        <td className="py-1 pr-2">{char.level}</td>
                        <td className="py-1 pr-2">
                          <span className="text-terminal-red">{char.hp}</span>
                          <span className="text-terminal-dim">
                            /{char.hpMax}
                          </span>
                        </td>
                        <td className="py-1 pr-2 text-terminal-amber">
                          {char.gold}
                        </td>
                        <td className="py-1 pr-2">{char.roomCount}</td>
                        <td className="py-1 text-terminal-dim">
                          {timeAgo(char.updatedAt)}
                        </td>
                      </tr>

                      {/* Detail Panel */}
                      {expandedId === char.id && (
                        <tr key={`${char.id}-detail`}>
                          <td colSpan={7} className="py-2 px-4">
                            {detailQuery.isLoading ? (
                              <p className="text-terminal-dim">
                                Loading details...
                              </p>
                            ) : detailQuery.data ? (
                              <CharacterDetail
                                data={detailQuery.data}
                                charSummary={char}
                                onDeleted={() => setExpandedId(null)}
                              />
                            ) : (
                              <p className="text-terminal-dim">
                                Failed to load details.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pl-2 mt-3 flex items-center gap-3 text-xs">
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
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CharacterDetail({
  data,
  charSummary,
  onDeleted,
}: {
  data: {
    character: Record<string, unknown>;
    inventory: Array<Record<string, unknown>>;
    roomCount: number;
    loreCount: number;
  };
  charSummary: { mp: number; mpMax: number; ac: number; xp: number };
  onDeleted: () => void;
}) {
  const char = data.character;
  const stats = char.stats as Record<string, number> | null;
  const equipment = char.equipment as Record<string, unknown> | null;
  const abilities = char.abilities as string[] | null;
  const position = char.position as { x: number; y: number } | null;
  const companion = char.companion as Record<string, unknown> | null;
  const buffs = char.buffs as Array<Record<string, unknown>> | null;

  const [godMode, setGodMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // God mode form state
  const [gmLevel, setGmLevel] = useState<number>((char.level as number) ?? 1);
  const [gmXp, setGmXp] = useState<number>(charSummary.xp ?? 0);
  const [gmGold, setGmGold] = useState<number>((char.gold as number) ?? 0);
  const [gmHp, setGmHp] = useState<number>((char.hp as number) ?? 0);
  const [gmHpMax, setGmHpMax] = useState<number>((char.hpMax as number) ?? 0);
  const [gmMp, setGmMp] = useState<number>(charSummary.mp ?? 0);
  const [gmMpMax, setGmMpMax] = useState<number>(charSummary.mpMax ?? 0);
  const [gmAc, setGmAc] = useState<number>(charSummary.ac ?? 10);
  const [gmStr, setGmStr] = useState<number>(stats?.str ?? 10);
  const [gmDex, setGmDex] = useState<number>(stats?.dex ?? 10);
  const [gmCon, setGmCon] = useState<number>(stats?.con ?? 10);
  const [gmInt, setGmInt] = useState<number>(stats?.int ?? 10);
  const [gmWis, setGmWis] = useState<number>(stats?.wis ?? 10);
  const [gmCha, setGmCha] = useState<number>(stats?.cha ?? 10);
  const [gmPosX, setGmPosX] = useState<number>(position?.x ?? 0);
  const [gmPosY, setGmPosY] = useState<number>(position?.y ?? 0);
  const [gmAbilities, setGmAbilities] = useState<string>(
    abilities?.join(", ") ?? ""
  );

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const utils = trpc.useUtils();
  const godModeMutation = trpc.admin.updateCharacterGodMode.useMutation({
    onSuccess: () => {
      void utils.admin.listAllCharacters.invalidate();
      void utils.admin.getCharacterDetail.invalidate();
      setGodMode(false);
      setSaving(false);
    },
    onError: () => {
      setSaving(false);
    },
  });

  const resetMutation = trpc.admin.resetCharacter.useMutation({
    onSuccess: () => {
      void utils.admin.listAllCharacters.invalidate();
      void utils.admin.getCharacterDetail.invalidate();
      setConfirmingReset(false);
    },
  });

  const deleteMutation = trpc.admin.deleteCharacter.useMutation({
    onSuccess: () => {
      void utils.admin.listAllCharacters.invalidate();
      setConfirmingDelete(false);
      onDeleted();
    },
  });

  function resetGodModeFields() {
    setGmLevel((char.level as number) ?? 1);
    setGmXp(charSummary.xp ?? 0);
    setGmGold((char.gold as number) ?? 0);
    setGmHp((char.hp as number) ?? 0);
    setGmHpMax((char.hpMax as number) ?? 0);
    setGmMp(charSummary.mp ?? 0);
    setGmMpMax(charSummary.mpMax ?? 0);
    setGmAc(charSummary.ac ?? 10);
    setGmStr(stats?.str ?? 10);
    setGmDex(stats?.dex ?? 10);
    setGmCon(stats?.con ?? 10);
    setGmInt(stats?.int ?? 10);
    setGmWis(stats?.wis ?? 10);
    setGmCha(stats?.cha ?? 10);
    setGmPosX(position?.x ?? 0);
    setGmPosY(position?.y ?? 0);
    setGmAbilities(abilities?.join(", ") ?? "");
  }

  function handleGodModeSave() {
    setSaving(true);
    const abilitiesArray = gmAbilities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    godModeMutation.mutate({
      characterId: char.id as string,
      level: gmLevel,
      xp: gmXp,
      gold: gmGold,
      hp: gmHp,
      hpMax: gmHpMax,
      mp: gmMp,
      mpMax: gmMpMax,
      ac: gmAc,
      stats: {
        str: gmStr,
        dex: gmDex,
        con: gmCon,
        int: gmInt,
        wis: gmWis,
        cha: gmCha,
      },
      position: { x: gmPosX, y: gmPosY },
      abilities: abilitiesArray,
    });
  }

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    width = "w-20"
  ) => (
    <div className="flex items-center gap-1">
      <label className="text-terminal-dim">{label}:</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`bg-black border border-terminal-border text-terminal-green px-1 py-0.5 ${width} text-xs focus:outline-none focus:border-terminal-green`}
      />
    </div>
  );

  return (
    <div className="border border-terminal-border p-3 space-y-3 text-xs">
      {/* God Mode Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (!godMode) resetGodModeFields();
            setGodMode(!godMode);
          }}
          className={`border px-2 py-0.5 text-xs font-bold ${
            godMode
              ? "border-terminal-red text-terminal-red hover:bg-terminal-red/10"
              : "border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10"
          }`}
        >
          [GOD MODE]
        </button>
        {godMode && (
          <span className="text-terminal-red text-xs">
            GOD MODE ACTIVE
          </span>
        )}
      </div>

      {/* God Mode Warning & Editor */}
      {godMode && (
        <div className="border border-terminal-red p-3 space-y-3">
          <div className="bg-terminal-red/10 border border-terminal-red px-2 py-1 text-terminal-red text-xs">
            GOD MODE - Changes are logged for auditing
          </div>

          {/* Core Stats */}
          <div>
            <p className="text-terminal-amber mb-1">CORE</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pl-2">
              {numInput("Level", gmLevel, setGmLevel)}
              {numInput("XP", gmXp, setGmXp)}
              {numInput("Gold", gmGold, setGmGold)}
            </div>
          </div>

          {/* Vitals */}
          <div>
            <p className="text-terminal-amber mb-1">VITALS</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pl-2">
              {numInput("HP", gmHp, setGmHp)}
              {numInput("HP Max", gmHpMax, setGmHpMax)}
              {numInput("MP", gmMp, setGmMp)}
              {numInput("MP Max", gmMpMax, setGmMpMax)}
              {numInput("AC", gmAc, setGmAc)}
            </div>
          </div>

          {/* Attribute Stats */}
          <div>
            <p className="text-terminal-amber mb-1">ATTRIBUTES</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pl-2">
              {numInput("STR", gmStr, setGmStr, "w-16")}
              {numInput("DEX", gmDex, setGmDex, "w-16")}
              {numInput("CON", gmCon, setGmCon, "w-16")}
              {numInput("INT", gmInt, setGmInt, "w-16")}
              {numInput("WIS", gmWis, setGmWis, "w-16")}
              {numInput("CHA", gmCha, setGmCha, "w-16")}
            </div>
          </div>

          {/* Position */}
          <div>
            <p className="text-terminal-amber mb-1">POSITION</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pl-2">
              {numInput("X", gmPosX, setGmPosX, "w-16")}
              {numInput("Y", gmPosY, setGmPosY, "w-16")}
            </div>
          </div>

          {/* Abilities */}
          <div>
            <p className="text-terminal-amber mb-1">ABILITIES</p>
            <div className="pl-2">
              <input
                type="text"
                value={gmAbilities}
                onChange={(e) => setGmAbilities(e.target.value)}
                placeholder="slash_attack, fireball, heal..."
                className="bg-black border border-terminal-border text-terminal-green px-2 py-0.5 w-full text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
              />
              <p className="text-terminal-dim mt-0.5">
                Comma-separated list of ability names
              </p>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleGodModeSave}
              disabled={saving}
              className="border border-terminal-green text-terminal-green hover:bg-terminal-green/10 disabled:text-terminal-dim disabled:border-terminal-dim px-3 py-0.5 text-xs font-bold"
            >
              {saving ? "[SAVING...]" : "[SAVE]"}
            </button>
            <button
              onClick={() => {
                resetGodModeFields();
                setGodMode(false);
              }}
              disabled={saving}
              className="border border-terminal-dim text-terminal-dim hover:text-terminal-red hover:border-terminal-red disabled:hover:text-terminal-dim disabled:hover:border-terminal-dim px-3 py-0.5 text-xs"
            >
              [CANCEL]
            </button>
            {godModeMutation.error && (
              <span className="text-terminal-red">
                Error: {godModeMutation.error.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div>
        <p className="text-terminal-amber mb-1">STATS</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-2">
          <span>
            MP:{" "}
            <span className="text-terminal-blue">
              {charSummary.mp}/{charSummary.mpMax}
            </span>
          </span>
          <span>
            AC:{" "}
            <span className="text-terminal-green-bright">
              {charSummary.ac}
            </span>
          </span>
          <span>
            XP: <span className="text-terminal-dim">{charSummary.xp}</span>
          </span>
          {stats &&
            Object.entries(stats).map(([key, val]) => (
              <span key={key}>
                <span className="text-terminal-amber">
                  {key.toUpperCase()}
                </span>
                : <span className="text-terminal-green-bright">{val}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Equipment */}
      <div>
        <p className="text-terminal-amber mb-1">EQUIPMENT</p>
        <div className="pl-2">
          {equipment && Object.keys(equipment).length > 0 ? (
            Object.entries(equipment).map(([slot, item]) => (
              <p key={slot}>
                <span className="text-terminal-dim">{slot}: </span>
                <span className="text-terminal-green-bright">
                  {typeof item === "object" && item !== null
                    ? (item as Record<string, unknown>).name as string ?? JSON.stringify(item)
                    : String(item)}
                </span>
              </p>
            ))
          ) : (
            <p className="text-terminal-dim">No equipment</p>
          )}
        </div>
      </div>

      {/* Inventory */}
      <div>
        <p className="text-terminal-amber mb-1">
          INVENTORY ({data.inventory.length} items)
        </p>
        <div className="pl-2 space-y-0.5">
          {data.inventory.length > 0 ? (
            data.inventory.map((item) => (
              <p key={item.id as string}>
                <span
                  className={
                    RARITY_COLORS[item.rarity as string] ??
                    "text-terminal-green"
                  }
                >
                  {item.name as string}
                </span>{" "}
                <span className="text-terminal-dim">
                  ({item.type as string}, {item.rarity as string})
                  {(item.quantity as number) > 1
                    ? ` x${item.quantity as number}`
                    : ""}
                  {item.isEquipped ? " [E]" : ""}
                </span>
              </p>
            ))
          ) : (
            <p className="text-terminal-dim">Empty inventory</p>
          )}
        </div>
      </div>

      {/* Abilities */}
      <div>
        <p className="text-terminal-amber mb-1">ABILITIES</p>
        <p className="pl-2 text-terminal-green">
          {abilities && abilities.length > 0
            ? abilities.map((a) => a.replace(/_/g, " ")).join(", ")
            : "None"}
        </p>
      </div>

      {/* Position & Companion */}
      <div className="flex flex-wrap gap-x-8 gap-y-1">
        <div>
          <p className="text-terminal-amber mb-1">POSITION</p>
          <p className="pl-2">
            {position ? `(${position.x}, ${position.y})` : "unknown"}
          </p>
        </div>
        <div>
          <p className="text-terminal-amber mb-1">ROOMS / LORE</p>
          <p className="pl-2">
            {data.roomCount} rooms, {data.loreCount} lore entries
          </p>
        </div>
        {companion && (
          <div>
            <p className="text-terminal-amber mb-1">COMPANION</p>
            <p className="pl-2 text-terminal-green-bright">
              {(companion.name as string) ?? "Unknown companion"}
            </p>
          </div>
        )}
      </div>

      {/* Buffs */}
      {buffs && buffs.length > 0 && (
        <div>
          <p className="text-terminal-amber mb-1">ACTIVE BUFFS</p>
          <div className="pl-2 space-y-0.5">
            {buffs.map((buff, i) => (
              <p key={i} className="text-terminal-blue">
                {(buff.type as string) ?? "buff"}{" "}
                <span className="text-terminal-dim">
                  {JSON.stringify(buff)}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone: Reset & Delete */}
      <div className="border-t border-terminal-border pt-3 mt-3">
        <p className="text-terminal-red mb-2">DANGER ZONE</p>
        <div className="pl-2 space-y-3">
          {/* Reset Character */}
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              disabled={resetMutation.isPending || deleteMutation.isPending}
              className="border border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10 disabled:text-terminal-dim disabled:border-terminal-dim px-2 py-0.5 text-xs font-bold"
            >
              [RESET]
            </button>
          ) : (
            <div className="border border-terminal-amber p-2 space-y-2">
              <p className="text-terminal-amber">
                This will reset {char.name as string} to level 1 and wipe all rooms, inventory, and lore. This cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    resetMutation.mutate({ characterId: char.id as string })
                  }
                  disabled={resetMutation.isPending}
                  className="border border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10 disabled:text-terminal-dim disabled:border-terminal-dim px-2 py-0.5 text-xs font-bold"
                >
                  {resetMutation.isPending ? "[RESETTING...]" : "[CONFIRM RESET]"}
                </button>
                <button
                  onClick={() => setConfirmingReset(false)}
                  disabled={resetMutation.isPending}
                  className="border border-terminal-dim text-terminal-dim hover:text-terminal-green hover:border-terminal-green disabled:hover:text-terminal-dim disabled:hover:border-terminal-dim px-2 py-0.5 text-xs"
                >
                  [CANCEL]
                </button>
              </div>
              {resetMutation.error && (
                <p className="text-terminal-red">
                  Error: {resetMutation.error.message}
                </p>
              )}
            </div>
          )}

          {/* Delete Character */}
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={resetMutation.isPending || deleteMutation.isPending}
              className="border border-terminal-red text-terminal-red hover:bg-terminal-red/10 disabled:text-terminal-dim disabled:border-terminal-dim px-2 py-0.5 text-xs font-bold"
            >
              [DELETE]
            </button>
          ) : (
            <div className="border border-terminal-red p-2 space-y-2">
              <p className="text-terminal-red">
                This will permanently delete {char.name as string} and all associated data. This cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    deleteMutation.mutate({ characterId: char.id as string })
                  }
                  disabled={deleteMutation.isPending}
                  className="border border-terminal-red text-terminal-red hover:bg-terminal-red/10 disabled:text-terminal-dim disabled:border-terminal-dim px-2 py-0.5 text-xs font-bold"
                >
                  {deleteMutation.isPending ? "[DELETING...]" : "[CONFIRM DELETE]"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleteMutation.isPending}
                  className="border border-terminal-dim text-terminal-dim hover:text-terminal-green hover:border-terminal-green disabled:hover:text-terminal-dim disabled:hover:border-terminal-dim px-2 py-0.5 text-xs"
                >
                  [CANCEL]
                </button>
              </div>
              {deleteMutation.error && (
                <p className="text-terminal-red">
                  Error: {deleteMutation.error.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
