"use client";

import { cn } from "@/lib/utils";
import { PixelBadge } from "./PixelBadge";
import { SpriteIcon } from "./SpriteIcon";
import type { PlayerBuff, Companion } from "@/lib/types";

interface HudBarProps {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  name?: string;
  characterClass?: string;
  xp?: number;
  xpNext?: number;
  companion?: Companion | null;
  buffs?: PlayerBuff[];
  className?: string;
}

export function HudBar({
  hp, maxHp, mp, maxMp, gold, level,
  name, characterClass, xp, xpNext, companion, buffs,
  className,
}: HudBarProps) {
  const displayClass = characterClass
    ? characterClass.charAt(0).toUpperCase() + characterClass.slice(1)
    : null;

  return (
    <div
      className={cn(
        "bg-[#0d140d] border-b border-[#1a3a1a]",
        className
      )}
    >
      {/* Header row: name + class */}
      {name && (
        <div className="flex items-center gap-2 px-2 sm:px-3 py-0.5 font-mono text-xs" style={{ color: "#c8e6c8" }}>
          <span className="font-bold truncate" style={{ textShadow: "0 0 8px rgba(51, 255, 51, 0.4)" }}>{name}</span>
          {displayClass && (
            <>
              <span style={{ color: "#145214" }}>&mdash;</span>
              <span style={{ color: "#1a8c1a" }}>Lv.{level} {displayClass}</span>
            </>
          )}
        </div>
      )}

      {/* Badges row */}
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5",
          "flex-wrap",
        )}
      >
        <PixelBadge type="hp" value={hp} max={maxHp} />
        <PixelBadge type="mp" value={mp} max={maxMp} />
        <PixelBadge type="gold" value={gold} />
        {!name && <PixelBadge type="level" value={level} />}
        {xp != null && xpNext != null && (
          <PixelBadge type="xp" value={xp} max={xpNext} />
        )}

        {/* Companion HP */}
        {companion && companion.hp > 0 && (
          <div className="inline-flex items-center gap-1 font-mono text-xs text-blue-400" title={`Ally: ${companion.name}`}>
            <SpriteIcon spriteId="marker_npc" size={14} />
            <span className="tabular-nums leading-none">{companion.name} {companion.hp}/{companion.hpMax}</span>
          </div>
        )}

        {/* Buffs */}
        {buffs?.map((buff, i) => {
          if (buff.type === "shield" && buff.value > 0) {
            return (
              <div key={`buff-${i}`} className="inline-flex items-center gap-1 font-mono text-xs text-cyan-400" title={`Shield: ${buff.value}`}>
                <SpriteIcon spriteId="ui_shield" size={14} />
                <span className="tabular-nums leading-none">{buff.value}</span>
              </div>
            );
          }
          if (buff.type === "blessing" && buff.combatsRemaining && buff.combatsRemaining > 0) {
            const label = buff.stat === "attack" ? `+${buff.value} ATK` : `+${buff.value} AC`;
            return (
              <div key={`buff-${i}`} className="inline-flex items-center gap-1 font-mono text-xs text-amber-400" title={`${label} (${buff.combatsRemaining} combats)`}>
                <SpriteIcon spriteId="ui_star" size={14} />
                <span className="tabular-nums leading-none">{label} ({buff.combatsRemaining})</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
