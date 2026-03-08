"use client";

import { useState, useCallback } from "react";
import { TileMap } from "@/components/pixel/TileMap";
import { HudBar } from "@/components/pixel/HudBar";
import { Breadcrumb } from "@/components/pixel/Breadcrumb";
import type { TileData, TileMapData, TileVisibility } from "@/lib/tile-types";
import type { SpriteId } from "@/lib/sprites";

const MAP_SIZE = 25;

// Deterministic pseudo-random from coords
function hash(x: number, y: number, seed: number = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const TERRAIN_POOL: SpriteId[] = [
  "terrain_grass",
  "terrain_grass",
  "terrain_grass",
  "terrain_dirt",
  "terrain_dirt",
  "terrain_stone",
  "terrain_road",
  "terrain_sand",
  "terrain_forest",
  "terrain_forest",
];

const UNWALKABLE_TERRAIN: SpriteId[] = [
  "terrain_water",
  "terrain_mountain",
];

function generateMockMap(): TileMapData {
  const tiles: TileData[][] = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      const r = hash(x, y);
      const isUnwalkable = r > 0.88;
      const spriteId = isUnwalkable
        ? UNWALKABLE_TERRAIN[Math.floor(hash(x, y, 1) * UNWALKABLE_TERRAIN.length)]
        : TERRAIN_POOL[Math.floor(hash(x, y, 2) * TERRAIN_POOL.length)];

      const tile: TileData = {
        x,
        y,
        spriteId,
        walkable: !isUnwalkable,
        visibility: "hidden",
        markers: [],
        roomId: `room-${x}-${y}`,
      };

      // Scatter some markers
      const mr = hash(x, y, 3);
      if (mr > 0.95 && !isUnwalkable) tile.markers.push("encounter");
      else if (mr > 0.9 && !isUnwalkable) tile.markers.push("loot");
      else if (mr > 0.87 && !isUnwalkable) tile.markers.push("npc");

      row.push(tile);
    }
    tiles.push(row);
  }

  // Place some buildings near center
  const buildings: Array<{ x: number; y: number; sprite: SpriteId }> = [
    { x: 10, y: 11, sprite: "terrain_road" },
    { x: 14, y: 11, sprite: "terrain_road" },
    { x: 12, y: 10, sprite: "terrain_road" },
  ];
  for (const b of buildings) {
    const t = tiles[b.y][b.x];
    t.spriteId = b.sprite;
    t.walkable = true;
    t.markers = ["entrance"];
  }

  // Ensure player start is walkable
  tiles[12][12].spriteId = "terrain_grass";
  tiles[12][12].walkable = true;
  tiles[12][12].markers = ["campfire"];

  return { width: MAP_SIZE, height: MAP_SIZE, tiles };
}

function updateFog(
  mapData: TileMapData,
  px: number,
  py: number,
  visited: Set<string>
): TileMapData {
  const visRadius = 3;
  const newTiles = mapData.tiles.map((row) =>
    row.map((tile) => {
      const dx = Math.abs(tile.x - px);
      const dy = Math.abs(tile.y - py);
      const dist = Math.max(dx, dy); // Chebyshev distance

      let visibility: TileVisibility;
      const key = `${tile.x},${tile.y}`;
      if (dist <= visRadius) {
        visibility = "visible";
        visited.add(key);
      } else if (visited.has(key)) {
        visibility = "discovered";
      } else {
        visibility = "hidden";
      }

      return { ...tile, visibility };
    })
  );

  return { ...mapData, tiles: newTiles };
}

export default function TileMapDevPage() {
  const [visited] = useState(() => new Set<string>());
  const [baseMap] = useState(() => generateMockMap());
  const [playerPos, setPlayerPos] = useState({ x: 12, y: 12 });
  const [mapData, setMapData] = useState(() => updateFog(baseMap, 12, 12, visited));
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);

  const handleMove = useCallback(
    (x: number, y: number) => {
      setPlayerPos({ x, y });
      setMapData(updateFog(baseMap, x, y, visited));
      setSelectedTile(null);
    },
    [baseMap, visited]
  );

  const handleTileClick = useCallback(
    (_x: number, _y: number, tile: TileData) => {
      setSelectedTile(tile);
    },
    []
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <div className="p-4 pb-0">
        <h1 className="font-mono text-lg text-white mb-1">TileMap Dev Page</h1>
        <p className="font-mono text-xs text-gray-500 mb-3">
          /dev/tilemap — Click adjacent tiles or use WASD/arrow keys to move
        </p>
      </div>

      <HudBar hp={24} maxHp={30} mp={12} maxMp={15} gold={150} level={5} />
      <Breadcrumb
        segments={[
          { label: "Aethermoor" },
          { label: "Ashen Coast" },
          { label: "Blackmere Village" },
        ]}
      />

      <div className="flex-1 flex items-start justify-center p-4">
        <TileMap
          mapData={mapData}
          playerPosition={playerPos}
          viewportWidth={15}
          viewportHeight={11}
          tileSize={40}
          onMove={handleMove}
          onTileClick={handleTileClick}
        />
      </div>

      {/* Tile info panel */}
      <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 font-mono text-xs">
        <div className="text-gray-400">
          Player: ({playerPos.x}, {playerPos.y})
        </div>
        {selectedTile && (
          <div className="mt-1 text-gray-300">
            Selected: ({selectedTile.x}, {selectedTile.y}) — {selectedTile.spriteId}
            {selectedTile.markers.length > 0 && (
              <span className="text-amber-400 ml-2">
                [{selectedTile.markers.join(", ")}]
              </span>
            )}
            {!selectedTile.walkable && (
              <span className="text-red-400 ml-2">(impassable)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
