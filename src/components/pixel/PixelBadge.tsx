"use client";

import { cn } from "@/lib/utils";
import { SpriteIcon } from "./SpriteIcon";
import type { SpriteId } from "@/lib/sprites";

type BadgeType = "hp" | "mp" | "gold" | "level" | "attack" | "defense";

interface PixelBadgeProps {
  type: BadgeType;
  value: number | string;
  max?: number;
  className?: string;
}

const BADGE_CONFIG: Record<BadgeType, { spriteId: SpriteId; color: string; label: string }> = {
  hp: { spriteId: "ui_heart", color: "text-red-400", label: "HP" },
  mp: { spriteId: "ui_mana", color: "text-blue-400", label: "MP" },
  gold: { spriteId: "ui_coin", color: "text-amber-400", label: "Gold" },
  level: { spriteId: "ui_star", color: "text-green-400", label: "Lv" },
  attack: { spriteId: "ui_sword", color: "text-orange-400", label: "ATK" },
  defense: { spriteId: "ui_shield", color: "text-cyan-400", label: "DEF" },
};

export function PixelBadge({ type, value, max, className }: PixelBadgeProps) {
  const config = BADGE_CONFIG[type];
  const display = max != null ? `${value}/${max}` : String(value);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs",
        config.color,
        className
      )}
      title={`${config.label}: ${display}`}
    >
      <SpriteIcon spriteId={config.spriteId} size={16} />
      <span className="tabular-nums leading-none">{display}</span>
    </div>
  );
}
