"use client";

import { useEffect, useRef, useState } from "react";
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
  const prevHpRef = useRef<number | null>(null);
  const prevMpRef = useRef<number | null>(null);
  const [hpAnim, setHpAnim] = useState<"damage" | "heal" | null>(null);
  const [mpAnim, setMpAnim] = useState<"damage" | "heal" | null>(null);

  // Detect HP changes for animation
  useEffect(() => {
    if (!player || prevHpRef.current === null) {
      prevHpRef.current = player?.hp ?? null;
      return;
    }
    if (player.hp < prevHpRef.current) {
      setHpAnim("damage");
    } else if (player.hp > prevHpRef.current) {
      setHpAnim("heal");
    }
    prevHpRef.current = player.hp;
    const timer = setTimeout(() => setHpAnim(null), 800);
    return () => clearTimeout(timer);
  }, [player?.hp]);

  // Detect MP changes for animation
  useEffect(() => {
    if (!player || prevMpRef.current === null) {
      prevMpRef.current = player?.mp ?? null;
      return;
    }
    if (player.mp < prevMpRef.current) {
      setMpAnim("damage");
    } else if (player.mp > prevMpRef.current) {
      setMpAnim("heal");
    }
    prevMpRef.current = player.mp;
    const timer = setTimeout(() => setMpAnim(null), 800);
    return () => clearTimeout(timer);
  }, [player?.mp]);

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
        <span className={cn(
          "text-terminal-green-dim transition-all",
          hpAnim === "damage" && "animate-bar-damage",
          hpAnim === "heal" && "animate-bar-heal"
        )}>
          HP:{" "}
          <span className={hpColor(player.hp, player.hpMax)}>
            [{asciiBar(player.hp, player.hpMax)}]
          </span>{" "}
          <span className={hpColor(player.hp, player.hpMax)}>
            {player.hp}/{player.hpMax}
          </span>
        </span>

        {/* MP */}
        <span className={cn(
          "text-terminal-green-dim transition-all",
          mpAnim === "damage" && "animate-bar-damage",
          mpAnim === "heal" && "animate-bar-heal"
        )}>
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

        {/* Companion */}
        {player.companion && player.companion.hp > 0 && (
          <span className="text-terminal-blue">
            Ally: {player.companion.name} ({player.companion.hp}/{player.companion.hpMax})
          </span>
        )}

        {/* Active Buffs */}
        {player.buffs && player.buffs.length > 0 && player.buffs.map((buff, i) => {
          if (buff.type === "shield" && buff.value > 0) {
            return (
              <span key={`buff-${i}`} className="text-terminal-blue">
                Shield: {buff.value}
              </span>
            );
          }
          if (buff.type === "blessing" && buff.combatsRemaining && buff.combatsRemaining > 0) {
            return (
              <span key={`buff-${i}`} className="text-terminal-amber">
                {buff.stat === "attack" ? `+${buff.value} ATK` : `+${buff.value} AC`} ({buff.combatsRemaining})
              </span>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
