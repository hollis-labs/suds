"use client";

import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import type { MapViewport, MapCell } from "@/lib/types";

// ── Color palette ──────────────────────────────────────────────────────
const COLORS = {
  bg: "#0a0f0a",
  bgAlt: "#0d140d",
  green: "#33ff33",
  greenDim: "#1a3a1a",
  red: "#ff4444",
  gold: "#ffd700",
  blue: "#44aaff",
  purple: "#aa66ff",
  border: "#1a3a1a",
  white: "#c8e6c8",
} as const;

const CELL_SIZE = 7;
const CELL_GAP = 2;

export interface MiniMapProps {
  viewport: MapViewport;
  playerPosition: { x: number; y: number };
  currentRoomName?: string;
  currentRoomDesc?: string;
  onRoomClick?: (x: number, y: number) => void;
  className?: string;
}

function getCellColor(cell: MapCell): string {
  if (cell.isCurrent) return COLORS.green;
  if (!cell.room) return "transparent";
  if (!cell.room.visited) return COLORS.bgAlt;
  if (cell.room.hasEncounter) return `${COLORS.red}80`;
  if (cell.room.type === "store") return `${COLORS.gold}80`;
  if (cell.room.type === "npc_room") return `${COLORS.blue}60`;
  if (cell.room.type === "shrine") return `${COLORS.purple}60`;
  return COLORS.greenDim;
}

const MiniCell = memo(function MiniCell({
  cell,
  onClick,
}: {
  cell: MapCell;
  onClick?: () => void;
}) {
  const color = getCellColor(cell);
  const hasRoom = !!cell.room;

  return (
    <div
      className={cn(hasRoom && onClick ? "cursor-pointer" : "cursor-default")}
      style={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        backgroundColor: color,
        border: cell.isCurrent
          ? `1px solid ${COLORS.green}`
          : hasRoom && cell.room!.visited
            ? `1px solid ${COLORS.border}`
            : "1px solid transparent",
      }}
      onClick={hasRoom ? onClick : undefined}
    />
  );
});

export function MiniMap({
  viewport,
  playerPosition,
  currentRoomName,
  currentRoomDesc,
  onRoomClick,
  className,
}: MiniMapProps) {
  const grid = useMemo(() => {
    return viewport.cells;
  }, [viewport]);

  const width = grid[0]?.length ?? 0;

  return (
    <div className={cn("font-mono", className)}>
      {/* Mini map grid */}
      <div
        className="inline-grid"
        style={{
          gridTemplateColumns: `repeat(${width}, ${CELL_SIZE}px)`,
          gap: `${CELL_GAP}px`,
          padding: 4,
          backgroundColor: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {grid.map((row, ry) =>
          row.map((cell, cx) => (
            <MiniCell
              key={`${cx}-${ry}`}
              cell={cell}
              onClick={onRoomClick ? () => onRoomClick(cell.x, cell.y) : undefined}
            />
          ))
        )}
      </div>

      {/* Room info below */}
      {currentRoomName && (
        <div className="mt-2 space-y-0.5">
          <div
            className="text-xs font-bold truncate"
            style={{ color: COLORS.white }}
          >
            {currentRoomName}
          </div>
          {currentRoomDesc && (
            <div
              className="text-[10px] leading-relaxed line-clamp-3"
              style={{ color: COLORS.greenDim }}
            >
              {currentRoomDesc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
