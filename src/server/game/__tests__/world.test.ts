import { describe, it, expect } from "vitest";
import { generateStartingRoom } from "@/server/game/world";
import type { Theme } from "@/lib/constants";

const THEMES: Theme[] = ["horror", "funny", "epic", "dark_fantasy"];

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
