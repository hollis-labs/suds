import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateStartingRoom,
  generateRoom,
  pickRoomType,
  generateRoomName,
  generateRoomDescription,
  generateExits,
  oppositeDirection,
} from "@/server/game/world";
import type { Theme, RoomType } from "@/lib/constants";
import type { Direction } from "@/lib/types";

const THEMES: Theme[] = ["horror", "funny", "epic", "dark_fantasy"];

// ---------------------------------------------------------------------------
// generateStartingRoom (existing tests)
// ---------------------------------------------------------------------------

describe("generateStartingRoom", () => {
  it("returns a room at position (0, 0)", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.x).toBe(0);
    expect(room.y).toBe(0);
  });

  it("has depth 0", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.depth).toBe(0);
  });

  it("has type safe_room", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.type).toBe("safe_room");
  });

  it("has correct exits: north, east, south", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.exits).toEqual(["north", "east", "south"]);
  });

  it("is marked as visited", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.visited).toBe(true);
  });

  it("has no encounter and no loot", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.hasEncounter).toBe(false);
    expect(room.encounterData).toBeNull();
    expect(room.hasLoot).toBe(false);
    expect(room.lootData).toBeNull();
  });

  it("has campfire room feature", () => {
    const room = generateStartingRoom("char-123", "epic");
    expect(room.roomFeatures).toEqual({ campfire: true });
  });

  it("sets the characterId correctly", () => {
    const room = generateStartingRoom("my-char-id", "horror");
    expect(room.characterId).toBe("my-char-id");
  });

  it.each(THEMES)("has a name and description for theme %s", (theme) => {
    const room = generateStartingRoom("char-123", theme);
    expect(room.name).toBeTruthy();
    expect(typeof room.name).toBe("string");
    expect(room.description).toBeTruthy();
    expect(typeof room.description).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Full Room Generation
// ---------------------------------------------------------------------------

describe("generateRoom", () => {
  it("produces a valid room at given coordinates", () => {
    const room = generateRoom("char-1", 3, 4, "epic", 7, "south");
    expect(room.x).toBe(3);
    expect(room.y).toBe(4);
    expect(room.id).toContain("char-1");
    expect(typeof room.name).toBe("string");
    expect(typeof room.description).toBe("string");
    expect(room.exits.length).toBeGreaterThanOrEqual(1);
    expect(room.visited).toBe(false);
    expect(room.encounterData).toBeNull();
    expect(room.lootData).toBeNull();
  });

  it("room name is non-empty string", () => {
    const room = generateRoom("char-1", 1, 1, "horror", 2, "north");
    expect(room.name.length).toBeGreaterThan(0);
    expect(typeof room.name).toBe("string");
  });

  it("room description is non-empty string", () => {
    const room = generateRoom("char-1", 1, 1, "funny", 2, "north");
    expect(room.description.length).toBeGreaterThan(0);
    expect(typeof room.description).toBe("string");
  });

  it("always has entry direction as exit", () => {
    // Run multiple times to account for randomness
    for (let i = 0; i < 20; i++) {
      const room = generateRoom("char-1", 1, 0, "epic", 1, "south");
      // Entry from south means we entered going south, so we need "north" to go back
      expect(room.exits).toContain("north");
    }
  });

  it("encounter flag is false for safe_room type", () => {
    // Mock pickRoomType to force safe_room
    const origRandom = Math.random;
    // We'll just generate many rooms and check any safe_rooms
    const rooms = Array.from({ length: 100 }, () =>
      generateRoom("char-1", 0, 0, "epic", 0, null)
    );
    const safeRooms = rooms.filter((r) => r.type === "safe_room");
    for (const r of safeRooms) {
      expect(r.hasEncounter).toBe(false);
    }
    Math.random = origRandom;
  });

  it("encounter flag is false for store type", () => {
    const rooms = Array.from({ length: 100 }, () =>
      generateRoom("char-1", 0, 0, "epic", 0, null)
    );
    const storeRooms = rooms.filter((r) => r.type === "store");
    for (const r of storeRooms) {
      expect(r.hasEncounter).toBe(false);
    }
  });

  it("encounter flag is false for shrine type", () => {
    const rooms = Array.from({ length: 100 }, () =>
      generateRoom("char-1", 0, 0, "epic", 0, null)
    );
    const shrineRooms = rooms.filter((r) => r.type === "shrine");
    for (const r of shrineRooms) {
      expect(r.hasEncounter).toBe(false);
    }
  });

  it("safe rooms have campfire feature", () => {
    const rooms = Array.from({ length: 100 }, () =>
      generateRoom("char-1", 0, 0, "epic", 0, null)
    );
    const safeRooms = rooms.filter((r) => r.type === "safe_room");
    for (const r of safeRooms) {
      expect(r.roomFeatures).toEqual({ campfire: true });
    }
  });

  it("trap rooms have trap feature with dc and damage", () => {
    const rooms = Array.from({ length: 200 }, () =>
      generateRoom("char-1", 5, 5, "dark_fantasy", 10, "north")
    );
    const trapRooms = rooms.filter((r) => r.type === "trap_room");
    expect(trapRooms.length).toBeGreaterThan(0);
    for (const r of trapRooms) {
      const trap = r.roomFeatures.trap as {
        type: string;
        dc: number;
        damage: string;
      };
      expect(trap).toBeDefined();
      expect(["dart", "pit", "poison"]).toContain(trap.type);
      expect(typeof trap.dc).toBe("number");
      expect(trap.dc).toBeGreaterThanOrEqual(10);
      expect(typeof trap.damage).toBe("string");
      expect(trap.damage).toMatch(/^\d+d\d+\+\d+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// pickRoomType
// ---------------------------------------------------------------------------

describe("pickRoomType", () => {
  it("respects depth weights — shallow depths should never produce boss_room", () => {
    const types: RoomType[] = [];
    for (let i = 0; i < 200; i++) {
      types.push(pickRoomType(0));
    }
    expect(types).not.toContain("boss_room");
  });

  it("boss rooms only appear at depth >= 8", () => {
    // Depth 7 should have no boss rooms
    const shallowTypes: RoomType[] = [];
    for (let i = 0; i < 200; i++) {
      shallowTypes.push(pickRoomType(7));
    }
    expect(shallowTypes).not.toContain("boss_room");

    // Depth 10 should eventually produce boss rooms (high deepWeight of 15)
    const deepTypes: RoomType[] = [];
    for (let i = 0; i < 500; i++) {
      deepTypes.push(pickRoomType(10));
    }
    expect(deepTypes).toContain("boss_room");
  });

  it("returns a valid RoomType", () => {
    const validTypes: RoomType[] = [
      "corridor",
      "chamber",
      "shrine",
      "trap_room",
      "store",
      "npc_room",
      "boss_room",
      "safe_room",
    ];
    for (let i = 0; i < 50; i++) {
      const t = pickRoomType(5);
      expect(validTypes).toContain(t);
    }
  });
});

// ---------------------------------------------------------------------------
// generateRoomName
// ---------------------------------------------------------------------------

describe("generateRoomName", () => {
  it("returns a non-empty string", () => {
    const name = generateRoomName("epic");
    expect(name.length).toBeGreaterThan(0);
  });

  it("contains a space (adjective + noun)", () => {
    const name = generateRoomName("horror");
    expect(name).toContain(" ");
  });
});

// ---------------------------------------------------------------------------
// generateRoomDescription
// ---------------------------------------------------------------------------

describe("generateRoomDescription", () => {
  it.each(THEMES)("returns a non-empty string for theme %s", (theme) => {
    const desc = generateRoomDescription(theme, "corridor");
    expect(desc.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateExits
// ---------------------------------------------------------------------------

describe("generateExits", () => {
  it("always includes the reverse of entryDirection", () => {
    for (let i = 0; i < 30; i++) {
      const exits = generateExits("south");
      expect(exits).toContain("north");
    }
  });

  it("generates at least one exit when entryDirection is null", () => {
    for (let i = 0; i < 30; i++) {
      const exits = generateExits(null);
      expect(exits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("only contains valid directions", () => {
    const validDirs: Direction[] = ["north", "south", "east", "west"];
    for (let i = 0; i < 30; i++) {
      const exits = generateExits("east");
      for (const e of exits) {
        expect(validDirs).toContain(e);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// oppositeDirection
// ---------------------------------------------------------------------------

describe("oppositeDirection", () => {
  it("returns south for north", () =>
    expect(oppositeDirection("north")).toBe("south"));
  it("returns north for south", () =>
    expect(oppositeDirection("south")).toBe("north"));
  it("returns west for east", () =>
    expect(oppositeDirection("east")).toBe("west"));
  it("returns east for west", () =>
    expect(oppositeDirection("west")).toBe("east"));
});
