import { describe, it, expect } from "vitest";
import {
  computeMapViewport,
  computeConnections,
  roomKey,
  parseRoomKey,
} from "@/server/game/map";
import type { Room } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/constants";

/**
 * Helper to create a minimal Room object for testing.
 */
function makeRoom(
  x: number,
  y: number,
  exits: string[] = [],
  visited = true
): Room {
  return {
    id: `room-${x}-${y}`,
    x,
    y,
    name: `Room ${x},${y}`,
    type: "corridor",
    description: "A test room.",
    exits,
    depth: Math.abs(x) + Math.abs(y),
    hasEncounter: false,
    encounterData: null,
    hasLoot: false,
    lootData: null,
    visited,
    roomFeatures: {},
  };
}

/**
 * Helper to build a Map<string, Room> from an array of rooms.
 */
function buildRoomMap(rooms: Room[]): Map<string, Room> {
  const map = new Map<string, Room>();
  for (const r of rooms) {
    map.set(roomKey(r.x, r.y), r);
  }
  return map;
}

// ---------------------------------------------------------------------------
// roomKey / parseRoomKey
// ---------------------------------------------------------------------------

describe("roomKey", () => {
  it("creates correct key", () => {
    expect(roomKey(3, -2)).toBe("3,-2");
    expect(roomKey(0, 0)).toBe("0,0");
  });
});

describe("parseRoomKey", () => {
  it("parses key back to position", () => {
    expect(parseRoomKey("3,-2")).toEqual({ x: 3, y: -2 });
    expect(parseRoomKey("0,0")).toEqual({ x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// computeMapViewport
// ---------------------------------------------------------------------------

describe("computeMapViewport", () => {
  it("viewport is correct default size", () => {
    const rooms = buildRoomMap([makeRoom(0, 0, ["north"])]);
    const vp = computeMapViewport({ x: 0, y: 0 }, rooms);
    expect(vp.width).toBe(GAME_CONFIG.MAP_VIEWPORT_WIDTH);
    expect(vp.height).toBe(GAME_CONFIG.MAP_VIEWPORT_HEIGHT);
    expect(vp.cells.length).toBe(GAME_CONFIG.MAP_VIEWPORT_HEIGHT);
    expect(vp.cells[0]!.length).toBe(GAME_CONFIG.MAP_VIEWPORT_WIDTH);
  });

  it("viewport respects custom size", () => {
    const rooms = buildRoomMap([makeRoom(0, 0)]);
    const vp = computeMapViewport({ x: 0, y: 0 }, rooms, 5, 5);
    expect(vp.width).toBe(5);
    expect(vp.height).toBe(5);
    expect(vp.cells.length).toBe(5);
    expect(vp.cells[0]!.length).toBe(5);
  });

  it("player cell is marked with hasPlayer", () => {
    const rooms = buildRoomMap([makeRoom(0, 0, ["north"])]);
    const vp = computeMapViewport({ x: 0, y: 0 }, rooms);
    // Find the player cell
    let found = false;
    for (const row of vp.cells) {
      for (const cell of row) {
        if (cell.x === 0 && cell.y === 0) {
          expect(cell.hasPlayer).toBe(true);
          expect(cell.isCurrent).toBe(true);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("visited rooms are visible", () => {
    const rooms = buildRoomMap([makeRoom(0, 0, ["north"], true)]);
    const vp = computeMapViewport({ x: 0, y: 0 }, rooms);
    let found = false;
    for (const row of vp.cells) {
      for (const cell of row) {
        if (cell.x === 0 && cell.y === 0) {
          expect(cell.isVisible).toBe(true);
          expect(cell.room).not.toBeNull();
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("unvisited rooms are not visible (fog of war)", () => {
    const rooms = buildRoomMap([
      makeRoom(0, 0, ["north"], true),
      makeRoom(0, 1, ["south"], false), // unvisited
    ]);
    const vp = computeMapViewport({ x: 0, y: 0 }, rooms);
    for (const row of vp.cells) {
      for (const cell of row) {
        if (cell.x === 0 && cell.y === 1) {
          expect(cell.isVisible).toBe(false);
          expect(cell.room).toBeNull();
        }
      }
    }
  });

  it("empty cells are not visible", () => {
    const rooms = buildRoomMap([makeRoom(0, 0)]);
    const vp = computeMapViewport({ x: 0, y: 0 }, rooms);
    // Pick a cell far from origin that definitely has no room
    for (const row of vp.cells) {
      for (const cell of row) {
        if (cell.x !== 0 || cell.y !== 0) {
          expect(cell.isVisible).toBe(false);
          expect(cell.room).toBeNull();
        }
      }
    }
  });

  it("viewport centers on player position", () => {
    const rooms = buildRoomMap([makeRoom(10, 10, ["north"])]);
    const vp = computeMapViewport({ x: 10, y: 10 }, rooms);
    const halfW = Math.floor(GAME_CONFIG.MAP_VIEWPORT_WIDTH / 2);
    const halfH = Math.floor(GAME_CONFIG.MAP_VIEWPORT_HEIGHT / 2);
    expect(vp.offsetX).toBe(10 - halfW);
    // y increases going north, row 0 is top (highest y)
    expect(vp.offsetY).toBe(10 + halfH);
  });

  it("viewport has correct offset values", () => {
    const rooms = buildRoomMap([makeRoom(5, 3)]);
    const vp = computeMapViewport({ x: 5, y: 3 }, rooms, 7, 7);
    expect(vp.offsetX).toBe(5 - 3); // x - floor(7/2)
    expect(vp.offsetY).toBe(3 + 3); // y + floor(7/2)
  });
});

// ---------------------------------------------------------------------------
// computeConnections
// ---------------------------------------------------------------------------

describe("computeConnections", () => {
  it("shows connection when adjacent room exists and exit matches", () => {
    const room0 = makeRoom(0, 0, ["north", "east"]);
    const roomNorth = makeRoom(0, 1, ["south"]);
    const rooms = buildRoomMap([room0, roomNorth]);
    const conns = computeConnections(room0, rooms);
    expect(conns.north).toBe(true);
    // east neighbor doesn't exist
    expect(conns.east).toBe(false);
    expect(conns.south).toBe(false);
    expect(conns.west).toBe(false);
  });

  it("no connections when no adjacent rooms exist", () => {
    const room = makeRoom(0, 0, ["north", "south", "east", "west"]);
    const rooms = buildRoomMap([room]);
    const conns = computeConnections(room, rooms);
    expect(conns.north).toBe(false);
    expect(conns.south).toBe(false);
    expect(conns.east).toBe(false);
    expect(conns.west).toBe(false);
  });

  it("connection only when room has exit in that direction", () => {
    // Room has no east exit but east neighbor exists
    const room = makeRoom(0, 0, ["north"]);
    const roomEast = makeRoom(1, 0, ["west"]);
    const rooms = buildRoomMap([room, roomEast]);
    const conns = computeConnections(room, rooms);
    expect(conns.east).toBe(false); // room doesn't have east exit
    expect(conns.north).toBe(false); // no room to the north
  });

  it("all four connections when all neighbors exist with matching exits", () => {
    const center = makeRoom(0, 0, ["north", "south", "east", "west"]);
    const north = makeRoom(0, 1, ["south"]);
    const south = makeRoom(0, -1, ["north"]);
    const east = makeRoom(1, 0, ["west"]);
    const west = makeRoom(-1, 0, ["east"]);
    const rooms = buildRoomMap([center, north, south, east, west]);
    const conns = computeConnections(center, rooms);
    expect(conns.north).toBe(true);
    expect(conns.south).toBe(true);
    expect(conns.east).toBe(true);
    expect(conns.west).toBe(true);
  });
});
