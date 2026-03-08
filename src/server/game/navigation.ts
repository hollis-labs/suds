// ─── World Navigation Engine ────────────────────────────────────────────────
//
// Server-side logic for navigating the world hierarchy:
// world → region → area → building → floor
//
// All game logic lives here; tRPC routers are thin wrappers.

import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  characters,
  worlds,
  regions,
  areas,
  buildings,
  rooms,
  fogOfWar,
} from "@/server/db/schema";
import type { Position } from "@/lib/types";

type DbClient = typeof import("@/server/db").db;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getOwnedCharacter(db: DbClient, characterId: string, userId: string) {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId));

  if (!character) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
  }
  if (character.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your character" });
  }
  if (!character.worldId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Character is not in a world" });
  }
  return character;
}

async function isDiscovered(db: DbClient, characterId: string, entityType: string, entityId: string): Promise<boolean> {
  const [entry] = await db
    .select()
    .from(fogOfWar)
    .where(
      and(
        eq(fogOfWar.characterId, characterId),
        eq(fogOfWar.entityType, entityType),
        eq(fogOfWar.entityId, entityId)
      )
    );
  return !!entry;
}

async function markDiscovered(db: DbClient, characterId: string, entityType: string, entityId: string) {
  try {
    await db.insert(fogOfWar).values({
      characterId,
      entityType,
      entityId,
    });
  } catch {
    // Already discovered (unique constraint) — ignore
  }
}

// ─── getWorldMap ────────────────────────────────────────────────────────────

export async function getWorldMap(db: DbClient, characterId: string, userId: string) {
  const character = await getOwnedCharacter(db, characterId, userId);

  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, character.worldId!));

  if (!world) {
    throw new TRPCError({ code: "NOT_FOUND", message: "World not found" });
  }

  const worldRegions = await db
    .select()
    .from(regions)
    .where(eq(regions.worldId, world.id));

  // Get fog of war for regions
  const fogEntries = await db
    .select()
    .from(fogOfWar)
    .where(
      and(
        eq(fogOfWar.characterId, characterId),
        eq(fogOfWar.entityType, "region")
      )
    );
  const discoveredSet = new Set(fogEntries.map((f) => f.entityId));

  return {
    world: {
      id: world.id,
      name: world.name,
      description: world.description,
      theme: world.theme,
    },
    regions: worldRegions.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      theme: r.theme,
      position: r.position as { x: number; y: number },
      connections: r.connections,
      discovered: discoveredSet.has(r.id),
    })),
  };
}

// ─── getRegionMap ───────────────────────────────────────────────────────────

export async function getRegionMap(db: DbClient, characterId: string, userId: string, regionId: string) {
  await getOwnedCharacter(db, characterId, userId);

  const [region] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, regionId));

  if (!region) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Region not found" });
  }

  const regionAreas = await db
    .select()
    .from(areas)
    .where(eq(areas.regionId, regionId));

  // Get fog of war for areas
  const fogEntries = await db
    .select()
    .from(fogOfWar)
    .where(
      and(
        eq(fogOfWar.characterId, characterId),
        eq(fogOfWar.entityType, "area")
      )
    );
  const discoveredSet = new Set(fogEntries.map((f) => f.entityId));

  return {
    region: {
      id: region.id,
      name: region.name,
      description: region.description,
      theme: region.theme,
    },
    areas: regionAreas.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      areaType: a.areaType,
      position: a.position as { x: number; y: number },
      connections: a.connections,
      discovered: discoveredSet.has(a.id),
    })),
  };
}

// ─── travelToRegion ─────────────────────────────────────────────────────────

export async function travelToRegion(db: DbClient, characterId: string, userId: string, regionId: string) {
  const character = await getOwnedCharacter(db, characterId, userId);

  const [region] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, regionId));

  if (!region) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Region not found" });
  }

  // Validate region belongs to the character's world
  if (region.worldId !== character.worldId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Region is not in your world" });
  }

  // Check if discovered or adjacent to a discovered region
  const discovered = await isDiscovered(db, characterId, "region", regionId);
  if (!discovered) {
    // Check if adjacent to a discovered region
    const allRegions = await db
      .select()
      .from(regions)
      .where(eq(regions.worldId, character.worldId!));

    const fogEntries = await db
      .select()
      .from(fogOfWar)
      .where(
        and(
          eq(fogOfWar.characterId, characterId),
          eq(fogOfWar.entityType, "region")
        )
      );
    const discoveredIds = new Set(fogEntries.map((f) => f.entityId));

    // A region is "adjacent" if any discovered region has it in connections
    const isAdjacent = allRegions.some(
      (r) => discoveredIds.has(r.id) && r.connections.includes(regionId)
    );

    if (!isAdjacent) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Region not discovered or adjacent" });
    }
  }

  // Mark as discovered
  await markDiscovered(db, characterId, "region", regionId);

  // Find default area in this region (first one, or first discovered)
  const regionAreas = await db
    .select()
    .from(areas)
    .where(eq(areas.regionId, regionId));

  const defaultArea = regionAreas[0];
  if (defaultArea) {
    await markDiscovered(db, characterId, "area", defaultArea.id);
  }

  // Update character position
  const newPosition: Position = { x: 0, y: 0 };
  await db
    .update(characters)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return {
    region: {
      id: region.id,
      name: region.name,
      description: region.description,
      theme: region.theme,
    },
    defaultAreaId: defaultArea?.id ?? null,
  };
}

// ─── travelToArea ───────────────────────────────────────────────────────────

export async function travelToArea(db: DbClient, characterId: string, userId: string, areaId: string) {
  const character = await getOwnedCharacter(db, characterId, userId);

  const [area] = await db
    .select()
    .from(areas)
    .where(eq(areas.id, areaId));

  if (!area) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Area not found" });
  }

  // Validate area's region belongs to character's world
  const [region] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, area.regionId));

  if (!region || region.worldId !== character.worldId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Area is not in your world" });
  }

  // Check if discovered or adjacent to a discovered area
  const discovered = await isDiscovered(db, characterId, "area", areaId);
  if (!discovered) {
    const regionAreas = await db
      .select()
      .from(areas)
      .where(eq(areas.regionId, area.regionId));

    const fogEntries = await db
      .select()
      .from(fogOfWar)
      .where(
        and(
          eq(fogOfWar.characterId, characterId),
          eq(fogOfWar.entityType, "area")
        )
      );
    const discoveredIds = new Set(fogEntries.map((f) => f.entityId));

    const isAdjacent = regionAreas.some(
      (a) => discoveredIds.has(a.id) && a.connections.includes(areaId)
    );

    if (!isAdjacent) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Area not discovered or adjacent" });
    }
  }

  // Mark as discovered
  await markDiscovered(db, characterId, "area", areaId);

  // Update character position to area entry point (center of grid)
  const entryX = Math.floor(area.gridWidth / 2);
  const entryY = Math.floor(area.gridHeight / 2);
  const newPosition: Position = { x: entryX, y: entryY };

  await db
    .update(characters)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return {
    area: {
      id: area.id,
      name: area.name,
      description: area.description,
      areaType: area.areaType,
      gridWidth: area.gridWidth,
      gridHeight: area.gridHeight,
    },
    position: newPosition,
  };
}

// ─── enterBuilding ──────────────────────────────────────────────────────────

export async function enterBuilding(db: DbClient, characterId: string, userId: string, buildingId: string) {
  await getOwnedCharacter(db, characterId, userId);

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, buildingId));

  if (!building) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
  }

  // Set position to floor 0 entry point
  const entryX = Math.floor(building.gridWidth / 2);
  const entryY = Math.floor(building.gridHeight / 2);
  const newPosition: Position = { x: entryX, y: entryY };

  await db
    .update(characters)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return {
    building: {
      id: building.id,
      name: building.name,
      description: building.description,
      buildingType: building.buildingType,
      floors: building.floors,
      gridWidth: building.gridWidth,
      gridHeight: building.gridHeight,
    },
    floor: 0,
    position: newPosition,
  };
}

// ─── exitBuilding ───────────────────────────────────────────────────────────

export async function exitBuilding(db: DbClient, characterId: string, userId: string) {
  const character = await getOwnedCharacter(db, characterId, userId);

  // The character's position is restored to the building's area position
  // For now, reset to area center — the building's position on the area grid
  // We'll set a simple center position until we track entrance position
  const newPosition: Position = { x: 0, y: 0 };

  await db
    .update(characters)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return { position: newPosition };
}

// ─── changeFloor ────────────────────────────────────────────────────────────

export async function changeFloor(
  db: DbClient,
  characterId: string,
  userId: string,
  direction: "up" | "down",
  currentFloor: number,
  buildingId: string
) {
  await getOwnedCharacter(db, characterId, userId);

  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, buildingId));

  if (!building) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
  }

  const newFloor = direction === "up" ? currentFloor - 1 : currentFloor + 1;

  if (newFloor < 0 || newFloor >= building.floors) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: direction === "up" ? "You're already on the top floor" : "You're already on the bottom floor",
    });
  }

  // Reset position to stairs location on new floor (center for now)
  const entryX = Math.floor(building.gridWidth / 2);
  const entryY = Math.floor(building.gridHeight / 2);
  const newPosition: Position = { x: entryX, y: entryY };

  await db
    .update(characters)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return {
    floor: newFloor,
    position: newPosition,
    buildingName: building.name,
  };
}
