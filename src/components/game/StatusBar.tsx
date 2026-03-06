"use client";

import { cn } from "@/lib/utils";
import type { Player } from "@/lib/types";

interface StatusBarProps {
  player: Player | null;
  className?: string;
}

function asciiBar(current: number, max: number, width: number = 12): string {
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

export function StatusBar({ player, className }: StatusBarProps) {
  if (!player) {
    return (
      <div
        className={cn(
          "font-mono text-xs text-terminal-green-dim px-2 py-1",
          className
        )}
      >
        NO SIGNAL
      </div>
    );
  }

  const displayClass =
    player.class.charAt(0).toUpperCase() + player.class.slice(1);

  return (
    <div className={cn("font-mono text-xs space-y-0.5", className)}>
      {/* Line 1: Identity */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-terminal-green terminal-glow font-bold">
          SUDS
        </span>
        <span className="text-terminal-border">|</span>
        <span className="text-terminal-green">{player.name}</span>
        <span className="text-terminal-border">|</span>
        <span className="text-terminal-green-dim">
          Lv.{player.level} {displayClass}
        </span>
        <span className="text-terminal-border">|</span>
        <span className="text-terminal-green-dim">
          Pos ({player.position.x},{player.position.y})
        </span>
      </div>

      {/* Line 2: Bars */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* HP */}
        <span className="text-terminal-green-dim">
          HP:{" "}
          <span className={hpColor(player.hp, player.hpMax)}>
            [{asciiBar(player.hp, player.hpMax)}]
          </span>{" "}
          <span className={hpColor(player.hp, player.hpMax)}>
            {player.hp}/{player.hpMax}
          </span>
        </span>

        {/* MP */}
        <span className="text-terminal-green-dim">
          MP:{" "}
          <span className="text-terminal-blue">
            [{asciiBar(player.mp, player.mpMax)}]
          </span>{" "}
          <span className="text-terminal-blue">
            {player.mp}/{player.mpMax}
          </span>
        </span>

        {/* Gold */}
        <span className="text-terminal-green-dim">
          Gold:{" "}
          <span className="text-terminal-gold">{player.gold}</span>
        </span>

        {/* XP */}
        <span className="text-terminal-green-dim">
          XP:{" "}
          <span className="text-terminal-purple">
            [{asciiBar(player.xp, player.xpNext, 8)}]
          </span>{" "}
          <span className="text-terminal-purple">
            {player.xp}/{player.xpNext}
          </span>
        </span>
      </div>
    </div>
  );
}
