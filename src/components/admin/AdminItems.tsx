"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

const RARITY_COLORS: Record<string, string> = {
  common: "text-terminal-white",
  uncommon: "text-green-400",
  rare: "text-terminal-blue",
  epic: "text-terminal-purple",
  legendary: "text-terminal-gold",
};

const ITEM_TYPES = ["weapon", "armor", "potion", "scroll", "accessory"] as const;
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

type ItemType = (typeof ITEM_TYPES)[number];
type Rarity = (typeof RARITIES)[number];
type SortField = "name" | "type" | "rarity" | "basePrice";
type SortDir = "asc" | "desc";

export function AdminItems({ isAdmin }: { isAdmin: boolean }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createId, setCreateId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<ItemType>("weapon");
  const [createRarity, setCreateRarity] = useState<Rarity>("common");
  const [createStats, setCreateStats] = useState("");
  const [createPrice, setCreatePrice] = useState(0);
  const [createDescription, setCreateDescription] = useState("");

  // Clone form state
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneNewId, setCloneNewId] = useState("");
  const [cloneNewName, setCloneNewName] = useState("");

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteMpId, setConfirmDeleteMpId] = useState<string | null>(null);

  // Error state
  const [mutationError, setMutationError] = useState<string | null>(null);

  const itemsQuery = trpc.admin.getItemTemplates.useQuery(undefined, {
    enabled: isAdmin,
  });

  const updateMutation = trpc.admin.updateItemMeta.useMutation({
    onSuccess: () => {
      itemsQuery.refetch();
      setEditingId(null);
    },
    onError: (err) => setMutationError(err.message),
  });

  const createMutation = trpc.admin.createItem.useMutation({
    onSuccess: () => {
      itemsQuery.refetch();
      setShowCreateForm(false);
      resetCreateForm();
      setMutationError(null);
    },
    onError: (err) => setMutationError(err.message),
  });

  const cloneMutation = trpc.admin.cloneItem.useMutation({
    onSuccess: () => {
      itemsQuery.refetch();
      setCloningId(null);
      setCloneNewId("");
      setCloneNewName("");
      setMutationError(null);
    },
    onError: (err) => setMutationError(err.message),
  });

  const deleteMutation = trpc.admin.deleteItem.useMutation({
    onSuccess: () => {
      itemsQuery.refetch();
      setConfirmDeleteId(null);
      setMutationError(null);
    },
    onError: (err) => setMutationError(err.message),
  });

  const deleteMpMutation = trpc.admin.deleteMarketplaceItem.useMutation({
    onSuccess: () => {
      itemsQuery.refetch();
      setConfirmDeleteMpId(null);
      setMutationError(null);
    },
    onError: (err) => setMutationError(err.message),
  });

  function resetCreateForm() {
    setCreateId("");
    setCreateName("");
    setCreateType("weapon");
    setCreateRarity("common");
    setCreateStats("");
    setCreatePrice(0);
    setCreateDescription("");
  }

  function parseStats(raw: string): Record<string, number> {
    const result: Record<string, number> = {};
    if (!raw.trim()) return result;
    const pairs = raw.split(",").map((s) => s.trim());
    for (const pair of pairs) {
      const [key, val] = pair.split(":").map((s) => s.trim());
      if (key && val !== undefined) {
        result[key] = Number(val) || 0;
      }
    }
    return result;
  }

  function handleCreate() {
    createMutation.mutate({
      id: createId,
      name: createName,
      type: createType,
      rarity: createRarity,
      stats: parseStats(createStats),
      basePrice: createPrice,
      description: createDescription,
    });
  }

  function handleClone(sourceId: string) {
    cloneMutation.mutate({
      sourceId,
      newId: cloneNewId,
      newName: cloneNewName,
    });
  }

  function handleDelete(itemId: string) {
    if (confirmDeleteId === itemId) {
      deleteMutation.mutate({ itemId });
    } else {
      setConfirmDeleteId(itemId);
    }
  }

  function handleDeleteMp(id: string) {
    if (confirmDeleteMpId === id) {
      deleteMpMutation.mutate({ id });
    } else {
      setConfirmDeleteMpId(id);
    }
  }

  function startEditing(item: { id: string; name: string; description: string }) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  }

  function saveEditing(itemId: string) {
    updateMutation.mutate({
      itemId,
      name: editName,
      description: editDescription,
    });
  }

  const templates = itemsQuery.data?.templates ?? [];
  const marketplaceItems = itemsQuery.data?.marketplaceItems ?? [];

  const filtered = useMemo(() => {
    let result = [...templates];
    if (typeFilter) result = result.filter((i) => i.type === typeFilter);
    if (rarityFilter) result = result.filter((i) => i.rarity === rarityFilter);

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
  }, [templates, typeFilter, rarityFilter, sortField, sortDir]);

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

  // Count summary
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of templates) {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    }
    return counts;
  }, [templates]);

  return (
    <div className="space-y-4">
      {/* Error display */}
      {mutationError && (
        <div className="bg-black border border-terminal-red p-2 text-terminal-red text-xs">
          <span className="text-terminal-amber">[ERROR]</span> {mutationError}
          <button
            onClick={() => setMutationError(null)}
            className="ml-2 text-terminal-dim hover:text-terminal-red cursor-pointer"
          >
            [DISMISS]
          </button>
        </div>
      )}

      <section>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-terminal-amber">=== ITEM CATALOG ===</h2>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setMutationError(null);
            }}
            className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer"
          >
            {showCreateForm ? "[CANCEL CREATE]" : "[CREATE ITEM]"}
          </button>
        </div>

        {/* Create Item Form */}
        {showCreateForm && (
          <div className="bg-black border border-terminal-border p-3 mb-3 space-y-2">
            <h3 className="text-terminal-amber text-xs mb-2">--- NEW ITEM ---</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <label className="text-terminal-dim w-20">ID:</label>
                <input
                  type="text"
                  value={createId}
                  onChange={(e) => setCreateId(e.target.value)}
                  placeholder="e.g. iron_sword"
                  className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-terminal-dim w-20">Name:</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Iron Sword"
                  className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-terminal-dim w-20">Type:</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as ItemType)}
                  className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-terminal-dim w-20">Rarity:</label>
                <select
                  value={createRarity}
                  onChange={(e) => setCreateRarity(e.target.value as Rarity)}
                  className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
                >
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-terminal-dim w-20">Price:</label>
                <input
                  type="number"
                  value={createPrice}
                  onChange={(e) => setCreatePrice(Number(e.target.value))}
                  className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-terminal-dim w-20">Stats:</label>
                <input
                  type="text"
                  value={createStats}
                  onChange={(e) => setCreateStats(e.target.value)}
                  placeholder="atk:5, def:2"
                  className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <label className="text-terminal-dim w-20">Desc:</label>
              <input
                type="text"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="A sturdy iron blade."
                className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs flex-1 focus:outline-none focus:border-terminal-green"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !createId || !createName}
                className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer disabled:opacity-50"
              >
                {createMutation.isPending ? "[CREATING...]" : "[CREATE]"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetCreateForm();
                  setMutationError(null);
                }}
                className="text-terminal-red hover:text-red-400 text-xs cursor-pointer"
              >
                [CANCEL]
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="pl-2 mb-3 text-xs">
          <span className="text-terminal-dim">Total: </span>
          <span className="text-terminal-green-bright">{templates.length}</span>
          <span className="text-terminal-dim"> items</span>
          {Object.entries(typeCounts).map(([type, cnt]) => (
            <span key={type} className="ml-3">
              <span className="text-terminal-dim">{type}: </span>
              <span className="text-terminal-green">{cnt}</span>
            </span>
          ))}
        </div>

        {/* Filters */}
        <div className="pl-2 mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
            >
              <option value="">All</option>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="text-terminal-dim text-xs">Rarity:</label>
            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 text-xs focus:outline-none focus:border-terminal-green"
            >
              <option value="">All</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <span className="text-terminal-dim text-xs">
            Showing {filtered.length} items
          </span>
        </div>

        {itemsQuery.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : (
          <div className="pl-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-terminal-dim border-b border-terminal-border">
                  <th
                    className="text-left py-1 pr-3 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("name")}
                  >
                    Name{sortIndicator("name")}
                  </th>
                  <th
                    className="text-left py-1 pr-3 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("type")}
                  >
                    Type{sortIndicator("type")}
                  </th>
                  <th
                    className="text-left py-1 pr-3 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("rarity")}
                  >
                    Rarity{sortIndicator("rarity")}
                  </th>
                  <th className="text-left py-1 pr-3">Stats</th>
                  <th
                    className="text-left py-1 pr-3 cursor-pointer hover:text-terminal-green"
                    onClick={() => toggleSort("basePrice")}
                  >
                    Price{sortIndicator("basePrice")}
                  </th>
                  <th className="text-left py-1 pr-3">Description</th>
                  <th className="text-left py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isEditing = editingId === item.id;
                  const isSaving = updateMutation.isPending && editingId === item.id;
                  const isCloning = cloningId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-terminal-border/30"
                    >
                      <td className="py-1 pr-3 text-terminal-green-bright">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-black border border-terminal-border text-terminal-green-bright px-1 py-0.5 text-xs w-full focus:outline-none focus:border-terminal-green"
                            disabled={isSaving}
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="py-1 pr-3">{item.type}</td>
                      <td
                        className={`py-1 pr-3 ${RARITY_COLORS[item.rarity] ?? "text-terminal-green"}`}
                      >
                        {item.rarity}
                      </td>
                      <td className="py-1 pr-3 text-terminal-dim">
                        {Object.entries(item.stats)
                          .map(([k, v]) => `${k}:${v > 0 ? "+" : ""}${v}`)
                          .join(" ") || "--"}
                      </td>
                      <td className="py-1 pr-3 text-terminal-amber">
                        {item.basePrice}g
                      </td>
                      <td className="py-1 pr-3 text-terminal-dim max-w-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="bg-black border border-terminal-border text-terminal-dim px-1 py-0.5 text-xs w-full focus:outline-none focus:border-terminal-green"
                            disabled={isSaving}
                          />
                        ) : (
                          <span className="truncate block">{item.description}</span>
                        )}
                      </td>
                      <td className="py-1 whitespace-nowrap">
                        {isEditing ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => saveEditing(item.id)}
                              disabled={isSaving}
                              className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer disabled:opacity-50"
                            >
                              {isSaving ? "[...]" : "[SAVE]"}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={isSaving}
                              className="text-terminal-red hover:text-red-400 text-xs cursor-pointer disabled:opacity-50"
                            >
                              [CANCEL]
                            </button>
                          </span>
                        ) : isCloning ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={cloneNewId}
                                onChange={(e) => setCloneNewId(e.target.value)}
                                placeholder="new_id"
                                className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs w-20 focus:outline-none focus:border-terminal-green"
                              />
                              <input
                                type="text"
                                value={cloneNewName}
                                onChange={(e) => setCloneNewName(e.target.value)}
                                placeholder="New Name"
                                className="bg-black border border-terminal-border text-terminal-green px-1 py-0.5 text-xs w-24 focus:outline-none focus:border-terminal-green"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleClone(item.id)}
                                disabled={cloneMutation.isPending || !cloneNewId || !cloneNewName}
                                className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer disabled:opacity-50"
                              >
                                {cloneMutation.isPending ? "[...]" : "[OK]"}
                              </button>
                              <button
                                onClick={() => {
                                  setCloningId(null);
                                  setCloneNewId("");
                                  setCloneNewName("");
                                }}
                                className="text-terminal-red hover:text-red-400 text-xs cursor-pointer"
                              >
                                [CANCEL]
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => startEditing(item)}
                              className="text-terminal-amber hover:text-terminal-gold text-xs cursor-pointer"
                            >
                              [EDIT]
                            </button>
                            <button
                              onClick={() => {
                                setCloningId(item.id);
                                setCloneNewId("");
                                setCloneNewName("");
                              }}
                              className="text-terminal-green hover:text-terminal-green-bright text-xs cursor-pointer"
                            >
                              [CLONE]
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteMutation.isPending && confirmDeleteId === item.id}
                              className="text-terminal-red hover:text-red-400 text-xs cursor-pointer disabled:opacity-50"
                            >
                              {deleteMutation.isPending && confirmDeleteId === item.id
                                ? "[...]"
                                : confirmDeleteId === item.id
                                  ? "[ARE YOU SURE?]"
                                  : "[DELETE]"}
                            </button>
                            {confirmDeleteId === item.id && (
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-terminal-dim hover:text-terminal-green text-xs cursor-pointer"
                              >
                                [NO]
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="border-t border-terminal-border" />

      {/* Marketplace Items */}
      <section>
        <h2 className="text-terminal-amber mb-2">
          === MARKETPLACE ITEMS ({marketplaceItems.length}) ===
        </h2>
        {marketplaceItems.length > 0 ? (
          <div className="pl-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-terminal-dim border-b border-terminal-border">
                  <th className="text-left py-1 pr-3">ID</th>
                  <th className="text-left py-1 pr-3">Min Level</th>
                  <th className="text-left py-1 pr-3">Item Data</th>
                  <th className="text-left py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {marketplaceItems.map((mp) => {
                  const data = mp.itemData as Record<string, unknown>;
                  return (
                    <tr
                      key={mp.id}
                      className="border-b border-terminal-border/30"
                    >
                      <td className="py-1 pr-3 text-terminal-dim text-xs">
                        {mp.id.slice(0, 8)}...
                      </td>
                      <td className="py-1 pr-3 text-terminal-amber">
                        {mp.minLevel}
                      </td>
                      <td className="py-1 pr-3 text-terminal-green text-xs">
                        {(data.name as string) ?? JSON.stringify(data).slice(0, 80)}
                      </td>
                      <td className="py-1 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteMp(mp.id)}
                          disabled={deleteMpMutation.isPending && confirmDeleteMpId === mp.id}
                          className="text-terminal-red hover:text-red-400 text-xs cursor-pointer disabled:opacity-50"
                        >
                          {deleteMpMutation.isPending && confirmDeleteMpId === mp.id
                            ? "[...]"
                            : confirmDeleteMpId === mp.id
                              ? "[ARE YOU SURE?]"
                              : "[DELETE]"}
                        </button>
                        {confirmDeleteMpId === mp.id && (
                          <button
                            onClick={() => setConfirmDeleteMpId(null)}
                            className="text-terminal-dim hover:text-terminal-green text-xs cursor-pointer ml-1"
                          >
                            [NO]
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-terminal-dim pl-2 text-sm">
            No marketplace items.
          </p>
        )}
      </section>
    </div>
  );
}
