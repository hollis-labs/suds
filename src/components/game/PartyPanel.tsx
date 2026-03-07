"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useKeyboard } from "@/hooks/useKeyboard";
import type { Companion } from "@/lib/types";

interface PartyPanelProps {
  companion: Companion | null;
  onKick: () => void;
  onClose: () => void;
  className?: string;
}

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

export function PartyPanel({ companion, onKick, onClose, className }: PartyPanelProps) {
  const keyboardHandlers = useMemo(
    () => ({
      Escape: onClose,
      k: () => { if (companion) onKick(); },
      K: () => { if (companion) onKick(); },
    }),
    [onClose, onKick, companion]
  );

  useKeyboard(keyboardHandlers);

  const divider = (
    <div className="text-terminal-border text-xs select-none">
      {"═".repeat(40)}
    </div>
  );

  if (!companion) {
    return (
      <div className={cn("font-mono text-sm space-y-3", className)}>
        {divider}
        <div className="text-center space-y-2">
          <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider">
            Party Members
          </div>
          <div className="text-terminal-border-bright text-xs italic py-4">
            You are traveling alone.
          </div>
          <div className="text-terminal-border text-xs">
            Adventurers may offer to join you during your travels.
          </div>
        </div>
        {divider}
        <div className="text-[10px] text-terminal-border-bright text-center">
          [Esc] Close
        </div>
      </div>
    );
  }

  return (
    <div className={cn("font-mono text-sm space-y-2", className)}>
      {divider}
      <div className="text-center">
        <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider">
          Party Members
        </div>
      </div>
      {divider}

      {/* Player (leader) */}
      <div className="text-xs text-terminal-border-bright italic">
        You (Leader)
      </div>

      {divider}

      {/* Companion card */}
      <div className="space-y-2 border border-terminal-blue/30 p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-terminal-blue font-bold">{companion.name}</span>
            <span className="text-terminal-border-bright ml-2 text-xs">
              Level {companion.level} {companion.class.charAt(0).toUpperCase() + companion.class.slice(1)}
            </span>
          </div>
        </div>

        {/* Personality */}
        <div className="text-terminal-amber-dim text-xs italic">
          &quot;{companion.personality}&quot;
        </div>

        {/* HP bar */}
        <div className="text-xs">
          <span className="text-terminal-border-bright">HP: </span>
          <span className={hpColor(companion.hp, companion.hpMax)}>
            {companion.hp}/{companion.hpMax}
          </span>
          <span className={cn("ml-2", hpColor(companion.hp, companion.hpMax))}>
            [{asciiBar(companion.hp, companion.hpMax)}]
          </span>
        </div>

        {/* Combat stats */}
        <div className="text-xs space-y-0.5">
          <div>
            <span className="text-terminal-border-bright">AC: </span>
            <span className="text-terminal-green">{companion.ac}</span>
            <span className="text-terminal-border-bright ml-4">ATK: </span>
            <span className="text-terminal-green">+{companion.attack}</span>
            <span className="text-terminal-border-bright ml-4">DMG: </span>
            <span className="text-terminal-green">{companion.damage}</span>
          </div>
        </div>

        {/* Abilities */}
        {companion.abilities.length > 0 && (
          <div className="text-xs">
            <span className="text-terminal-border-bright">Abilities: </span>
            <span className="text-terminal-green-dim">
              {companion.abilities
                .map((a) => a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
                .join(", ")}
            </span>
          </div>
        )}

        {/* Kick button */}
        <div className="pt-1">
          <button
            onClick={(e) => { onKick(); e.currentTarget.blur(); }}
            className="text-terminal-red text-xs border border-terminal-red/50 px-2 py-1 hover:bg-terminal-red/10 transition-colors"
          >
            [K] Dismiss from Party
          </button>
        </div>
      </div>

      {divider}
      <div className="text-[10px] text-terminal-border-bright text-center">
        [K] Kick · [Esc] Close
      </div>
    </div>
  );
}
