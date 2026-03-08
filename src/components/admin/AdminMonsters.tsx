"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

type SortField = "name" | "level" | "hpBase" | "ac" | "attack" | "xp";
type SortDir = "asc" | "desc";

const AVAILABLE_THEMES = ["horror", "funny", "epic", "dark_fantasy"] as const;

const DEFAULT_CREATE_FORM = {
  id: "",
  name: "",
  level: 1,
  hpBase: 10,
  ac: 10,
  attack: 0,
  damage: "1d4",
  xp: 10,
  abilities: "",
  themes: [] as string[],
};

export function AdminMonsters({ isAdmin }: { isAdmin: boolean }) {
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("level");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editThemes, setEditThemes] = useState<string[]>([]);

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ ...DEFAULT_CREATE_FORM });

  // Clone state
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneNewId, setCloneNewId] = useState("");
  const [cloneNewName, setCloneNewName] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monstersQuery = trpc.admin.getMonsterTemplates.useQuery(undefined, {
    enabled: isAdmin,
  });

  const updateMutation = trpc.admin.updateMonsterMeta.useMutation({
    onSuccess: () => {
      monstersQuery.refetch();
      setEditingId(null);
    },
  });

  const createMutation = trpc.admin.createMonster.useMutation({
    onSuccess: () => {
      monstersQuery.refetch();
      setShowCreateForm(false);
      setCreateForm({ ...DEFAULT_CREATE_FORM });
    },
  });

  const cloneMutation = trpc.admin.cloneMonster.useMutation({
    onSuccess: () => {
      monstersQuery.refetch();
      setCloningId(null);
      setCloneNewId("");
      setCloneNewName("");
    },
  });

  const deleteMutation = trpc.admin.deleteMonster.useMutation({
    onSuccess: () => {
      monstersQuery.refetch();
      setDeletingId(null);
    },
  });

  const monsters = monstersQuery.data ?? [];

  // Collect all unique themes
  const allThemes = useMemo(() => {
    const set = new Set<string>();
    for (const m of monsters) {
      for (const t of m.themes) set.add(t);
    }
    return Array.from(set).sort();
  }, [monsters]);

  // Theme distribution
  const themeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of monsters) {
      for (const t of m.themes) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return counts;
  }, [monsters]);

  // Filtered and sorted
  const filtered = useMemo(() => {
    let result = [...monsters];
    const minLvl = minLevel ? parseInt(minLevel, 10) : null;
    const maxLvl = maxLevel ? parseInt(maxLevel, 10) : null;
    if (minLvl !== null && !isNaN(minLvl))
      result = result.filter((m) => m.level >= minLvl);
    if (maxLvl !== null && !isNaN(maxLvl))
      result = result.filter((m) => m.level <= maxLvl);
    if (themeFilter)
      result = result.filter((m) => m.themes.includes(themeFilter));

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = typeof aVal === "number" ? aVal : 0;
      const bNum = typeof bVal === "number" ? bVal : 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
    return result;
  }, [monsters, minLevel, maxLevel, themeFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ^" : " v";
  }

  function startEditing(monster: { id: string; name: string; themes: string[] }) {
    setEditingId(monster.id);
    setEditName(monster.name);
    setEditThemes([...monster.themes]);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditThemes([]);
  }

  function toggleEditTheme(theme: string) {
    setEditThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  }

  function handleSave() {
    if (!editingId) return;
    updateMutation.mutate({
      monsterId: editingId,
      name: editName,
      themes: editThemes,
    });
  }

  function toggleCreateTheme(theme: string) {
    setCreateForm((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  }

  function handleCreate() {
    const abilities = createForm.abilities
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    createMutation.mutate({
      id: createForm.id,
      name: createForm.name,
      level: createForm.level,
      hpBase: createForm.hpBase,
      ac: createForm.ac,
      attack: createForm.attack,
      damage: createForm.damage,
      xp: createForm.xp,
      abilities,
      themes: createForm.themes,
    });
  }

  function handleClone(sourceId: string) {
    cloneMutation.mutate({
      sourceId,
      newId: cloneNewId,
      newName: cloneNewName,
    });
  }

  function handleDelete(monsterId: string) {
    deleteMutation.mutate({ monsterId });
  }

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-terminal-amber mb-2">=== MONSTER BESTIARY ===</h2>

        {/* Create Monster Button */}
        <div className="pl-2 mb-3">
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              createMutation.reset();
            }}
            className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer"
          >
            {showCreateForm ? "[CANCEL CREATE]" : "[CREATE MONSTER]"}
          </button>
        </div>

        {/* Create Monster Form */}
        {showCreateForm && (
          <div className="pl-2 mb-4 border border-terminal-border p-3 space-y-3 bg-black/50">
            <div className="text-terminal-amber text-[10px]">
              --- NEW MONSTER ---
            </div>

            <div className="grid grid-cols-2 gap-2 max-w-lg">
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">ID:</label>
                <input
                  type="text"
                  value={createForm.id}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, id: e.target.value }))
                  }
                  placeholder="e.g. goblin_chief"
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 placeholder:text-terminal-dim"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">Name:</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Goblin Chief"
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 placeholder:text-terminal-dim"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">Level:</label>
                <input
                  type="number"
                  value={createForm.level}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      level: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">HP:</label>
                <input
                  type="number"
                  value={createForm.hpBase}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      hpBase: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">AC:</label>
                <input
                  type="number"
                  value={createForm.ac}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      ac: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">Attack:</label>
                <input
                  type="number"
                  value={createForm.attack}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      attack: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">Damage:</label>
                <input
                  type="text"
                  value={createForm.damage}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, damage: e.target.value }))
                  }
                  placeholder="e.g. 2d6+3"
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 placeholder:text-terminal-dim"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-terminal-dim text-xs w-16">XP:</label>
                <input
                  type="number"
                  value={createForm.xp}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      xp: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1"
                  disabled={createMutation.isPending}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 max-w-lg">
              <label className="text-terminal-dim text-xs w-16">Abilities:</label>
              <input
                type="text"
                value={createForm.abilities}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    abilities: e.target.value,
                  }))
                }
                placeholder="comma-separated, e.g. fire_breath, poison"
                className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 placeholder:text-terminal-dim"
                disabled={createMutation.isPending}
              />
            </div>

            <div className="flex items-start gap-2">
              <label className="text-terminal-dim text-xs w-16 pt-0.5">
                Themes:
              </label>
              <div className="flex flex-wrap gap-3">
                {AVAILABLE_THEMES.map((theme) => (
                  <label
                    key={theme}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={createForm.themes.includes(theme)}
                      onChange={() => toggleCreateTheme(theme)}
                      disabled={createMutation.isPending}
                      className="accent-green-500"
                    />
                    <span
                      className={`text-xs ${
                        createForm.themes.includes(theme)
                          ? "text-terminal-green"
                          : "text-terminal-dim"
                      }`}
                    >
                      {theme}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {createMutation.isError && (
              <div className="text-terminal-red text-xs">
                Error: {createMutation.error?.message ?? "Failed to create"}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !createForm.id || !createForm.name}
                className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? "[CREATING...]" : "[CREATE]"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm({ ...DEFAULT_CREATE_FORM });
                  createMutation.reset();
                }}
                disabled={createMutation.isPending}
                className="text-terminal-dim hover:text-terminal-red text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                [CANCEL]
              </button>
            </div>
          </div>
        )}

        {/* Theme Distribution */}
        <div className="pl-2 mb-3 text-xs">
          <span className="text-terminal-dim">
            Total: {monsters.length} monsters
          </span>
          <span className="text-terminal-dim ml-3">| Themes: </span>
          {Object.entries(themeDistribution).map(([theme, cnt]) => (
            <span key={theme} className="ml-2">
              <span className="text-terminal-amber">{theme}</span>
              <span className="text-terminal-dim">: {cnt}</span>
            </span>
          ))}
        </div>

        {/* Filters */}
        <div className="pl-2 mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Level:</label>
            <input
              type="number"
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
              placeholder="min"
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-16 text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
            />
            <span className="text-terminal-dim text-xs">-</span>
            <input
              type="number"
              value={maxLevel}
              onChange={(e) => setMaxLevel(e.target.value)}
              placeholder="max"
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-16 text-xs focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Theme:</label>
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
            >
              <option value="">All</option>
              {allThemes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <span className="text-terminal-dim text-xs">
            Showing {filtered.length} monsters
          </span>
        </div>

        {monstersQuery.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : (
          <div className="pl-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-terminal-dim border-b border-terminal-border">
                  <th className="text-left py-1 pr-2 w-8"></th>
                  <th
                    className="text-left py-1 pr-2 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("name")}
                  >
                    Name{sortIndicator("name")}
                  </th>
                  <th
                    className="text-left py-1 pr-2 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("level")}
                  >
                    Lvl{sortIndicator("level")}
                  </th>
                  <th
                    className="text-left py-1 pr-2 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("hpBase")}
                  >
                    HP{sortIndicator("hpBase")}
                  </th>
                  <th
                    className="text-left py-1 pr-2 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("ac")}
                  >
                    AC{sortIndicator("ac")}
                  </th>
                  <th
                    className="text-left py-1 pr-2 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("attack")}
                  >
                    Atk{sortIndicator("attack")}
                  </th>
                  <th className="text-left py-1 pr-2">Dmg</th>
                  <th
                    className="text-left py-1 pr-2 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("xp")}
                  >
                    XP{sortIndicator("xp")}
                  </th>
                  <th className="text-left py-1 pr-2">Abilities</th>
                  <th className="text-left py-1">Themes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <>
                    <tr
                      key={m.id}
                      className="border-b border-terminal-border/30"
                    >
                      <td className="py-1 pr-2">
                        <div className="flex items-center gap-1">
                          {editingId !== m.id && (
                            <button
                              onClick={() => startEditing(m)}
                              className="text-terminal-dim hover:text-terminal-green text-[10px] cursor-pointer"
                              title="Edit monster"
                            >
                              [EDIT]
                            </button>
                          )}
                          {cloningId !== m.id && deletingId !== m.id && (
                            <>
                              <button
                                onClick={() => {
                                  setCloningId(m.id);
                                  setCloneNewId("");
                                  setCloneNewName("");
                                  cloneMutation.reset();
                                }}
                                className="text-terminal-dim hover:text-terminal-blue text-[10px] cursor-pointer"
                                title="Clone monster"
                              >
                                [CLONE]
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingId(m.id);
                                  deleteMutation.reset();
                                }}
                                className="text-terminal-dim hover:text-terminal-red text-[10px] cursor-pointer"
                                title="Delete monster"
                              >
                                [DELETE]
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-1 pr-2 text-terminal-green-bright">
                        {m.name}
                      </td>
                      <td className="py-1 pr-2 text-terminal-amber">
                        {m.level}
                      </td>
                      <td className="py-1 pr-2 text-terminal-red">{m.hpBase}</td>
                      <td className="py-1 pr-2">{m.ac}</td>
                      <td className="py-1 pr-2">{m.attack}</td>
                      <td className="py-1 pr-2 text-terminal-dim">{m.damage}</td>
                      <td className="py-1 pr-2 text-terminal-amber">{m.xp}</td>
                      <td className="py-1 pr-2 text-terminal-dim">
                        {m.abilities.length > 0
                          ? m.abilities.join(", ")
                          : "--"}
                      </td>
                      <td className="py-1 text-terminal-blue">
                        {m.themes.join(", ")}
                      </td>
                    </tr>
                    {editingId === m.id && (
                      <tr
                        key={`${m.id}-edit`}
                        className="border-b border-terminal-border bg-black/50"
                      >
                        <td colSpan={10} className="py-2 px-4">
                          <div className="border border-terminal-border p-3 space-y-3">
                            <div className="text-terminal-amber text-[10px]">
                              --- EDITING: {m.name} ---
                            </div>

                            {/* Name input */}
                            <div className="flex items-center gap-2">
                              <label className="text-terminal-dim text-xs w-16">
                                Name:
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 max-w-xs"
                                disabled={updateMutation.isPending}
                              />
                            </div>

                            {/* Themes checkboxes */}
                            <div className="flex items-start gap-2">
                              <label className="text-terminal-dim text-xs w-16 pt-0.5">
                                Themes:
                              </label>
                              <div className="flex flex-wrap gap-3">
                                {AVAILABLE_THEMES.map((theme) => (
                                  <label
                                    key={theme}
                                    className="flex items-center gap-1 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editThemes.includes(theme)}
                                      onChange={() => toggleEditTheme(theme)}
                                      disabled={updateMutation.isPending}
                                      className="accent-green-500"
                                    />
                                    <span
                                      className={`text-xs ${
                                        editThemes.includes(theme)
                                          ? "text-terminal-green"
                                          : "text-terminal-dim"
                                      }`}
                                    >
                                      {theme}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Error display */}
                            {updateMutation.isError && (
                              <div className="text-terminal-red text-xs">
                                Error: {updateMutation.error?.message ?? "Failed to save"}
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-3 pt-1">
                              <button
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updateMutation.isPending
                                  ? "[SAVING...]"
                                  : "[SAVE]"}
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={updateMutation.isPending}
                                className="text-terminal-dim hover:text-terminal-red text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                [CANCEL]
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {cloningId === m.id && (
                      <tr
                        key={`${m.id}-clone`}
                        className="border-b border-terminal-border bg-black/50"
                      >
                        <td colSpan={10} className="py-2 px-4">
                          <div className="border border-terminal-border p-3 space-y-3">
                            <div className="text-terminal-amber text-[10px]">
                              --- CLONE: {m.name} ---
                            </div>
                            <div className="flex items-center gap-4 max-w-lg">
                              <div className="flex items-center gap-2 flex-1">
                                <label className="text-terminal-dim text-xs w-16">
                                  New ID:
                                </label>
                                <input
                                  type="text"
                                  value={cloneNewId}
                                  onChange={(e) => setCloneNewId(e.target.value)}
                                  placeholder="e.g. goblin_chief_v2"
                                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 placeholder:text-terminal-dim"
                                  disabled={cloneMutation.isPending}
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <label className="text-terminal-dim text-xs w-16">
                                  New Name:
                                </label>
                                <input
                                  type="text"
                                  value={cloneNewName}
                                  onChange={(e) => setCloneNewName(e.target.value)}
                                  placeholder="e.g. Goblin Chief V2"
                                  className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green flex-1 placeholder:text-terminal-dim"
                                  disabled={cloneMutation.isPending}
                                />
                              </div>
                            </div>

                            {cloneMutation.isError && (
                              <div className="text-terminal-red text-xs">
                                Error: {cloneMutation.error?.message ?? "Failed to clone"}
                              </div>
                            )}

                            <div className="flex items-center gap-3 pt-1">
                              <button
                                onClick={() => handleClone(m.id)}
                                disabled={cloneMutation.isPending || !cloneNewId || !cloneNewName}
                                className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {cloneMutation.isPending ? "[CLONING...]" : "[CLONE]"}
                              </button>
                              <button
                                onClick={() => {
                                  setCloningId(null);
                                  cloneMutation.reset();
                                }}
                                disabled={cloneMutation.isPending}
                                className="text-terminal-dim hover:text-terminal-red text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                [CANCEL]
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {deletingId === m.id && (
                      <tr
                        key={`${m.id}-delete`}
                        className="border-b border-terminal-border bg-black/50"
                      >
                        <td colSpan={10} className="py-2 px-4">
                          <div className="border border-terminal-red/50 p-3 space-y-3">
                            <div className="text-terminal-red text-xs">
                              Are you sure you want to delete &quot;{m.name}&quot;? This cannot be undone.
                            </div>

                            {deleteMutation.isError && (
                              <div className="text-terminal-red text-xs">
                                Error: {deleteMutation.error?.message ?? "Failed to delete"}
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleDelete(m.id)}
                                disabled={deleteMutation.isPending}
                                className="text-terminal-red hover:text-red-400 text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deleteMutation.isPending ? "[DELETING...]" : "[CONFIRM DELETE]"}
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingId(null);
                                  deleteMutation.reset();
                                }}
                                disabled={deleteMutation.isPending}
                                className="text-terminal-dim hover:text-terminal-green text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                [CANCEL]
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
