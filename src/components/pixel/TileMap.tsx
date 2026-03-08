"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SpriteIcon } from "./SpriteIcon";
import type { TileMapData, TileData, TileVisibility } from "@/lib/tile-types";
import { MARKER_SPRITE } from "@/lib/tile-types";

interface TileMapProps {
  mapData: TileMapData;
  playerPosition: { x: number; y: number };
  viewportWidth?: number;
  viewportHeight?: number;
  tileSize?: number;
  onTileClick?: (x: number, y: number, tile: TileData) => void;
  className?: string;
}

const VISIBILITY_CLASSES: Record<TileVisibility, string> = {
  hidden: "tile-hidden",
  discovered: "tile-discovered",
  visible: "tile-visible",
};

function getViewportSlice(
  tiles: TileData[][],
  mapWidth: number,
  mapHeight: number,
  playerX: number,
  playerY: number,
  vpW: number,
  vpH: number
): { slice: (TileData | null)[][]; offsetX: number; offsetY: number } {
  // Center viewport on player
  let offsetX = playerX - Math.floor(vpW / 2);
  let offsetY = playerY - Math.floor(vpH / 2);

  // Clamp to map bounds
  offsetX = Math.max(0, Math.min(offsetX, mapWidth - vpW));
  offsetY = Math.max(0, Math.min(offsetY, mapHeight - vpH));

  // For maps smaller than viewport, center the map
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
        row.push(null); // void/dark border
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
  onClick,
}: {
  tile: TileData | null;
  tileSize: number;
  isPlayer: boolean;
  onClick?: () => void;
}) {
  if (!tile) {
    // Void cell (outside map bounds)
    return (
      <div
        className="tile-hidden"
        style={{ width: tileSize, height: tileSize }}
      />
    );
  }

  const visClass = VISIBILITY_CLASSES[tile.visibility];
  // Only show markers on visible tiles (discovered shows structure only)
  const visibleMarkers =
    tile.visibility === "visible"
      ? tile.markers.filter((m) => m !== "player")
      : tile.visibility === "discovered"
        ? tile.markers.filter(
            (m) =>
              m === "entrance" || m === "exit" || m === "campfire"
          )
        : [];

  return (
    <div
      className={cn("relative", visClass, isPlayer && "tile-current")}
      style={{ width: tileSize, height: tileSize }}
      onClick={onClick}
    >
      {/* Terrain base */}
      {tile.visibility !== "hidden" && (
        <SpriteIcon
          spriteId={tile.spriteId}
          size={tileSize}
          className="absolute inset-0"
        />
      )}

      {/* Marker overlays */}
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

      {/* Player marker — always on top */}
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
  className,
}: TileMapProps) {
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
          return (
            <TileCell
              key={`${vx}-${vy}`}
              tile={tile}
              tileSize={tileSize}
              isPlayer={isPlayer}
              onClick={
                tile && onTileClick
                  ? () => onTileClick(tile.x, tile.y, tile)
                  : undefined
              }
            />
          );
        })
      )}
    </div>
  );
}
