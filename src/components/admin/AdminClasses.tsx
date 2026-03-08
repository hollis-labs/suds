"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function AdminClasses({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const classesQuery = trpc.admin.getClassesData.useQuery(undefined, {
    enabled: isAdmin,
  });

  const updateClassMeta = trpc.admin.updateClassMeta.useMutation({
    onSuccess: () => {
      classesQuery.refetch();
      setEditingClassId(null);
    },
  });

  const classes = classesQuery.data ?? [];
  const filtered = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function startEditing(cls: { id: string; name: string; description: string }) {
    setEditingClassId(cls.id);
    setEditName(cls.name);
    setEditDescription(cls.description);
  }

  function cancelEditing() {
    setEditingClassId(null);
    setEditName("");
    setEditDescription("");
  }

  function handleSave(classId: string) {
    updateClassMeta.mutate({
      classId,
      name: editName,
      description: editDescription,
    });
  }

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-terminal-amber mb-2">=== CLASSES & ABILITIES ===</h2>

        {/* Search */}
        <div className="pl-2 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-terminal-dim text-sm">Filter:</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search class name..."
              className="bg-black border border-terminal-border text-terminal-green px-2 py-1 w-64 text-sm focus:outline-none focus:border-terminal-green placeholder:text-terminal-dim"
            />
          </div>
          <p className="text-terminal-dim text-xs mt-1">
            {filtered.length} of {classes.length} classes
          </p>
        </div>

        {classesQuery.isLoading ? (
          <p className="text-terminal-dim">Loading...</p>
        ) : (
          <div className="space-y-3 pl-2">
            {filtered.map((cls) => (
              <div
                key={cls.id}
                className="border border-terminal-border p-3"
              >
                {/* Class Header */}
                <div className="flex items-center justify-between">
                  {editingClassId === cls.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-terminal-dim text-xs w-16">Name:</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-black border border-terminal-border text-terminal-green px-2 py-1 flex-1 text-sm focus:outline-none focus:border-terminal-green"
                          disabled={updateClassMeta.isPending}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-terminal-dim text-xs w-16">Desc:</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="bg-black border border-terminal-border text-terminal-green px-2 py-1 flex-1 text-sm focus:outline-none focus:border-terminal-green"
                          disabled={updateClassMeta.isPending}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleSave(cls.id)}
                          disabled={updateClassMeta.isPending}
                          className="text-terminal-green-bright text-xs border border-terminal-border px-2 py-0.5 hover:bg-terminal-green/10 disabled:opacity-50"
                        >
                          {updateClassMeta.isPending ? "[SAVING...]" : "[SAVE]"}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={updateClassMeta.isPending}
                          className="text-terminal-dim text-xs border border-terminal-border px-2 py-0.5 hover:bg-terminal-green/10 disabled:opacity-50"
                        >
                          [CANCEL]
                        </button>
                        {updateClassMeta.isError && (
                          <span className="text-terminal-red text-xs">
                            Error: {updateClassMeta.error?.message ?? "Save failed"}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          setExpandedClass(
                            expandedClass === cls.id ? null : cls.id
                          )
                        }
                        className="text-left flex-1"
                      >
                        <span className="text-terminal-green-bright font-bold text-sm">
                          {cls.name.toUpperCase()}
                        </span>{" "}
                        <span className="text-terminal-dim text-xs">
                          ({cls.id})
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditing(cls)}
                          className="text-terminal-amber text-xs border border-terminal-border px-2 py-0.5 hover:bg-terminal-green/10"
                        >
                          [EDIT]
                        </button>
                        <span className="text-terminal-dim text-xs">
                          {expandedClass === cls.id ? "[-]" : "[+]"}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {editingClassId !== cls.id && (
                  <p className="text-terminal-dim text-xs mt-1">
                    {cls.description}
                  </p>
                )}

                {/* Core Stats Row */}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs">
                  <span>
                    Primary:{" "}
                    <span className="text-terminal-amber">
                      {cls.primary.toUpperCase()}
                    </span>
                  </span>
                  <span>
                    HP Die:{" "}
                    <span className="text-terminal-green-bright">
                      d{cls.hpDie}
                    </span>
                  </span>
                  <span>
                    MP Base:{" "}
                    <span className="text-terminal-blue">{cls.mpBase}</span>
                  </span>
                  <span>
                    AC:{" "}
                    <span className="text-terminal-green-bright">
                      {cls.startingAC}
                    </span>
                  </span>
                </div>

                {/* Starting Stats */}
                <div className="mt-2 text-xs">
                  <span className="text-terminal-dim">Stats: </span>
                  {Object.entries(
                    cls.startingStats as Record<string, number>
                  ).map(([stat, val]) => (
                    <span key={stat} className="mr-2">
                      <span className="text-terminal-amber">
                        {stat.toUpperCase()}
                      </span>
                      :{" "}
                      <span className="text-terminal-green-bright">{val}</span>
                    </span>
                  ))}
                </div>

                {/* Starting Equipment */}
                <div className="mt-1 text-xs">
                  <span className="text-terminal-dim">Equipment: </span>
                  {cls.startingEquipment.weapon && (
                    <span className="text-terminal-green mr-2">
                      {cls.startingEquipment.weapon}
                    </span>
                  )}
                  {cls.startingEquipment.armor && (
                    <span className="text-terminal-green">
                      {cls.startingEquipment.armor}
                    </span>
                  )}
                  {!cls.startingEquipment.weapon &&
                    !cls.startingEquipment.armor && (
                      <span className="text-terminal-dim">None</span>
                    )}
                </div>

                {/* Expanded: Ability Progression */}
                {expandedClass === cls.id && (
                  <div className="mt-3 border-t border-terminal-border pt-2">
                    <p className="text-terminal-amber text-xs mb-1">
                      ABILITY PROGRESSION
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-terminal-dim border-b border-terminal-border">
                          <th className="text-left py-1 pr-4">Level</th>
                          <th className="text-left py-1 pr-4">Ability</th>
                          <th className="text-left py-1 pr-4">MP Cost</th>
                          <th className="text-left py-1">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.abilities.map((levelGroup) =>
                          levelGroup.abilities.map((ability, aIdx) => (
                            <tr
                              key={`${levelGroup.level}-${ability.id}`}
                              className="border-b border-terminal-border/30"
                            >
                              <td className="py-1 pr-4 text-terminal-amber">
                                {aIdx === 0 ? levelGroup.level : ""}
                              </td>
                              <td className="py-1 pr-4 text-terminal-green-bright">
                                {ability.id.replace(/_/g, " ")}
                              </td>
                              <td className="py-1 pr-4">
                                {ability.mpCost > 0 ? (
                                  <span className="text-terminal-blue">
                                    {ability.mpCost}
                                  </span>
                                ) : (
                                  <span className="text-terminal-dim">0</span>
                                )}
                              </td>
                              <td className="py-1 text-terminal-dim">
                                {ability.targetType}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
