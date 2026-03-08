/**
 * Legacy Character Migration Script
 *
 * Migrates characters with worldId === null to the shared world (Aethermoor).
 * Assigns them to the starting region/area, maps their rooms into the hierarchy,
 * and creates fog_of_war entries.
 *
 * Usage:
 *   pnpm db:migrate-legacy
 *   OR via admin panel
 *
 * Idempotent: skips characters that already have a worldId.
 */

import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/server/db";
import {
  characters,
  rooms,
  stores,
  npcs,
  fogOfWar,
  worlds,
  regions,
  areas,
  combatState,
} from "@/server/db/schema";
import { seedStarterWorld } from "@/server/game/world-seed";

interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: { characterId: string; name: string; error: string }[];
}

export async function migrateLegacyCharacters(): Promise<MigrationResult> {
  const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] };

  // 1. Ensure shared world exists
  let world = await db.query.worlds.findFirst({
    where: (w, { eq: weq }) => weq(w.name, "Aethermoor"),
  });
  if (!world) {
    world = await seedStarterWorld();
  }

  // 2. Find starting region and area
  const worldRegions = await db
    .select()
    .from(regions)
    .where(eq(regions.worldId, world.id));
  const startingRegion = worldRegions[0];
  if (!startingRegion) {
    throw new Error("No regions found in Aethermoor. Run world seed first.");
  }

  const regionAreas = await db
    .select()
    .from(areas)
    .where(eq(areas.regionId, startingRegion.id));
  const startingArea =
    regionAreas.find((a) => a.areaType === "town") ?? regionAreas[0];
  if (!startingArea) {
    throw new Error("No areas found in starting region.");
  }

  // 3. Find all legacy characters (worldId IS NULL)
  const legacyChars = await db
    .select()
    .from(characters)
    .where(isNull(characters.worldId));

  console.log(`Found ${legacyChars.length} legacy character(s) to migrate.`);

  for (const character of legacyChars) {
    try {
      // Skip characters in active combat
      const [activeCombat] = await db
        .select()
        .from(combatState)
        .where(eq(combatState.characterId, character.id));

      if (activeCombat) {
        console.log(`  Skipping ${character.name} (in active combat)`);
        result.skipped++;
        continue;
      }

      // Get character's rooms
      const charRooms = await db
        .select()
        .from(rooms)
        .where(eq(rooms.characterId, character.id));

      console.log(`  Migrating ${character.name} (${charRooms.length} rooms)...`);

      // Check if rooms fit in the starting area grid
      let targetArea = startingArea;
      let needsDedicatedArea = charRooms.length > 50;

      if (charRooms.length > 0 && !needsDedicatedArea) {
        // Check if any room coordinates exceed starting area bounds
        const maxRoomX = Math.max(...charRooms.map((r) => r.x));
        const maxRoomY = Math.max(...charRooms.map((r) => r.y));
        const minRoomX = Math.min(...charRooms.map((r) => r.x));
        const minRoomY = Math.min(...charRooms.map((r) => r.y));
        if (
          maxRoomX >= startingArea.gridWidth ||
          maxRoomY >= startingArea.gridHeight ||
          minRoomX < 0 ||
          minRoomY < 0
        ) {
          needsDedicatedArea = true;
        }
      }

      if (needsDedicatedArea && charRooms.length > 0) {
        // Create a dedicated area sized to fit all rooms
        const minX = Math.min(...charRooms.map((r) => r.x));
        const maxX = Math.max(...charRooms.map((r) => r.x));
        const minY = Math.min(...charRooms.map((r) => r.y));
        const maxY = Math.max(...charRooms.map((r) => r.y));
        const gridW = maxX - minX + 5;
        const gridH = maxY - minY + 5;

        const [newArea] = await db
          .insert(areas)
          .values({
            regionId: startingRegion.id,
            name: `${character.name}'s Explored Lands`,
            description: `A region explored by ${character.name} before the great convergence.`,
            areaType: "wilderness",
            gridWidth: Math.max(gridW, 20),
            gridHeight: Math.max(gridH, 20),
            position: { x: regionAreas.length, y: 0 },
            connections: [startingArea.id],
            metadata: { migrated: true, originalCharacterId: character.id },
            generatedBy: "migration",
          })
          .returning();

        targetArea = newArea!;

        // Translate room coordinates: shift so min coords start at 2 (padding)
        if (minX < 0 || minY < 0) {
          const offsetX = minX < 0 ? -minX + 2 : 0;
          const offsetY = minY < 0 ? -minY + 2 : 0;

          for (const room of charRooms) {
            await db
              .update(rooms)
              .set({ x: room.x + offsetX, y: room.y + offsetY })
              .where(eq(rooms.id, room.id));
          }

          // Also shift character position
          const pos = character.position as { x: number; y: number };
          character.position = {
            x: pos.x + offsetX,
            y: pos.y + offsetY,
          } as typeof character.position;
        }
      }

      // Update character: set worldId, region, area
      const position = character.position as { x: number; y: number };
      // Clamp position within area grid
      const clampedX = Math.min(
        Math.max(0, position.x),
        targetArea.gridWidth - 1
      );
      const clampedY = Math.min(
        Math.max(0, position.y),
        targetArea.gridHeight - 1
      );

      await db
        .update(characters)
        .set({
          worldId: world.id,
          currentRegionId: startingRegion.id,
          currentAreaId: targetArea.id,
          currentBuildingId: null,
          position: { x: clampedX, y: clampedY },
          lastSafe: { x: clampedX, y: clampedY },
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      // Update rooms: set hierarchy fields
      if (charRooms.length > 0) {
        await db
          .update(rooms)
          .set({
            worldId: world.id,
            regionId: startingRegion.id,
            areaId: targetArea.id,
          })
          .where(eq(rooms.characterId, character.id));
      }

      // Update stores with areaId context
      await db
        .update(stores)
        .set({ buildingId: null }) // No building context for legacy stores
        .where(eq(stores.characterId, character.id));

      // Update NPCs with areaId context
      await db
        .update(npcs)
        .set({
          areaId: targetArea.id,
          buildingId: null,
        })
        .where(eq(npcs.characterId, character.id));

      // Create fog_of_war entries
      // Discover starting region and target area
      try {
        await db.insert(fogOfWar).values([
          {
            characterId: character.id,
            entityType: "region",
            entityId: startingRegion.id,
          },
          {
            characterId: character.id,
            entityType: "area",
            entityId: targetArea.id,
          },
        ]);
      } catch {
        // Already discovered — unique constraint, ignore
      }

      // If target area is different from starting area, also discover starting area
      if (targetArea.id !== startingArea.id) {
        try {
          await db.insert(fogOfWar).values({
            characterId: character.id,
            entityType: "area",
            entityId: startingArea.id,
          });
        } catch {
          // Already discovered
        }
      }

      console.log(`  ✓ ${character.name} migrated successfully`);
      result.migrated++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${character.name} failed: ${errorMsg}`);
      result.errors.push({
        characterId: character.id,
        name: character.name,
        error: errorMsg,
      });
    }
  }

  console.log(
    `\nMigration complete: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors.length} errors`
  );
  return result;
}

// CLI entrypoint: `pnpm db:migrate-legacy`
if (process.argv[1]?.includes("migrate-legacy")) {
  migrateLegacyCharacters()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
