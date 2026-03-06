"use client";

import { cn } from "@/lib/utils";
import { statModifier } from "@/lib/constants";
import type { Stats } from "@/lib/types";

interface StatBlockProps {
  stats: Stats;
  className?: string;
}

const STAT_LABELS: { key: keyof Stats; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

function formatModifier(mod: number): string {
  if (mod >= 0) return `+${mod}`;
  return `${mod}`;
}

function modifierColor(mod: number): string {
  if (mod > 0) return "text-terminal-green";
  if (mod < 0) return "text-terminal-red";
  return "text-terminal-green-dim";
}

export function StatBlock({ stats, className }: StatBlockProps) {
  const topRow = STAT_LABELS.slice(0, 3);
  const bottomRow = STAT_LABELS.slice(3);

  function renderRow(row: typeof STAT_LABELS) {
    return (
      <div className="flex gap-4">
        {row.map(({ key, label }) => {
          const value = stats[key];
          const mod = statModifier(value);
          const modStr = formatModifier(mod);

          return (
            <span key={key} className="text-terminal-green-dim">
              {label}:{" "}
              <span className="text-terminal-green">
                {String(value).padStart(2, " ")}
              </span>{" "}
              <span className={cn("text-xs", modifierColor(mod))}>
                ({modStr})
              </span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("font-mono text-sm space-y-1", className)}>
      {renderRow(topRow)}
      {renderRow(bottomRow)}
    </div>
  );
}
