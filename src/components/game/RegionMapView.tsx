"use client";

import { cn } from "@/lib/utils";
import { PixelCard } from "@/components/pixel/PixelCard";
import { PixelButton } from "@/components/pixel/PixelButton";
import { SpriteIcon } from "@/components/pixel/SpriteIcon";
import type { SpriteId } from "@/lib/sprites";

export interface RegionAreaNode {
  id: string;
  name: string;
  description: string;
  areaType: string;
  position: { x: number; y: number };
  discovered: boolean;
  connections?: string[];
}

interface RegionMapViewProps {
  regionName: string;
  areas: RegionAreaNode[];
  currentAreaId?: string;
  onSelectArea: (areaId: string) => void;
  onBack: () => void;
}

const AREA_TYPE_ICON: Record<string, SpriteId> = {
  town: "building_tavern",
  wilderness: "terrain_forest",
  ruins: "building_ruins",
  fortress: "building_castle",
  dungeon_entrance: "building_dungeon",
  dungeon: "building_dungeon",
};

const AREA_TYPE_COLOR: Record<string, string> = {
  town: "border-amber-600 hover:border-amber-400",
  wilderness: "border-green-700 hover:border-green-500",
  ruins: "border-stone-600 hover:border-stone-400",
  fortress: "border-slate-500 hover:border-slate-300",
  dungeon_entrance: "border-red-800 hover:border-red-600",
  dungeon: "border-red-800 hover:border-red-600",
};

export function RegionMapView({
  regionName,
  areas,
  currentAreaId,
  onSelectArea,
  onBack,
}: RegionMapViewProps) {
  const areaById = new Map(areas.map((a) => [a.id, a]));

  // Normalize positions
  const minX = Math.min(...areas.map((a) => a.position.x));
  const maxX = Math.max(...areas.map((a) => a.position.x));
  const minY = Math.min(...areas.map((a) => a.position.y));
  const maxY = Math.max(...areas.map((a) => a.position.y));
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Connection lines
  const connections: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const seen = new Set<string>();
  for (const area of areas) {
    if (!area.connections) continue;
    for (const connId of area.connections) {
      const key = [area.id, connId].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const target = areaById.get(connId);
      if (!target) continue;
      connections.push({
        x1: ((area.position.x - minX) / rangeX) * 80 + 10,
        y1: ((area.position.y - minY) / rangeY) * 65 + 20,
        x2: ((target.position.x - minX) / rangeX) * 80 + 10,
        y2: ((target.position.y - minY) / rangeY) * 65 + 20,
      });
    }
  }

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gray-950 rounded overflow-hidden">
      {/* Header */}
      <div className="absolute top-3 left-0 right-0 z-10 flex items-center justify-center gap-3 px-4">
        <PixelButton variant="nav" size="sm" onClick={onBack}>
          &larr; World
        </PixelButton>
        <h2 className="font-mono text-sm text-amber-400 font-bold tracking-wider uppercase">
          {regionName}
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
            stroke="rgba(120, 113, 108, 0.35)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        ))}
      </svg>

      {/* Area nodes */}
      {areas.map((area) => {
        const isCurrent = area.id === currentAreaId;
        const pctX = ((area.position.x - minX) / rangeX) * 80 + 10;
        const pctY = ((area.position.y - minY) / rangeY) * 65 + 20;
        const icon = AREA_TYPE_ICON[area.areaType] ?? "terrain_dirt";
        const colorClass = AREA_TYPE_COLOR[area.areaType] ?? "border-gray-600 hover:border-gray-400";

        if (!area.discovered) {
          return (
            <div
              key={area.id}
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
            key={area.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pctX}%`, top: `${pctY}%` }}
          >
            <button
              onClick={() => onSelectArea(area.id)}
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
                {area.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
