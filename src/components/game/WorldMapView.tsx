"use client";

import { cn } from "@/lib/utils";
import { PixelCard } from "@/components/pixel/PixelCard";
import { SpriteIcon } from "@/components/pixel/SpriteIcon";
import type { SpriteId } from "@/lib/sprites";

export interface WorldRegionNode {
  id: string;
  name: string;
  description: string;
  theme: string;
  position: { x: number; y: number };
  discovered: boolean;
  connections?: string[];
}

interface WorldMapViewProps {
  regions: WorldRegionNode[];
  currentRegionId?: string;
  onSelectRegion: (regionId: string) => void;
}

const THEME_ICON: Record<string, SpriteId> = {
  horror: "ui_skull",
  funny: "ui_star",
  epic: "ui_sword",
  dark_fantasy: "ui_shield",
};

const THEME_COLOR: Record<string, string> = {
  horror: "border-red-700 hover:border-red-500",
  funny: "border-yellow-600 hover:border-yellow-400",
  epic: "border-amber-500 hover:border-amber-300",
  dark_fantasy: "border-purple-700 hover:border-purple-500",
};

export function WorldMapView({
  regions,
  currentRegionId,
  onSelectRegion,
}: WorldMapViewProps) {
  // Build a set of region IDs for connection line lookups
  const regionById = new Map(regions.map((r) => [r.id, r]));

  // Normalize positions to fit within the layout
  const minX = Math.min(...regions.map((r) => r.position.x));
  const maxX = Math.max(...regions.map((r) => r.position.x));
  const minY = Math.min(...regions.map((r) => r.position.y));
  const maxY = Math.max(...regions.map((r) => r.position.y));
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Compute connection lines (SVG coordinates)
  const connections: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const seen = new Set<string>();
  for (const region of regions) {
    if (!region.connections) continue;
    for (const connId of region.connections) {
      const key = [region.id, connId].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const target = regionById.get(connId);
      if (!target) continue;
      connections.push({
        x1: ((region.position.x - minX) / rangeX) * 80 + 10,
        y1: ((region.position.y - minY) / rangeY) * 70 + 15,
        x2: ((target.position.x - minX) / rangeX) * 80 + 10,
        y2: ((target.position.y - minY) / rangeY) * 70 + 15,
      });
    }
  }

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gray-950 rounded overflow-hidden">
      {/* Title */}
      <div className="absolute top-3 left-0 right-0 text-center z-10">
        <h2 className="font-mono text-sm text-amber-400 font-bold tracking-wider uppercase">
          World Map
        </h2>
      </div>

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        {connections.map((c, i) => (
          <line
            key={i}
            x1={`${c.x1}%`}
            y1={`${c.y1}%`}
            x2={`${c.x2}%`}
            y2={`${c.y2}%`}
            stroke="rgba(120, 113, 108, 0.4)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        ))}
      </svg>

      {/* Region nodes */}
      {regions.map((region) => {
        const isCurrent = region.id === currentRegionId;
        const pctX = ((region.position.x - minX) / rangeX) * 80 + 10;
        const pctY = ((region.position.y - minY) / rangeY) * 70 + 15;
        const icon = THEME_ICON[region.theme] ?? "ui_star";
        const colorClass = THEME_COLOR[region.theme] ?? "border-gray-600 hover:border-gray-400";

        if (!region.discovered) {
          return (
            <div
              key={region.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pctX}%`, top: `${pctY}%` }}
            >
              <div className="w-16 h-16 flex items-center justify-center rounded border-2 border-gray-800 bg-gray-900/80 opacity-40">
                <span className="font-mono text-xs text-gray-600">???</span>
              </div>
            </div>
          );
        }

        return (
          <div
            key={region.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pctX}%`, top: `${pctY}%` }}
          >
            <button
              onClick={() => onSelectRegion(region.id)}
              className={cn(
                "group flex flex-col items-center gap-1 cursor-pointer transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
              )}
            >
              <PixelCard
                className={cn(
                  "w-20 border-2 transition-all",
                  colorClass,
                  isCurrent && "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                )}
              >
                <div className="flex flex-col items-center gap-1 py-1">
                  <SpriteIcon spriteId={icon} size={28} />
                </div>
              </PixelCard>
              <span
                className={cn(
                  "font-mono text-[10px] text-center leading-tight max-w-24 transition-colors",
                  isCurrent ? "text-amber-300" : "text-gray-400 group-hover:text-gray-200"
                )}
              >
                {region.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
