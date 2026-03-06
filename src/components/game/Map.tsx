"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { MapViewport, MapCell } from "@/lib/types";

interface MapProps {
  viewport: MapViewport;
  className?: string;
}

function roomSymbol(type: string): string {
  switch (type) {
    case "safe_room":
      return "+";
    case "store":
      return "$";
    case "npc_room":
      return "?";
    case "boss_room":
      return "!";
    case "shrine":
      return "^";
    case "trap_room":
      return "~";
    case "chamber":
    case "corridor":
    default:
      return "#";
  }
}

function CellSymbol({ cell }: { cell: MapCell }) {
  // Player position
  if (cell.hasPlayer) {
    return (
      <span className="text-terminal-green terminal-glow font-bold">@</span>
    );
  }

  // Visited room
  if (cell.room && cell.room.visited) {
    return (
      <span className="text-terminal-green-dim">
        {roomSymbol(cell.room.type)}
      </span>
    );
  }

  // Visible but no room (fog edge) or unvisited room
  if (cell.isVisible && !cell.room) {
    return <span className="text-terminal-border">{"\u2591\u2591"}</span>;
  }

  if (cell.room && !cell.room.visited) {
    return <span className="text-terminal-border">{"\u2591\u2591"}</span>;
  }

  // Not visible at all
  return <span className="opacity-0">{"\u00A0\u00A0"}</span>;
}

function HorizontalConnector({ cell }: { cell: MapCell }) {
  if (cell.connections.east) {
    return <span className="text-terminal-green-dim">{"\u2500"}</span>;
  }
  return <span className="opacity-0">{"\u00A0"}</span>;
}

function VerticalConnectorRow({
  row,
  width,
}: {
  row: MapCell[];
  width: number;
}) {
  return (
    <div className="flex justify-center" style={{ lineHeight: "1" }}>
      {row.map((cell, colIdx) => (
        <span key={`vc-${colIdx}`} className="inline-block text-center" style={{ width: "3ch" }}>
          {cell.connections.south ? (
            <span className="text-terminal-green-dim">{"\u2502"}</span>
          ) : (
            <span className="opacity-0">{"\u00A0"}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function Map({ viewport, className }: MapProps) {
  const { cells, height, offsetX, offsetY } = viewport;
  const prevOffsetRef = useRef({ x: offsetX, y: offsetY });
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const prev = prevOffsetRef.current;
    if (prev.x !== offsetX || prev.y !== offsetY) {
      setIsTransitioning(true);
      prevOffsetRef.current = { x: offsetX, y: offsetY };
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [offsetX, offsetY]);

  return (
    <div
      className={cn(
        "font-mono text-sm leading-tight select-none overflow-hidden",
        className
      )}
    >
      <pre
        className={cn("m-0 p-0", isTransitioning && "transition-transform duration-300 ease-out")}
      >
        {cells.map((row, rowIdx) => (
          <div key={`row-${rowIdx}`}>
            {/* Room row */}
            <div className="flex justify-center" style={{ lineHeight: "1.2" }}>
              {row.map((cell, colIdx) => (
                <span
                  key={`cell-${rowIdx}-${colIdx}`}
                  className={cn(
                    "inline-block text-center transition-colors duration-200",
                    cell.isCurrent && "bg-terminal-green/10",
                    cell.hasPlayer && isTransitioning && "animate-flash-green"
                  )}
                  style={{ width: "3ch" }}
                >
                  <CellSymbol cell={cell} />
                  {colIdx < row.length - 1 && (
                    <HorizontalConnector cell={cell} />
                  )}
                </span>
              ))}
            </div>

            {/* Vertical connector row (between rows, not after last) */}
            {rowIdx < height - 1 && (
              <VerticalConnectorRow row={row} width={row.length} />
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}
