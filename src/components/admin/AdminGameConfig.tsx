"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const RARITY_COLORS: Record<string, string> = {
  common: "text-terminal-white",
  uncommon: "text-green-400",
  rare: "text-terminal-blue",
  epic: "text-terminal-purple",
  legendary: "text-terminal-gold",
};

type PoolName =
  | "roomAdjectives"
  | "roomNouns"
  | "npcFirstNames"
  | "npcTitles"
  | "storeNames";

const POOL_LABELS: Record<PoolName, string> = {
  npcFirstNames: "First Names",
  npcTitles: "Titles",
  storeNames: "Store Names",
  roomAdjectives: "Room Adjectives",
  roomNouns: "Room Nouns",
};

export function AdminGameConfig({ isAdmin }: { isAdmin: boolean }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [poolInputs, setPoolInputs] = useState<Record<PoolName, string>>({
    npcFirstNames: "",
    npcTitles: "",
    storeNames: "",
    roomAdjectives: "",
    roomNouns: "",
  });
  const [newTemplateInputs, setNewTemplateInputs] = useState<
    Record<string, string>
  >({});
  const [newSlotWordInputs, setNewSlotWordInputs] = useState<
    Record<string, string>
  >({});
  const [expandedTemplateTheme, setExpandedTemplateTheme] = useState<
    string | null
  >(null);
  const [expandedTemplateType, setExpandedTemplateType] = useState<
    string | null
  >(null);

  const configQuery = trpc.admin.getGameConfig.useQuery(undefined, {
    enabled: isAdmin,
  });

  const templatesQuery = trpc.admin.getTemplatesData.useQuery(undefined, {
    enabled: isAdmin,
  });

  const utils = trpc.useUtils();

  const addNamePoolEntry = trpc.admin.addNamePoolEntry.useMutation({
    onSuccess: () => utils.admin.getTemplatesData.invalidate(),
  });

  const removeNamePoolEntry = trpc.admin.removeNamePoolEntry.useMutation({
    onSuccess: () => utils.admin.getTemplatesData.invalidate(),
  });

  const updateTemplateStrings = trpc.admin.updateTemplateStrings.useMutation({
    onSuccess: () => utils.admin.getTemplatesData.invalidate(),
  });

  const updateTemplateSlot = trpc.admin.updateTemplateSlot.useMutation({
    onSuccess: () => utils.admin.getTemplatesData.invalidate(),
  });

  const config = configQuery.data;
  const tplData = templatesQuery.data;

  function toggle(section: string) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  function handleAddPoolEntry(pool: PoolName) {
    const entry = poolInputs[pool].trim();
    if (!entry) return;
    addNamePoolEntry.mutate(
      { pool, entry },
      {
        onSuccess: () =>
          setPoolInputs((prev) => ({ ...prev, [pool]: "" })),
      }
    );
  }

  function handleRemovePoolEntry(pool: PoolName, entry: string) {
    removeNamePoolEntry.mutate({ pool, entry });
  }

  function handleAddTemplate(
    roomType: string,
    theme: string,
    currentTemplates: string[]
  ) {
    const key = `${theme}::${roomType}`;
    const newTpl = (newTemplateInputs[key] ?? "").trim();
    if (!newTpl) return;
    updateTemplateStrings.mutate(
      {
        roomType,
        theme,
        templates: [...currentTemplates, newTpl],
      },
      {
        onSuccess: () =>
          setNewTemplateInputs((prev) => ({ ...prev, [key]: "" })),
      }
    );
  }

  function handleRemoveTemplate(
    roomType: string,
    theme: string,
    currentTemplates: string[],
    index: number
  ) {
    const updated = currentTemplates.filter((_, i) => i !== index);
    updateTemplateStrings.mutate({ roomType, theme, templates: updated });
  }

  function handleAddSlotWord(
    roomType: string,
    theme: string,
    slot: string,
    currentEntries: string[]
  ) {
    const key = `${theme}::${roomType}::${slot}`;
    const word = (newSlotWordInputs[key] ?? "").trim();
    if (!word) return;
    updateTemplateSlot.mutate(
      {
        roomType,
        theme,
        slot,
        entries: [...currentEntries, word],
      },
      {
        onSuccess: () =>
          setNewSlotWordInputs((prev) => ({ ...prev, [key]: "" })),
      }
    );
  }

  function handleRemoveSlotWord(
    roomType: string,
    theme: string,
    slot: string,
    currentEntries: string[],
    index: number
  ) {
    const updated = currentEntries.filter((_, i) => i !== index);
    updateTemplateSlot.mutate({ roomType, theme, slot, entries: updated });
  }

  if (configQuery.isLoading) {
    return <p className="text-terminal-dim">Loading...</p>;
  }

  if (!config) {
    return <p className="text-terminal-dim">Failed to load config.</p>;
  }

  const gc = config.gameConfig;

  return (
    <div className="space-y-4">
      <h2 className="text-terminal-amber mb-2">=== GAME CONFIGURATION ===</h2>

      {/* Map Config */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">MAP</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 pl-2 text-xs">
          <ConfigVal label="Viewport Width" value={gc.MAP_VIEWPORT_WIDTH} />
          <ConfigVal label="Viewport Height" value={gc.MAP_VIEWPORT_HEIGHT} />
          <ConfigVal label="Dead Zone" value={gc.MAP_DEAD_ZONE} />
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Combat Config */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">COMBAT</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 pl-2 text-xs">
          <ConfigVal
            label="Encounter Base Chance"
            value={gc.ENCOUNTER_BASE_CHANCE}
          />
          <ConfigVal
            label="Depth Modifier"
            value={gc.ENCOUNTER_DEPTH_MODIFIER}
          />
          <ConfigVal
            label="Level Min Offset"
            value={gc.ENCOUNTER_LEVEL_MIN_OFFSET}
          />
          <ConfigVal
            label="Level Max Offset"
            value={gc.ENCOUNTER_LEVEL_MAX_OFFSET}
          />
          <ConfigVal
            label="Difficulty Budget"
            value={gc.ENCOUNTER_DIFFICULTY_BUDGET}
          />
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Economy Config */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">ECONOMY</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 pl-2 text-xs">
          <ConfigVal label="Starting Gold" value={gc.STARTING_GOLD} />
          <ConfigVal
            label="Death Penalty"
            value={`${gc.DEATH_GOLD_PENALTY * 100}%`}
          />
          <ConfigVal
            label="CHA Discount/Mod"
            value={`${gc.STORE_CHA_DISCOUNT_PER_MOD * 100}%`}
          />
          <ConfigVal label="Max Inventory" value={gc.MAX_INVENTORY_SLOTS} />
          <ConfigVal label="Max Level" value={gc.MAX_LEVEL} />
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Rest Config */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">REST</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 pl-2 text-xs">
          <ConfigVal
            label="HP Recovery"
            value={`${gc.REST_HP_PERCENT * 100}%`}
          />
          <ConfigVal
            label="MP Recovery"
            value={`${gc.REST_MP_PERCENT * 100}%`}
          />
          <ConfigVal
            label="Tavern HP"
            value={`${gc.REST_TAVERN_HP_PERCENT * 100}%`}
          />
          <ConfigVal
            label="Tavern MP"
            value={`${gc.REST_TAVERN_MP_PERCENT * 100}%`}
          />
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Shrines Config */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">SHRINES</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 pl-2 text-xs">
          <ConfigVal label="Shield Base" value={gc.SHRINE_SHIELD_BASE} />
          <ConfigVal
            label="Shield/Level"
            value={gc.SHRINE_SHIELD_PER_LEVEL}
          />
          <ConfigVal
            label="Blessing Atk Bonus"
            value={gc.SHRINE_BLESSING_ATTACK_BONUS}
          />
          <ConfigVal
            label="Blessing AC Bonus"
            value={gc.SHRINE_BLESSING_AC_BONUS}
          />
          <ConfigVal
            label="Blessing Combats"
            value={gc.SHRINE_BLESSING_COMBATS}
          />
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Travel Stones */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">
          TRAVEL STONES
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 pl-2 text-xs">
          <ConfigVal
            label="Base Drop Rate"
            value={gc.STONE_BASE_DROP_RATE}
          />
          <ConfigVal
            label="Drop Rate Increase"
            value={gc.STONE_DROP_RATE_INCREASE}
          />
          <ConfigVal label="Max Count" value={gc.STONE_MAX_COUNT} />
          <ConfigVal label="Max Ratio" value={gc.STONE_MAX_RATIO} />
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Room Types */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">
          ROOM TYPES
        </h3>
        <table className="text-xs border-collapse ml-2">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-4">Type</th>
              <th className="text-left py-1 pr-4">Shallow Weight</th>
              <th className="text-left py-1">Deep Weight</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(config.roomTypes).map(([key, rt]) => (
              <tr key={key} className="border-b border-terminal-border/30">
                <td className="py-1 pr-4 text-terminal-green-bright">
                  {(rt as { name: string; shallowWeight: number; deepWeight: number }).name}
                </td>
                <td className="py-1 pr-4">
                  {(rt as { shallowWeight: number }).shallowWeight}
                </td>
                <td className="py-1">
                  {(rt as { deepWeight: number }).deepWeight}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Rarity */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">RARITY</h3>
        <table className="text-xs border-collapse ml-2">
          <thead>
            <tr className="text-terminal-dim border-b border-terminal-border">
              <th className="text-left py-1 pr-4">Rarity</th>
              <th className="text-left py-1 pr-4">Drop Rate</th>
              <th className="text-left py-1">Price Multiplier</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(config.rarity).map(([key, r]) => {
              const rr = r as { name: string; dropRate: number; priceMultiplier: number };
              return (
                <tr key={key} className="border-b border-terminal-border/30">
                  <td
                    className={`py-1 pr-4 ${RARITY_COLORS[key] ?? "text-terminal-green"}`}
                  >
                    {rr.name}
                  </td>
                  <td className="py-1 pr-4">{rr.dropRate}</td>
                  <td className="py-1">x{rr.priceMultiplier}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Themes */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">THEMES</h3>
        <div className="space-y-1 ml-2 text-xs">
          {Object.entries(config.themes).map(([key, theme]) => {
            const tt = theme as { name: string; description: string };
            return (
              <p key={key}>
                <span className="text-terminal-amber">{tt.name}</span>
                <span className="text-terminal-dim">
                  {" "}
                  -- {tt.description}
                </span>
              </p>
            );
          })}
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* XP Table */}
      <section className="pl-2">
        <h3 className="text-terminal-green font-bold text-sm mb-1">
          XP PROGRESSION
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-4 gap-y-0.5 ml-2 text-xs">
          {Object.entries(config.xpTable).map(([level, xp]) => (
            <span key={level}>
              <span className="text-terminal-amber">Lvl {level}</span>:{" "}
              <span className="text-terminal-green-bright">
                {(xp as number).toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      </section>

      <div className="border-t border-terminal-border" />

      {/* Templates */}
      {tplData && (
        <section className="pl-2">
          <h3 className="text-terminal-green font-bold text-sm mb-1">
            TEMPLATES & WORD POOLS
          </h3>

          {/* Room Description Templates */}
          <div className="ml-2 mb-3">
            <button
              onClick={() => toggle("room-templates")}
              className="text-terminal-amber text-xs hover:text-terminal-green-bright"
            >
              {expandedSection === "room-templates" ? "[-]" : "[+]"} Room
              Description Templates
            </button>
            {expandedSection === "room-templates" && (
              <div className="mt-1 space-y-3">
                {Object.entries(tplData.templates).map(([theme, types]) => (
                  <div key={theme}>
                    <button
                      onClick={() =>
                        setExpandedTemplateTheme(
                          expandedTemplateTheme === theme ? null : theme
                        )
                      }
                      className="text-terminal-amber text-xs hover:text-terminal-green-bright"
                    >
                      {expandedTemplateTheme === theme ? "[-]" : "[+]"}{" "}
                      {theme}
                    </button>
                    {expandedTemplateTheme === theme &&
                      Object.entries(
                        types as Record<
                          string,
                          {
                            templates: string[];
                            slots: Record<string, string[]>;
                          }
                        >
                      ).map(([type, data]) => {
                        const tplKey = `${theme}::${type}`;
                        const isTypeExpanded = expandedTemplateType === tplKey;
                        return (
                          <div key={type} className="ml-2 mb-2">
                            <button
                              onClick={() =>
                                setExpandedTemplateType(
                                  isTypeExpanded ? null : tplKey
                                )
                              }
                              className="text-terminal-green text-xs hover:text-terminal-green-bright"
                            >
                              {isTypeExpanded ? "[-]" : "[+]"} {type} (
                              {data.templates.length} templates)
                            </button>
                            {isTypeExpanded && (
                              <div className="ml-2 mt-1">
                                {/* Template strings */}
                                <p className="text-terminal-dim text-xs mb-1">
                                  Templates:
                                </p>
                                <div className="space-y-0.5 mb-2">
                                  {data.templates.map((t, i) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-1 group"
                                    >
                                      <button
                                        onClick={() =>
                                          handleRemoveTemplate(
                                            type,
                                            theme,
                                            data.templates,
                                            i
                                          )
                                        }
                                        className="text-red-500 hover:text-red-400 text-xs shrink-0 opacity-50 group-hover:opacity-100"
                                        title="Remove template"
                                      >
                                        [DEL]
                                      </button>
                                      <span className="text-terminal-dim text-xs break-all">
                                        {t}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-1 mb-3">
                                  <input
                                    type="text"
                                    value={newTemplateInputs[tplKey] ?? ""}
                                    onChange={(e) =>
                                      setNewTemplateInputs((prev) => ({
                                        ...prev,
                                        [tplKey]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        handleAddTemplate(
                                          type,
                                          theme,
                                          data.templates
                                        );
                                    }}
                                    placeholder="New template string..."
                                    className="bg-black border border-terminal-border text-terminal-green text-xs px-1 py-0.5 flex-1 min-w-0 focus:outline-none focus:border-terminal-green"
                                  />
                                  <button
                                    onClick={() =>
                                      handleAddTemplate(
                                        type,
                                        theme,
                                        data.templates
                                      )
                                    }
                                    className="text-terminal-green hover:text-terminal-green-bright text-xs border border-terminal-border px-1 py-0.5 shrink-0"
                                  >
                                    [ADD]
                                  </button>
                                </div>

                                {/* Slot word pools */}
                                {Object.entries(data.slots).map(
                                  ([slot, words]) => {
                                    const slotKey = `${theme}::${type}::${slot}`;
                                    return (
                                      <div key={slot} className="mb-2">
                                        <p className="text-terminal-amber text-xs mb-1">
                                          {slot} ({words.length} words):
                                        </p>
                                        <div className="flex flex-wrap gap-1 mb-1">
                                          {words.map((w, i) => (
                                            <span
                                              key={i}
                                              className="inline-flex items-center gap-0.5 bg-terminal-border/30 text-terminal-green text-xs px-1 py-0.5 group"
                                            >
                                              {w}
                                              <button
                                                onClick={() =>
                                                  handleRemoveSlotWord(
                                                    type,
                                                    theme,
                                                    slot,
                                                    words,
                                                    i
                                                  )
                                                }
                                                className="text-red-500 hover:text-red-400 opacity-50 group-hover:opacity-100"
                                                title={`Remove "${w}"`}
                                              >
                                                x
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                        <div className="flex gap-1">
                                          <input
                                            type="text"
                                            value={
                                              newSlotWordInputs[slotKey] ?? ""
                                            }
                                            onChange={(e) =>
                                              setNewSlotWordInputs((prev) => ({
                                                ...prev,
                                                [slotKey]: e.target.value,
                                              }))
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                handleAddSlotWord(
                                                  type,
                                                  theme,
                                                  slot,
                                                  words
                                                );
                                            }}
                                            placeholder={`Add to ${slot}...`}
                                            className="bg-black border border-terminal-border text-terminal-green text-xs px-1 py-0.5 flex-1 min-w-0 focus:outline-none focus:border-terminal-green"
                                          />
                                          <button
                                            onClick={() =>
                                              handleAddSlotWord(
                                                type,
                                                theme,
                                                slot,
                                                words
                                              )
                                            }
                                            className="text-terminal-green hover:text-terminal-green-bright text-xs border border-terminal-border px-1 py-0.5 shrink-0"
                                          >
                                            [ADD]
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Word Pools (read-only overview) */}
          <div className="ml-2 mb-3">
            <button
              onClick={() => toggle("word-pools")}
              className="text-terminal-amber text-xs hover:text-terminal-green-bright"
            >
              {expandedSection === "word-pools" ? "[-]" : "[+]"} Word Pools
              (overview)
            </button>
            {expandedSection === "word-pools" &&
              (() => {
                const allSlots: Record<string, string[]> = {};
                for (const types of Object.values(tplData.templates)) {
                  for (const data of Object.values(
                    types as Record<
                      string,
                      { templates: string[]; slots: Record<string, string[]> }
                    >
                  )) {
                    for (const [slot, words] of Object.entries(data.slots)) {
                      if (!allSlots[slot]) allSlots[slot] = [];
                      for (const w of words) {
                        if (!allSlots[slot].includes(w))
                          allSlots[slot].push(w);
                      }
                    }
                  }
                }
                return (
                  <div className="mt-1 space-y-1 ml-2 text-xs">
                    <p className="text-terminal-dim italic">
                      Edit slot words per theme/type in Room Description
                      Templates above.
                    </p>
                    {Object.entries(allSlots).map(([slot, words]) => (
                      <p key={slot}>
                        <span className="text-terminal-green">{slot}</span>
                        <span className="text-terminal-dim">
                          : {words.length} words --{" "}
                          {words.slice(0, 10).join(", ")}
                          {words.length > 10 ? "..." : ""}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              })()}
          </div>

          {/* NPC Names & Store Names - Editable */}
          <div className="ml-2 mb-3">
            <button
              onClick={() => toggle("npc-names")}
              className="text-terminal-amber text-xs hover:text-terminal-green-bright"
            >
              {expandedSection === "npc-names" ? "[-]" : "[+]"} NPC Names &
              Store Names
            </button>
            {expandedSection === "npc-names" && tplData.names && (
              <div className="mt-1 ml-2 text-xs space-y-3">
                {(Object.keys(POOL_LABELS) as PoolName[]).map((pool) => {
                  const entries = tplData.names[pool] as string[];
                  return (
                    <div key={pool}>
                      <p className="text-terminal-green mb-1">
                        {POOL_LABELS[pool]}{" "}
                        <span className="text-terminal-dim">
                          ({entries.length})
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {entries.map((entry, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 bg-terminal-border/30 text-terminal-green text-xs px-1 py-0.5 group"
                          >
                            {entry}
                            <button
                              onClick={() =>
                                handleRemovePoolEntry(pool, entry)
                              }
                              className="text-red-500 hover:text-red-400 opacity-50 group-hover:opacity-100"
                              title={`Remove "${entry}"`}
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={poolInputs[pool]}
                          onChange={(e) =>
                            setPoolInputs((prev) => ({
                              ...prev,
                              [pool]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddPoolEntry(pool);
                          }}
                          placeholder={`Add ${POOL_LABELS[pool].toLowerCase()}...`}
                          className="bg-black border border-terminal-border text-terminal-green text-xs px-1 py-0.5 flex-1 min-w-0 focus:outline-none focus:border-terminal-green"
                        />
                        <button
                          onClick={() => handleAddPoolEntry(pool)}
                          className="text-terminal-green hover:text-terminal-green-bright text-xs border border-terminal-border px-1 py-0.5 shrink-0"
                        >
                          [ADD]
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ConfigVal({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <p>
      <span className="text-terminal-dim">{label}: </span>
      <span className="text-terminal-green-bright">{value}</span>
    </p>
  );
}
