"use client";

import { cn } from "@/lib/utils";
import { PixelBadge } from "./PixelBadge";

interface HudBarProps {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  className?: string;
}

export function HudBar({ hp, maxHp, mp, maxMp, gold, level, className }: HudBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 bg-black/80 border-b border-gray-700",
        "flex-wrap",
        className
      )}
    >
      <PixelBadge type="hp" value={hp} max={maxHp} />
      <PixelBadge type="mp" value={mp} max={maxMp} />
      <PixelBadge type="gold" value={gold} />
      <PixelBadge type="level" value={level} />
    </div>
  );
}
