"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import { statModifier } from "@/lib/constants";
import { ABILITY_INFO } from "@/lib/abilities";
import { StatBlock } from "@/components/game/StatBlock";
import type { Player } from "@/lib/types";

interface CharacterSheetProps {
  player: Player;
  onClose: () => void;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function asciiBar(current: number, max: number, width: number = 14): string {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function hpColor(current: number, max: number): string {
  const ratio = max > 0 ? current / max : 0;
  if (ratio > 0.5) return "text-terminal-green";
  if (ratio > 0.25) return "text-terminal-amber";
  return "text-terminal-red";
}

function displayClass(cls: string): string {
  return cls.charAt(0).toUpperCase() + cls.slice(1);
}

function displayTheme(theme: string): string {
  return theme
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function equipmentLine(label: string, item: { name: string; stats: Record<string, number> } | undefined): { label: string; value: string; detail: string } {
  if (!item) {
    return { label, value: "(none)", detail: "" };
  }

  const statParts = Object.entries(item.stats)
    .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
    .join(", ");

  return {
    label,
    value: item.name,
    detail: statParts ? `(${statParts})` : "",
  };
}

// ── Main Component ───────────────────────────────────────────────────

export function CharacterSheet({
  player,
  onClose,
  className,
}: CharacterSheetProps) {
  // XP progress
  const xpPercent =
    player.xpNext > 0
      ? Math.round((player.xp / player.xpNext) * 100)
      : 0;

  // Equipment lines
  const equipLines = useMemo(
    () => {
      const lines = [
        equipmentLine("Weapon", player.equipment.weapon),
        equipmentLine("Armor", player.equipment.armor),
      ];
      if (player.equipment.ring) lines.push(equipmentLine("Ring", player.equipment.ring));
      if (player.equipment.amulet) lines.push(equipmentLine("Amulet", player.equipment.amulet));
      if (player.equipment.boots) lines.push(equipmentLine("Boots", player.equipment.boots));
      if (player.equipment.accessory) lines.push(equipmentLine("Access", player.equipment.accessory));
      return lines;
    },
    [player.equipment]
  );

  // Ability details
  const abilityDetails = useMemo(
    () =>
      player.abilities.map((id) => {
        const info = ABILITY_INFO[id];
        return {
          id,
          name: info?.name ?? id.replace(/_/g, " ").toUpperCase(),
          description: info?.description ?? "Unknown ability.",
          mpCost: info?.mpCost ?? 0,
        };
      }),
    [player.abilities]
  );

  // ── Keyboard ──

  const keyboardHandlers = useMemo(
    () => ({
      Escape: onClose,
    }),
    [onClose]
  );

  useKeyboard(keyboardHandlers);

  // ── Render ──

  const divider = (
    <div className="text-terminal-border text-xs select-none">
      {"═".repeat(40)}
    </div>
  );

  return (
    <div className={cn("font-mono text-sm space-y-2", className)}>
      {/* Header */}
      {divider}
      <div className="text-center">
        <div className="text-terminal-green terminal-glow font-bold">
          {player.name} — Level {player.level} {displayClass(player.class)}
        </div>
        <div className="text-terminal-border-bright text-xs">
          Theme: {displayTheme(player.theme)}
        </div>
      </div>
      {divider}

      {/* Stats section */}
      <div className="space-y-1">
        <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider">
          Stats
        </div>
        <StatBlock stats={player.stats} />
      </div>

      {/* Vitals section */}
      <div className="space-y-1">
        <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider">
          Vitals
        </div>
        <div className="text-xs space-y-0.5">
          {/* HP */}
          <div>
            <span className="text-terminal-border-bright">HP: </span>
            <span className={hpColor(player.hp, player.hpMax)}>
              {player.hp}/{player.hpMax}
            </span>
            <span className="text-terminal-border-bright ml-4">MP: </span>
            <span className="text-terminal-blue">
              {player.mp}/{player.mpMax}
            </span>
            <span className="text-terminal-border-bright ml-4">AC: </span>
            <span className="text-terminal-green">{player.ac}</span>
            <span className="text-terminal-border-bright ml-4">Gold: </span>
            <span className="text-terminal-gold">{player.gold}</span>
          </div>
        </div>
      </div>

      {/* XP bar */}
      <div className="space-y-1">
        <div className="text-xs">
          <span className="text-terminal-border-bright">XP: </span>
          <span className="text-terminal-purple">
            {player.xp}/{player.xpNext}
          </span>
          <span className="text-terminal-purple ml-2">
            [{asciiBar(player.xp, player.xpNext)}]
          </span>
          <span className="text-terminal-border-bright ml-2">
            ({xpPercent}%)
          </span>
        </div>
      </div>

      {/* Equipment section */}
      <div className="space-y-1">
        <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider">
          Equipment
        </div>
        <div className="text-xs space-y-0.5">
          {equipLines.map((line) => (
            <div key={line.label}>
              <span className="text-terminal-border-bright w-16 inline-block">
                {line.label}:
              </span>{" "}
              <span
                className={cn(
                  line.value === "(none)"
                    ? "text-terminal-border"
                    : "text-terminal-green"
                )}
              >
                {line.value}
              </span>
              {line.detail && (
                <span className="text-terminal-green-dim ml-1">
                  {line.detail}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Abilities section */}
      <div className="space-y-1">
        <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider">
          Abilities
        </div>
        <div className="text-xs space-y-0.5">
          {abilityDetails.length === 0 ? (
            <div className="text-terminal-border-bright italic">
              No abilities learned.
            </div>
          ) : (
            abilityDetails.map((ability) => (
              <div key={ability.id}>
                <span className="text-terminal-green">- {ability.name}</span>
                <span className="text-terminal-border-bright">
                  : {ability.description}
                </span>
                {ability.mpCost > 0 && (
                  <span className="text-terminal-blue ml-1">
                    ({ability.mpCost} MP)
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      {divider}
      <div className="text-[10px] text-terminal-border-bright text-center">
        [Esc] Close
      </div>
    </div>
  );
}
