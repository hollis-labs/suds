"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { TerminalText } from "@/components/terminal";
import { DiceRoller } from "@/components/game/DiceRoller";
import { ABILITY_INFO } from "@/lib/abilities";
import { RARITY } from "@/lib/constants";
import type { CombatState, CombatAction, Player, Monster, GameItem } from "@/lib/types";

type ActionPhase =
  | "choose_action"
  | "choose_target"
  | "choose_ability"
  | "choose_item"
  | "enemy_turn"
  | "resolving";

interface CombatPanelProps {
  combatState: CombatState;
  player: Player;
  onAction: (action: CombatAction, targetIndex?: number, itemId?: string) => void;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function asciiHpBar(current: number, max: number, width: number = 16): string {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function hpBarColor(current: number, max: number): string {
  const ratio = max > 0 ? current / max : 0;
  if (ratio > 0.5) return "text-terminal-green";
  if (ratio > 0.25) return "text-terminal-amber";
  return "text-terminal-red";
}

function logEntryColor(entry: { actor: string; action: string }, playerName?: string): string {
  // Player actions green, companion actions blue, monster actions red, status/other yellow
  if (entry.actor === "player" || entry.actor === "Player" || entry.actor === playerName) {
    return "text-terminal-green";
  }
  if (entry.action === "status" || entry.action === "info") {
    return "text-terminal-amber";
  }
  // Check if the actor name suggests a companion (contains "the Warrior/Mage/etc")
  if (entry.actor.includes(" the ")) {
    return "text-terminal-blue";
  }
  return "text-terminal-red";
}

function isPlayerTurn(combatState: CombatState): boolean {
  const current = combatState.turnOrder[combatState.currentTurn];
  return current?.type === "player";
}

function getUsableItems(player: Player): GameItem[] {
  // Filter for potions and scrolls that can be used in combat
  // Player equipment has items; we look for consumables
  // Since Player type doesn't have an inventory array, we rely on
  // the abilities/items passed. For now, return empty — the parent
  // component should provide usable items via the player object or
  // a separate prop. We'll check for items in equipment that are potions/scrolls.
  return [];
}

// ── Monster Card ─────────────────────────────────────────────────────

function MonsterCard({
  monster,
  index,
  isTarget,
  isDead,
}: {
  monster: Monster;
  index: number;
  isTarget: boolean;
  isDead: boolean;
}) {
  return (
    <div
      className={cn(
        "border border-terminal-border px-3 py-2 min-w-[180px]",
        isTarget && "border-terminal-green bg-terminal-green/5",
        isDead && "opacity-40"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-sm font-bold",
            isDead ? "text-terminal-border line-through" : "text-terminal-red"
          )}
        >
          {isTarget && <span className="text-terminal-green mr-1">&gt;</span>}
          {monster.name}
        </span>
        <span className="text-[10px] text-terminal-border-bright">
          Lv.{monster.level}
        </span>
      </div>

      <div className="mt-1 text-xs">
        <span className="text-terminal-border-bright">HP: </span>
        <span className={hpBarColor(monster.hp, monster.hpMax)}>
          [{asciiHpBar(monster.hp, monster.hpMax, 12)}]
        </span>
        <span className={cn("ml-1", hpBarColor(monster.hp, monster.hpMax))}>
          {monster.hp}/{monster.hpMax}
        </span>
      </div>

      <div className="mt-0.5 text-[10px] text-terminal-border-bright">
        AC: {monster.ac} | ATK: +{monster.attack} | DMG: {monster.damage}
      </div>
    </div>
  );
}

// ── Combat Log ───────────────────────────────────────────────────────

function getDiceInfo(entry: CombatState["log"][number]): { value: number; sides: number } | null {
  const action = entry.action;
  // Actions that involve a d20 roll
  const rollActions = ["attack", "cast", "flee", "defend", "info"];
  if (!rollActions.includes(action) && !action.includes("_")) return null;

  if (entry.damage !== undefined && entry.damage > 0) {
    // Hit — show damage value
    return { value: entry.damage, sides: 20 };
  }

  // Miss, flee, initiative, defend, special abilities — show a d20 roll
  const result = entry.result.toLowerCase();
  if (result.includes("miss") || result.includes("fumble")) {
    return { value: Math.floor(Math.random() * 5) + 1, sides: 20 };
  }
  if (result.includes("initiative") || result.includes("rolling")) {
    return { value: Math.floor(Math.random() * 15) + 5, sides: 20 };
  }
  if (result.includes("fled") || result.includes("flee") || result.includes("escaped")) {
    return { value: Math.floor(Math.random() * 10) + 10, sides: 20 };
  }
  if (result.includes("failed to flee")) {
    return { value: Math.floor(Math.random() * 5) + 1, sides: 20 };
  }
  if (result.includes("defensive") || result.includes("stance")) {
    return { value: Math.floor(Math.random() * 6) + 1, sides: 6 };
  }
  // Special monster abilities
  if (action !== "info" && action !== "status") {
    return { value: entry.damage ?? Math.floor(Math.random() * 12) + 1, sides: 20 };
  }

  return null;
}

function CombatLog({ log }: { log: CombatState["log"] }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [diceComplete, setDiceComplete] = useState(false);
  const [diceKey, setDiceKey] = useState(0);
  const prevLogLen = useRef(log.length);

  // Reset dice animation when new entries arrive
  useEffect(() => {
    if (log.length > prevLogLen.current) {
      setDiceComplete(false);
      setDiceKey((k) => k + 1);
    }
    prevLogLen.current = log.length;
  }, [log.length]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length, diceComplete]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 border border-terminal-border p-2">
      <div className="space-y-0.5 text-[11px] font-mono">
        {log.length === 0 ? (
          <p className="text-terminal-border-bright italic">
            Combat begins...
          </p>
        ) : (
          log.map((entry, i) => {
            const isLast = i === log.length - 1;
            const color = logEntryColor(entry);
            const diceInfo = isLast && !diceComplete ? getDiceInfo(entry) : null;

            return (
              <p key={i} className={cn(color, isLast && "font-bold")}>
                <span className="text-terminal-border mr-1">
                  [{entry.round}]
                </span>
                {diceInfo && (
                  <DiceRoller
                    key={diceKey}
                    finalValue={diceInfo.value}
                    sides={diceInfo.sides}
                    duration={1800}
                    onComplete={() => setDiceComplete(true)}
                    className="mr-1.5"
                  />
                )}
                {isLast && !diceInfo ? (
                  <TerminalText text={entry.result} speed={15} animate={true} />
                ) : isLast && diceInfo ? (
                  <span className="text-terminal-green-dim">{entry.result}</span>
                ) : (
                  entry.result
                )}
              </p>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function CombatPanel({
  combatState,
  player,
  onAction,
  className,
}: CombatPanelProps) {
  const [actionPhase, setActionPhase] = useState<ActionPhase>("choose_action");
  const [selectedAction, setSelectedAction] = useState<CombatAction | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number>(0);

  const playerTurn = isPlayerTurn(combatState);
  const aliveMonsters = combatState.monsters.filter((m) => m.hp > 0);

  // Reset phase when turn changes
  // Include round + log length to handle cases where currentTurn stays at same index
  useEffect(() => {
    if (playerTurn) {
      setActionPhase("choose_action");
      setSelectedAction(null);
      setSelectedTarget(0);
    } else {
      setActionPhase("enemy_turn");
    }
  }, [combatState.currentTurn, combatState.round, combatState.log.length, playerTurn]);

  // Safety: if the server returned a state where it's the enemy's turn,
  // auto-fire an action to resolve monster turns server-side.
  const [autoResolveAttempted, setAutoResolveAttempted] = useState(false);
  useEffect(() => {
    if (!playerTurn && !autoResolveAttempted) {
      setAutoResolveAttempted(true);
      // Send a dummy action — the server will resolve the monster turn
      // since resolveTurn dispatches based on whose turn it actually is
      const timer = setTimeout(() => {
        onAction("attack");
      }, 500);
      return () => clearTimeout(timer);
    }
    if (playerTurn) {
      setAutoResolveAttempted(false);
    }
  }, [playerTurn, autoResolveAttempted, onAction]);

  // Get combat-usable abilities for the player
  const combatAbilities = useMemo(() => {
    return player.abilities
      .filter((id) => {
        const info = ABILITY_INFO[id];
        return info && info.type !== "utility";
      })
      .map((id) => ({
        id,
        ...(ABILITY_INFO[id] ?? {
          name: id,
          description: "",
          mpCost: 0,
          type: "attack" as const,
        }),
      }));
  }, [player.abilities]);

  // ── Action handlers ──

  const handleActionSelect = useCallback(
    (action: CombatAction) => {
      switch (action) {
        case "attack":
          if (aliveMonsters.length === 1) {
            // Single target, skip target selection
            onAction("attack", 0);
          } else {
            setSelectedAction("attack");
            setActionPhase("choose_target");
            setSelectedTarget(0);
          }
          break;
        case "defend":
          onAction("defend");
          break;
        case "cast":
          if (combatAbilities.length === 0) return;
          setSelectedAction("cast");
          setActionPhase("choose_ability");
          break;
        case "flee":
          onAction("flee");
          break;
        case "use_item":
          setSelectedAction("use_item");
          setActionPhase("choose_item");
          break;
      }
    },
    [aliveMonsters.length, combatAbilities.length, onAction]
  );

  const handleTargetSelect = useCallback(
    (index: number) => {
      if (selectedAction) {
        onAction(selectedAction, index);
        setActionPhase("resolving");
      }
    },
    [selectedAction, onAction]
  );

  const handleAbilitySelect = useCallback(
    (abilityIndex: number) => {
      const ability = combatAbilities[abilityIndex];
      if (!ability || ability.mpCost > player.mp) return;

      if (ability.type === "attack" && aliveMonsters.length > 1) {
        setSelectedAction("cast");
        setActionPhase("choose_target");
        setSelectedTarget(0);
      } else {
        onAction("cast", 0, ability.id);
        setActionPhase("resolving");
      }
    },
    [combatAbilities, player.mp, aliveMonsters.length, onAction]
  );

  const handleBack = useCallback(() => {
    setActionPhase("choose_action");
    setSelectedAction(null);
    setSelectedTarget(0);
  }, []);

  // ── Keyboard handlers ──

  const keyboardHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    if (!playerTurn) return handlers;

    if (actionPhase === "choose_action") {
      handlers["1"] = () => handleActionSelect("attack");
      handlers["2"] = () => handleActionSelect("defend");
      handlers["3"] = () => handleActionSelect("cast");
      handlers["4"] = () => handleActionSelect("flee");
      handlers["5"] = () => handleActionSelect("use_item");
    } else if (actionPhase === "choose_target") {
      aliveMonsters.forEach((_, i) => {
        handlers[String(i + 1)] = () => handleTargetSelect(i);
      });
      handlers["Escape"] = handleBack;
    } else if (actionPhase === "choose_ability") {
      combatAbilities.forEach((_, i) => {
        handlers[String(i + 1)] = () => handleAbilitySelect(i);
      });
      handlers["Escape"] = handleBack;
    } else if (actionPhase === "choose_item") {
      handlers["Escape"] = handleBack;
    }

    return handlers;
  }, [
    playerTurn,
    actionPhase,
    aliveMonsters,
    combatAbilities,
    handleActionSelect,
    handleTargetSelect,
    handleAbilitySelect,
    handleBack,
  ]);

  useKeyboard(keyboardHandlers);

  // ── Render ──

  return (
    <div className={cn("flex flex-col h-full font-mono gap-2", className)}>
      {/* ── Round indicator ── */}
      <div className="shrink-0 text-[10px] text-terminal-border-bright text-center uppercase tracking-widest">
        -- Round {combatState.round} --
      </div>

      {/* ── Monster Section (top ~30%) ── */}
      <div className="shrink-0">
        <div className="flex flex-wrap gap-2 justify-center">
          {combatState.monsters.map((monster, i) => (
            <MonsterCard
              key={monster.id}
              monster={monster}
              index={i}
              isTarget={
                actionPhase === "choose_target" && selectedTarget === i
              }
              isDead={monster.hp <= 0}
            />
          ))}
        </div>
      </div>

      {/* ── Companion (if present) ── */}
      {combatState.companion && combatState.companion.hp > 0 && (
        <div className="shrink-0 flex justify-center">
          <div className="border border-terminal-blue/40 px-3 py-1.5 min-w-[180px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-terminal-blue">
                {combatState.companion.name}
              </span>
              <span className="text-[10px] text-terminal-border-bright">
                Ally Lv.{combatState.companion.level}
              </span>
            </div>
            <div className="mt-0.5 text-xs">
              <span className="text-terminal-border-bright">HP: </span>
              <span className={hpBarColor(combatState.companion.hp, combatState.companion.hpMax)}>
                [{asciiHpBar(combatState.companion.hp, combatState.companion.hpMax, 12)}]
              </span>
              <span className={cn("ml-1", hpBarColor(combatState.companion.hp, combatState.companion.hpMax))}>
                {combatState.companion.hp}/{combatState.companion.hpMax}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Combat Log (middle ~30%) ── */}
      <CombatLog log={combatState.log} />

      {/* ── Action Menu (bottom ~40%) ── */}
      <div className="shrink-0 border border-terminal-border p-2">
        {/* Player HP/MP status line */}
        <div className="text-xs mb-2 flex gap-4">
          <span>
            <span className="text-terminal-border-bright">HP: </span>
            <span className={hpBarColor(player.hp, player.hpMax)}>
              {player.hp}/{player.hpMax}
            </span>
          </span>
          <span>
            <span className="text-terminal-border-bright">MP: </span>
            <span className="text-terminal-blue">
              {player.mp}/{player.mpMax}
            </span>
          </span>
        </div>

        {/* Action phase content */}
        {actionPhase === "enemy_turn" && (
          <div className="text-terminal-red text-sm animate-pulse">
            Enemy turn...
          </div>
        )}

        {actionPhase === "resolving" && (
          <div className="text-terminal-amber text-sm animate-pulse">
            Resolving...
          </div>
        )}

        {actionPhase === "choose_action" && playerTurn && (
          <div className="space-y-0.5">
            <div className="text-[10px] text-terminal-border-bright mb-1 uppercase tracking-wider">
              Choose action:
            </div>
            {[
              { key: "1", label: "ATTACK", action: "attack" as CombatAction },
              { key: "2", label: "DEFEND", action: "defend" as CombatAction },
              {
                key: "3",
                label: "CAST",
                action: "cast" as CombatAction,
                disabled: combatAbilities.length === 0,
              },
              { key: "4", label: "FLEE", action: "flee" as CombatAction },
              { key: "5", label: "USE ITEM", action: "use_item" as CombatAction },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => !opt.disabled && handleActionSelect(opt.action)}
                disabled={opt.disabled}
                className={cn(
                  "block text-left text-sm px-1 py-0.5 transition-colors w-full",
                  opt.disabled
                    ? "text-terminal-border opacity-50 cursor-not-allowed"
                    : "text-terminal-green hover:bg-terminal-green/5 hover:terminal-glow"
                )}
              >
                <span className="text-terminal-green">[{opt.key}]</span>{" "}
                {opt.label}
                {opt.action === "cast" && combatAbilities.length === 0 && (
                  <span className="text-terminal-border text-[10px] ml-2">
                    (no abilities)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {actionPhase === "choose_target" && (
          <div className="space-y-0.5">
            <div className="text-[10px] text-terminal-border-bright mb-1 uppercase tracking-wider">
              Select target: <span className="text-terminal-green-dim">[Esc] Back</span>
            </div>
            {aliveMonsters.map((monster, i) => (
              <button
                key={monster.id}
                onClick={() => handleTargetSelect(i)}
                onMouseEnter={() => setSelectedTarget(i)}
                className={cn(
                  "block text-left text-sm px-1 py-0.5 transition-colors w-full",
                  selectedTarget === i
                    ? "text-terminal-green bg-terminal-green/5 terminal-glow"
                    : "text-terminal-green-dim"
                )}
              >
                <span className="text-terminal-green">[{i + 1}]</span>{" "}
                {monster.name}{" "}
                <span className={cn("text-[10px]", hpBarColor(monster.hp, monster.hpMax))}>
                  ({monster.hp}/{monster.hpMax})
                </span>
              </button>
            ))}
          </div>
        )}

        {actionPhase === "choose_ability" && (
          <div className="space-y-0.5">
            <div className="text-[10px] text-terminal-border-bright mb-1 uppercase tracking-wider">
              Cast ability: <span className="text-terminal-green-dim">[Esc] Back</span>
            </div>
            {combatAbilities.map((ability, i) => {
              const canAfford = player.mp >= ability.mpCost;
              return (
                <button
                  key={ability.id}
                  onClick={() => canAfford && handleAbilitySelect(i)}
                  disabled={!canAfford}
                  className={cn(
                    "block text-left text-sm px-1 py-0.5 transition-colors w-full",
                    !canAfford
                      ? "text-terminal-border opacity-50 cursor-not-allowed"
                      : "text-terminal-green hover:bg-terminal-green/5"
                  )}
                >
                  <span className="text-terminal-green">[{i + 1}]</span>{" "}
                  {ability.name}
                  <span className="text-terminal-blue text-[10px] ml-2">
                    {ability.mpCost > 0 ? `${ability.mpCost} MP` : "Free"}
                  </span>
                  <span className="text-terminal-border-bright text-[10px] ml-2">
                    {ability.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {actionPhase === "choose_item" && (
          <div className="space-y-0.5">
            <div className="text-[10px] text-terminal-border-bright mb-1 uppercase tracking-wider">
              Use item: <span className="text-terminal-green-dim">[Esc] Back</span>
            </div>
            <p className="text-terminal-border-bright text-xs italic">
              No usable items in inventory.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
