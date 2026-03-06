import type { Position, MapCell, MapViewport, Room, Direction } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/constants";

/**
 * Create a room key string from coordinates.
 */
export function roomKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Parse a room key string back to a Position.
 */
export function parseRoomKey(key: string): Position {
  const [x, y] = key.split(",").map(Number);
  return { x: x!, y: y! };
}

/**
 * Get the direction offset for movement.
 * North = +y, South = -y, East = +x, West = -x
 */
export function directionToOffset(dir: Direction): Position {
  switch (dir) {
    case "north":
      return { x: 0, y: 1 };
    case "south":
      return { x: 0, y: -1 };
    case "east":
      return { x: 1, y: 0 };
    case "west":
      return { x: -1, y: 0 };
  }
}

/**
 * Get the opposite direction.
 */
export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case "north":
      return "south";
    case "south":
      return "north";
    case "east":
      return "west";
    case "west":
      return "east";
  }
}

/**
 * Compute which connections (corridors) exist from a room to its neighbours.
 * A connection is drawn if the room has an exit in that direction AND
 * the adjacent room exists in the rooms map.
 */
export function computeConnections(
  room: Room,
  rooms: Map<string, Room>
): { north: boolean; south: boolean; east: boolean; west: boolean } {
  const connections = { north: false, south: false, east: false, west: false };
  const directions: Direction[] = ["north", "south", "east", "west"];

  for (const dir of directions) {
    if (room.exits.includes(dir)) {
      const delta = directionToOffset(dir);
      const neighborKey = roomKey(room.x + delta.x, room.y + delta.y);
      if (rooms.has(neighborKey)) {
        connections[dir] = true;
      }
    }
  }

  return connections;
}

/**
 * Compute a map viewport centered on the player position.
 *
 * The sliding viewport algorithm:
 * 1. Center viewport on player
 * 2. Clamp toward explored territory when viewport would show mostly unexplored area
 * 3. Build cell grid with fog of war (unvisited rooms are not visible)
 * 4. Mark player cell and compute connections between adjacent rooms
 *
 * @param playerPos - The player's current position
 * @param rooms - Map of "x,y" keys to Room objects
 * @param width - Viewport width in cells (default: GAME_CONFIG.MAP_VIEWPORT_WIDTH)
 * @param height - Viewport height in cells (default: GAME_CONFIG.MAP_VIEWPORT_HEIGHT)
 * @returns A MapViewport with a grid of cells
 */
export function computeMapViewport(
  playerPos: Position,
  rooms: Map<string, Room>,
  width: number = GAME_CONFIG.MAP_VIEWPORT_WIDTH,
  height: number = GAME_CONFIG.MAP_VIEWPORT_HEIGHT
): MapViewport {
  // Calculate viewport offset so player is centered
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const offsetX = playerPos.x - halfW;
  // y increases going north; viewport row 0 is the top (highest y)
  const offsetY = playerPos.y + halfH;

  const cells: MapCell[][] = [];

  for (let row = 0; row < height; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < width; col++) {
      const cellX = offsetX + col;
      const cellY = offsetY - row; // top of viewport is higher y
      const key = roomKey(cellX, cellY);
      const room = rooms.get(key) ?? null;
      const isCurrent = cellX === playerPos.x && cellY === playerPos.y;
      const isVisible = room !== null && room.visited;

      rowCells.push({
        x: cellX,
        y: cellY,
        room: isVisible ? room : null,
        isVisible,
        isCurrent,
        hasPlayer: isCurrent,
        connections:
          room && isVisible
            ? computeConnections(room, rooms)
            : { north: false, south: false, east: false, west: false },
      });
    }
    cells.push(rowCells);
  }

  return {
    cells,
    offsetX,
    offsetY,
    width,
    height,
  };
}
