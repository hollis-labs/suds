"use client";

import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SpriteIcon } from "./SpriteIcon";
import { useKeyboard } from "@/hooks/useKeyboard";
import type { TileMapData, TileData, TileVisibility } from "@/lib/tile-types";
import { MARKER_SPRITE } from "@/lib/tile-types";

interface TileMapProps {
  mapData: TileMapData;
  playerPosition: { x: number; y: number };
  viewportWidth?: number;
  viewportHeight?: number;
  tileSize?: number;
  onTileClick?: (x: number, y: number, tile: TileData) => void;
  onMove?: (x: number, y: number) => void;
  keyboardEnabled?: boolean;
  className?: string;
}

const VISIBILITY_CLASSES: Record<TileVisibility, string> = {
  hidden: "tile-hidden",
  discovered: "tile-discovered",
  visible: "tile-visible",
};

function isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function getViewportSlice(
  tiles: TileData[][],
  mapWidth: number,
  mapHeight: number,
  playerX: number,
  playerY: number,
  vpW: number,
  vpH: number
): { slice: (TileData | null)[][]; offsetX: number; offsetY: number } {
  let offsetX = playerX - Math.floor(vpW / 2);
  let offsetY = playerY - Math.floor(vpH / 2);

  offsetX = Math.max(0, Math.min(offsetX, mapWidth - vpW));
  offsetY = Math.max(0, Math.min(offsetY, mapHeight - vpH));

  if (mapWidth < vpW) offsetX = -Math.floor((vpW - mapWidth) / 2);
  if (mapHeight < vpH) offsetY = -Math.floor((vpH - mapHeight) / 2);

  const slice: (TileData | null)[][] = [];
  for (let vy = 0; vy < vpH; vy++) {
    const row: (TileData | null)[] = [];
    for (let vx = 0; vx < vpW; vx++) {
      const mx = offsetX + vx;
      const my = offsetY + vy;
      if (mx >= 0 && mx < mapWidth && my >= 0 && my < mapHeight) {
        row.push(tiles[my]?.[mx] ?? null);
      } else {
        row.push(null);
      }
    }
    slice.push(row);
  }

  return { slice, offsetX, offsetY };
}

function TileCell({
  tile,
  tileSize,
  isPlayer,
  isAdjacentWalkable,
  flashKey,
  onClick,
}: {
  tile: TileData | null;
  tileSize: number;
  isPlayer: boolean;
  isAdjacentWalkable: boolean;
  flashKey: number;
  onClick?: () => void;
}) {
  if (!tile) {
    return (
      <div
        className="tile-hidden"
        style={{ width: tileSize, height: tileSize }}
      />
    );
  }

  const visClass = VISIBILITY_CLASSES[tile.visibility];
  const visibleMarkers =
    tile.visibility === "visible"
      ? tile.markers.filter((m) => m !== "player")
      : tile.visibility === "discovered"
        ? tile.markers.filter(
            (m) => m === "entrance" || m === "exit" || m === "campfire"
          )
        : [];

  const isClickable = tile.visibility !== "hidden" && (isAdjacentWalkable || isPlayer);

  return (
    <div
      className={cn(
        "relative",
        visClass,
        isPlayer && "tile-current",
        flashKey > 0 && "animate-tile-flash-red",
        isClickable ? "cursor-pointer" : "cursor-default"
      )}
      style={{ width: tileSize, height: tileSize }}
      onClick={onClick}
      role="gridcell"
      aria-label={tile.visibility !== "hidden" ? `Tile ${tile.x},${tile.y}` : "Hidden"}
    >
      {tile.visibility !== "hidden" && (
        <SpriteIcon
          spriteId={tile.spriteId}
          size={tileSize}
          className="absolute inset-0"
        />
      )}

      {visibleMarkers.map((marker, i) => (
        <div
          key={`${marker}-${i}`}
          className="absolute z-10"
          style={{
            right: 0,
            bottom: i * Math.round(tileSize * 0.15),
          }}
        >
          <SpriteIcon
            spriteId={MARKER_SPRITE[marker]}
            size={Math.round(tileSize * 0.6)}
          />
        </div>
      ))}

      {isPlayer && tile.visibility !== "hidden" && (
        <SpriteIcon
          spriteId="marker_player"
          size={Math.round(tileSize * 0.8)}
          className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ease-out"
        />
      )}
    </div>
  );
}

export function TileMap({
  mapData,
  playerPosition,
  viewportWidth = 15,
  viewportHeight = 11,
  tileSize = 32,
  onTileClick,
  onMove,
  keyboardEnabled = true,
  className,
}: TileMapProps) {
  const [flashCell, setFlashCell] = useState<{ x: number; y: number; key: number } | null>(null);

  const { slice } = useMemo(
    () =>
      getViewportSlice(
        mapData.tiles,
        mapData.width,
        mapData.height,
        playerPosition.x,
        playerPosition.y,
        viewportWidth,
        viewportHeight
      ),
    [mapData, playerPosition.x, playerPosition.y, viewportWidth, viewportHeight]
  );

  const tryMove = useCallback(
    (dx: number, dy: number) => {
      if (!onMove) return;
      const nx = playerPosition.x + dx;
      const ny = playerPosition.y + dy;
      if (nx < 0 || nx >= mapData.width || ny < 0 || ny >= mapData.height) return;
      const target = mapData.tiles[ny]?.[nx];
      if (target && target.walkable && target.visibility !== "hidden") {
        onMove(nx, ny);
      }
    },
    [onMove, playerPosition.x, playerPosition.y, mapData]
  );

  const handleTileClick = useCallback(
    (tile: TileData) => {
      const { x, y } = tile;
      const px = playerPosition.x;
      const py = playerPosition.y;

      // Click current tile → fire onTileClick for room detail
      if (x === px && y === py) {
        onTileClick?.(x, y, tile);
        return;
      }

      // Hidden tile → no action
      if (tile.visibility === "hidden") return;

      // Adjacent + walkable → move
      if (isAdjacent(x, y, px, py) && tile.walkable) {
        onMove?.(x, y);
        return;
      }

      // Non-adjacent → red flash feedback
      setFlashCell({ x, y, key: Date.now() });
      setTimeout(() => setFlashCell(null), 350);
    },
    [playerPosition.x, playerPosition.y, onTileClick, onMove]
  );

  // Keyboard movement: arrow keys + WASD
  useKeyboard(
    {
      ArrowUp: () => tryMove(0, -1),
      ArrowDown: () => tryMove(0, 1),
      ArrowLeft: () => tryMove(-1, 0),
      ArrowRight: () => tryMove(1, 0),
      w: () => tryMove(0, -1),
      s: () => tryMove(0, 1),
      a: () => tryMove(-1, 0),
      d: () => tryMove(1, 0),
      W: () => tryMove(0, -1),
      S: () => tryMove(0, 1),
      A: () => tryMove(-1, 0),
      D: () => tryMove(1, 0),
    },
    keyboardEnabled
  );

  return (
    <div
      className={cn("inline-block bg-[#0a0a0a] overflow-hidden select-none", className)}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${viewportWidth}, ${tileSize}px)`,
        gridTemplateRows: `repeat(${viewportHeight}, ${tileSize}px)`,
      }}
      role="grid"
      aria-label="Tile map"
    >
      {slice.map((row, vy) =>
        row.map((tile, vx) => {
          const isPlayer =
            tile !== null &&
            tile.x === playerPosition.x &&
            tile.y === playerPosition.y;
          const adj =
            tile !== null &&
            tile.walkable &&
            isAdjacent(tile.x, tile.y, playerPosition.x, playerPosition.y);
          const flash =
            flashCell && tile && tile.x === flashCell.x && tile.y === flashCell.y
              ? flashCell.key
              : 0;
          return (
            <TileCell
              key={`${vx}-${vy}`}
              tile={tile}
              tileSize={tileSize}
              isPlayer={isPlayer}
              isAdjacentWalkable={adj}
              flashKey={flash}
              onClick={
                tile
                  ? () => handleTileClick(tile)
                  : undefined
              }
            />
          );
        })
      )}
    </div>
  );
}
