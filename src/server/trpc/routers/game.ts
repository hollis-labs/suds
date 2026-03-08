import { z } from "zod";
import { eq, and, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, rooms, inventoryItems, areas } from "@/server/db/schema";
import { generateRoom } from "@/server/game/world";
import { generateEncounter } from "@/server/game/encounters";
import { computeMapViewport, directionToOffset, oppositeDirection, roomKey } from "@/server/game/map";
import { rollCheck, rollDice } from "@/server/game/dice";
import { statModifier, GAME_CONFIG } from "@/lib/constants";
import { buildEquipmentSlots } from "@/server/game/equipment";
import type { Theme, RoomType } from "@/lib/constants";
import { generateRoomDescriptionAI, generateLoreFragmentAI } from "@/server/game/ai";
import { selectOrGenerate } from "@/server/game/content-library";
import { logGameEvent } from "@/server/game/events";
import {
  getWorldMap,
  getRegionMap,
  travelToRegion,
  travelToArea,
  enterBuilding,
  exitBuilding,
  changeFloor,
} from "@/server/game/navigation";
import itemsData from "@/server/gamedata/items.json";
import type {
  Player,
  PlayerBuff,
  ShrineData,
  Room as RoomData,
  Position,
  MonsterEncounter,
  GameItem,
  Stats,
  Direction,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Player object from a character DB row + inventory items */
function buildPlayer(
  character: typeof characters.$inferSelect,
  items: (typeof inventoryItems.$inferSelect)[]
): Player {
  const toGameItem = (item: (typeof inventoryItems.$inferSelect)): GameItem => ({
    id: item.id,
    itemId: item.itemId,
    name: item.name,
    type: item.type as GameItem["type"],
    rarity: item.rarity as GameItem["rarity"],
    stats: (item.stats ?? {}) as Record<string, number>,
    quantity: item.quantity,
    slot: item.slot,
    isEquipped: item.isEquipped,
  });

  const slots = buildEquipmentSlots(items);

  return {
    id: character.id,
    name: character.name,
    class: character.class,
    theme: character.theme,
    level: character.level,
    xp: character.xp,
    xpNext: character.xpNext,
    hp: character.hp,
    hpMax: character.hpMax,
    mp: character.mp,
    mpMax: character.mpMax,
    gold: character.gold,
    stats: character.stats as Stats,
    ac: character.ac,
    position: character.position as Position,
    equipment: {
      weapon: slots.weapon ? toGameItem(slots.weapon) : undefined,
      armor: slots.armor ? toGameItem(slots.armor) : undefined,
      accessory: slots.accessory ? toGameItem(slots.accessory) : undefined,
      ring: slots.ring ? toGameItem(slots.ring) : undefined,
      amulet: slots.amulet ? toGameItem(slots.amulet) : undefined,
      boots: slots.boots ? toGameItem(slots.boots) : undefined,
    },
    abilities: character.abilities,
    lastSafe: character.lastSafe as Position,
    baseLevel: character.baseLevel,
    companion: (character.companion as Player["companion"]) ?? null,
    buffs: (character.buffs as PlayerBuff[]) ?? [],
    worldId: character.worldId ?? null,
    currentRegionId: character.currentRegionId ?? null,
    currentAreaId: character.currentAreaId ?? null,
    currentBuildingId: character.currentBuildingId ?? null,
  };
}

/** Build a typed Room from a DB row */
function buildRoom(row: typeof rooms.$inferSelect): RoomData {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    name: row.name,
    type: row.type,
    description: row.description,
    exits: row.exits,
    depth: row.depth,
    hasEncounter: row.hasEncounter,
    encounterData: row.encounterData as MonsterEncounter | null,
    hasLoot: row.hasLoot,
    lootData: row.lootData as GameItem[] | null,
    visited: row.visited,
    roomFeatures: (row.roomFeatures ?? {}) as Record<string, unknown>,
    buildingId: row.buildingId ?? undefined,
  };
}

type DbClient = typeof import("@/server/db").db;

/** Get character + verify ownership. Throws NOT_FOUND or FORBIDDEN. */
async function getOwnedCharacter(
  db: DbClient,
  characterId: string,
  userId: string
) {
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
  return character;
}

/** Get the room at a given position for a character.
 *  For world characters: looks up shared rooms by area/building context.
 *  For legacy characters: looks up by characterId + position.
 */
async function getRoomAt(
  db: DbClient,
  characterId: string,
  x: number,
  y: number,
  context?: { areaId?: string | null; buildingId?: string | null; floor?: number | null }
) {
  // If we have hierarchy context, look for shared rooms first
  if (context?.areaId) {
    const conditions = [
      eq(rooms.x, x),
      eq(rooms.y, y),
    ];

    if (context.buildingId) {
      conditions.push(eq(rooms.buildingId, context.buildingId));
      if (context.floor != null) {
        conditions.push(eq(rooms.floor, context.floor));
      }
    } else {
      conditions.push(eq(rooms.areaId, context.areaId));
      conditions.push(isNull(rooms.buildingId));
    }

    const [sharedRoom] = await db
      .select()
      .from(rooms)
      .where(and(...conditions));

    if (sharedRoom) return sharedRoom;
  }

  // Fallback: legacy room lookup by characterId
  const [room] = await db
    .select()
    .from(rooms)
    .where(
      and(eq(rooms.characterId, characterId), eq(rooms.x, x), eq(rooms.y, y))
    );
  return room ?? null;
}

/** Build hierarchy context for room lookups from a character record */
function hierContextFor(character: typeof characters.$inferSelect) {
  return character.worldId
    ? {
        areaId: character.currentAreaId,
        buildingId: character.currentBuildingId,
        floor: character.currentFloor,
      }
    : undefined;
}

/** Get all rooms visible to a character (shared or legacy) */
async function getCharacterRooms(db: DbClient, character: typeof characters.$inferSelect) {
  if (character.worldId && character.currentAreaId) {
    // World character: get shared rooms in current area/building
    const conditions = character.currentBuildingId
      ? [
          eq(rooms.buildingId, character.currentBuildingId),
          ...(character.currentFloor != null ? [eq(rooms.floor, character.currentFloor)] : []),
        ]
      : [
          eq(rooms.areaId, character.currentAreaId),
          isNull(rooms.buildingId),
        ];

    return db
      .select()
      .from(rooms)
      .where(and(...conditions));
  }

  // Legacy character: per-character rooms
  return db
    .select()
    .from(rooms)
    .where(eq(rooms.characterId, character.id));
}

/** Convert an array of DB room rows into a Map<string, Room> keyed by "x,y" */
function buildRoomMap(rows: (typeof rooms.$inferSelect)[]): Map<string, RoomData> {
  const map = new Map<string, RoomData>();
  for (const row of rows) {
    map.set(roomKey(row.x, row.y), buildRoom(row));
  }
  return map;
}

/** Generate loot items from gamedata/items.json for a given depth */
function generateLootItems(depth: number): GameItem[] {
  // Simple loot: 1-2 items scaled by depth
  const count = Math.random() < 0.3 ? 2 : 1;
  const loot: GameItem[] = [];

  const items = itemsData as unknown as Array<{
    id: string;
    name: string;
    type: string;
    rarity: string;
    stats: Record<string, number>;
    basePrice: number;
    description: string;
  }>;

  // Filter by rarity based on depth
  const rarityPool: string[] = ["common"];
  if (depth >= 2) rarityPool.push("uncommon");
  if (depth >= 5) rarityPool.push("rare");
  if (depth >= 8) rarityPool.push("epic");
  if (depth >= 12) rarityPool.push("legendary");

  const eligible = items.filter((i) => rarityPool.includes(i.rarity));
  if (eligible.length === 0) return [];

  for (let i = 0; i < count; i++) {
    const template = eligible[Math.floor(Math.random() * eligible.length)]!;
    loot.push({
      id: `loot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      itemId: template.id,
      name: template.name,
      type: template.type as GameItem["type"],
      rarity: template.rarity as GameItem["rarity"],
      stats: { ...template.stats },
      quantity: 1,
      slot: null,
      isEquipped: false,
      description: template.description,
    });
  }

  return loot;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const directionSchema = z.enum(["north", "south", "east", "west"]);

export const gameRouter = router({
  // ─── Move ───────────────────────────────────────────────────────────────────
  move: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        direction: directionSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      // Build hierarchy context for world characters
      const hierCtx = hierContextFor(character);

      // Get current room
      const currentRoomRow = await getRoomAt(ctx.db, character.id, position.x, position.y, hierCtx);
      if (!currentRoomRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      // Validate direction is available
      if (!currentRoomRow.exits.includes(input.direction)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No exit to the ${input.direction}`,
        });
      }

      // Calculate target position
      const offset = directionToOffset(input.direction);
      const targetX = position.x + offset.x;
      const targetY = position.y + offset.y;
      const targetDepth = Math.abs(targetX) + Math.abs(targetY);

      // Check if target room exists
      let targetRoomRow = await getRoomAt(ctx.db, character.id, targetX, targetY, hierCtx);

      if (!targetRoomRow) {
        // Generate new room
        const theme = character.theme as Theme;
        const newRoom = generateRoom(
          character.id,
          targetX,
          targetY,
          theme,
          targetDepth,
          input.direction,
          character.level
        );

        // Generate encounter data if room has encounter
        let encounterData: MonsterEncounter | null = null;
        if (newRoom.hasEncounter) {
          encounterData = generateEncounter(character.level, targetDepth, theme);
        }

        // Generate loot data if room has loot
        let lootData: GameItem[] | null = null;
        if (newRoom.hasLoot) {
          lootData = generateLootItems(targetDepth);
        }

        // Enhance room description with AI via content library
        const aiDescription = await selectOrGenerate(ctx.db, {
          type: "room_description",
          theme,
          tags: [newRoom.type, targetDepth > 5 ? "deep" : targetDepth > 2 ? "mid" : "shallow"],
          generate: () => generateRoomDescriptionAI(theme, newRoom.type as RoomType, newRoom.name, targetDepth),
        });
        newRoom.description = aiDescription as string;

        // Insert into DB — handle race condition from rapid key presses
        // World characters get shared rooms (characterId = null, hierarchy set)
        // Legacy characters get per-character rooms
        const isWorldChar = !!character.worldId;
        const roomInsertValues = {
          characterId: isWorldChar ? null : character.id,
          x: targetX,
          y: targetY,
          name: newRoom.name,
          type: newRoom.type,
          description: newRoom.description,
          exits: newRoom.exits,
          depth: newRoom.depth,
          hasEncounter: newRoom.hasEncounter,
          encounterData,
          hasLoot: newRoom.hasLoot,
          lootData,
          visited: true,
          roomFeatures: newRoom.roomFeatures,
          ...(isWorldChar
            ? {
                worldId: character.worldId,
                regionId: character.currentRegionId,
                areaId: character.currentAreaId,
                buildingId: character.currentBuildingId,
                floor: character.currentFloor,
              }
            : {}),
        };
        try {
          const [inserted] = await ctx.db
            .insert(rooms)
            .values(roomInsertValues)
            .returning();

          targetRoomRow = inserted!;
        } catch {
          // Likely a unique constraint violation from concurrent move
          // Re-fetch the room that was created by the other request
          targetRoomRow = await getRoomAt(ctx.db, character.id, targetX, targetY, hierCtx);
          if (!targetRoomRow) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create or find room",
            });
          }
        }
      } else {
        // Mark as visited if not already
        if (!targetRoomRow.visited) {
          await ctx.db
            .update(rooms)
            .set({ visited: true })
            .where(eq(rooms.id, targetRoomRow.id));
          targetRoomRow = { ...targetRoomRow, visited: true };
        }
      }

      // Update character position
      const newPosition = { x: targetX, y: targetY };
      await ctx.db
        .update(characters)
        .set({ position: newPosition, updatedAt: new Date() })
        .where(eq(characters.id, character.id));

      // Fetch inventory for player object
      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, position: newPosition };
      const player = buildPlayer(updatedCharacter, items);
      const room = buildRoom(targetRoomRow);

      // Check for encounter — regenerate fresh on re-entry so initiative
      // is re-rolled and monsters reset (aggro cooldown on flee)
      let encounter: MonsterEncounter | null = null;
      if (room.hasEncounter && room.encounterData) {
        const theme = character.theme as Theme;
        encounter = generateEncounter(character.level, targetDepth, theme);
        // Persist the fresh encounter so combat.start picks it up
        await ctx.db
          .update(rooms)
          .set({ encounterData: encounter })
          .where(eq(rooms.id, targetRoomRow!.id));
      }

      // Compute map viewport
      const allRooms = await getCharacterRooms(ctx.db, character);

      const mapViewport = computeMapViewport(
        newPosition,
        buildRoomMap(allRooms)
      );

      const enterCombat = encounter !== null;

      logGameEvent({
        characterId: character.id,
        characterName: character.name,
        userId,
        type: enterCombat ? "combat_start" : "move",
        detail: enterCombat
          ? `Encountered ${encounter!.monsters.map((m) => m.name).join(", ")} in ${room.name}`
          : `Moved ${input.direction} to ${room.name}`,
        metadata: { x: targetX, y: targetY, direction: input.direction, roomType: room.type },
      });

      return { room, player, encounter, enterCombat, mapViewport };
    }),

  // ─── Get Map ────────────────────────────────────────────────────────────────
  getMap: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      const allRooms = await getCharacterRooms(ctx.db, character);

      const mapViewport = computeMapViewport(
        position,
        buildRoomMap(allRooms)
      );

      return mapViewport;
    }),

  // ─── Search Room ────────────────────────────────────────────────────────────
  searchRoom: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;
      const stats = character.stats as Stats;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y, hierContextFor(character));
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      const features = (currentRoom.roomFeatures ?? {}) as Record<string, unknown>;

      // Check if already searched
      if (features.searched) {
        return {
          success: false,
          message: "You have already thoroughly searched this room.",
        };
      }

      // Roll INT or WIS check (whichever is higher)
      const intMod = statModifier(stats.int);
      const wisMod = statModifier(stats.wis);
      const bestMod = Math.max(intMod, wisMod);
      const dc = 10 + Math.floor(currentRoom.depth / 2);
      const check = rollCheck(bestMod, dc);

      // Mark room as searched
      const updatedFeatures = { ...features, searched: true };

      if (check.success) {
        const results: {
          success: true;
          message: string;
          items?: GameItem[];
          newExits?: string[];
        } = {
          success: true,
          message: check.critical
            ? "Critical success! You find something remarkable!"
            : "Your keen senses reveal hidden secrets.",
        };

        // Chance of hidden items
        if (Math.random() < 0.5) {
          const loot = generateLootItems(currentRoom.depth);
          if (loot.length > 0) {
            results.items = loot;
            results.message += ` You discover ${loot.map((l) => l.name).join(", ")}!`;

            // Add to character inventory
            for (const item of loot) {
              await ctx.db.insert(inventoryItems).values({
                characterId: character.id,
                itemId: item.itemId,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                stats: item.stats,
                quantity: item.quantity,
                isEquipped: false,
              });
            }
          }
        }

        // Chance of secret exits
        if (Math.random() < 0.3) {
          const allDirs: Direction[] = ["north", "south", "east", "west"];
          const currentExits = currentRoom.exits;
          const missingExits = allDirs.filter((d) => !currentExits.includes(d));
          if (missingExits.length > 0) {
            const newExit = missingExits[Math.floor(Math.random() * missingExits.length)]!;
            const newExits = [...currentExits, newExit];
            await ctx.db
              .update(rooms)
              .set({ exits: newExits, roomFeatures: updatedFeatures })
              .where(eq(rooms.id, currentRoom.id));
            results.newExits = [newExit];
            results.message += ` You discover a hidden passage to the ${newExit}!`;
            return results;
          }
        }

        await ctx.db
          .update(rooms)
          .set({ roomFeatures: updatedFeatures })
          .where(eq(rooms.id, currentRoom.id));

        if (!results.items && !results.newExits) {
          const theme = character.theme as Theme;
          const depth = Math.abs(position.x) + Math.abs(position.y);
          const fragment = await selectOrGenerate(ctx.db, {
            type: "lore_fragment",
            theme,
            tags: [currentRoom.type, depth > 5 ? "deep" : depth > 2 ? "mid" : "shallow"],
            generate: () => generateLoreFragmentAI(theme, depth),
          });
          results.message = fragment as string;
        }

        logGameEvent({
          characterId: character.id,
          characterName: character.name,
          userId,
          type: "search",
          detail: results.items
            ? `Found ${results.items.length} item(s)`
            : results.newExits
              ? "Discovered hidden passage"
              : "Found lore fragment",
          metadata: { x: position.x, y: position.y, roll: check.total },
        });

        return results;
      }

      // Failure
      await ctx.db
        .update(rooms)
        .set({ roomFeatures: updatedFeatures })
        .where(eq(rooms.id, currentRoom.id));

      logGameEvent({
        characterId: character.id,
        characterName: character.name,
        userId,
        type: "search",
        detail: "Search failed",
        metadata: { x: position.x, y: position.y, roll: check.total },
      });

      return {
        success: false,
        message: check.fumble
          ? "You trip and stumble, finding nothing but your own embarrassment."
          : "You find nothing of interest.",
      };
    }),

  // ─── Interact ───────────────────────────────────────────────────────────────
  interact: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        feature: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;
      const stats = character.stats as Stats;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y, hierContextFor(character));
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      const features = (currentRoom.roomFeatures ?? {}) as Record<string, unknown>;

      // Check the feature exists in room
      if (!(input.feature in features)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `There is no ${input.feature} here.`,
        });
      }

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      switch (input.feature) {
        // ── Chest ──────────────────────────────────────────────
        case "chest": {
          if ((features.chest_opened as boolean | undefined) === true) {
            return { result: "The chest is already open and empty." };
          }

          // Grant loot
          const loot = currentRoom.lootData
            ? (currentRoom.lootData as unknown as GameItem[])
            : generateLootItems(currentRoom.depth);

          const grantedItems: GameItem[] = [];
          for (const item of loot) {
            const [inserted] = await ctx.db
              .insert(inventoryItems)
              .values({
                characterId: character.id,
                itemId: item.itemId,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                stats: item.stats,
                quantity: item.quantity,
                isEquipped: false,
              })
              .returning();

            grantedItems.push({
              ...item,
              id: inserted!.id,
            });
          }

          // Mark chest as opened
          const updatedFeatures = { ...features, chest_opened: true };
          await ctx.db
            .update(rooms)
            .set({ roomFeatures: updatedFeatures })
            .where(eq(rooms.id, currentRoom.id));

          // Refresh items for player build
          const refreshedItems = await ctx.db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.characterId, character.id));

          const player = buildPlayer(character, refreshedItems);

          return {
            result: `You open the chest and find: ${grantedItems.map((i) => i.name).join(", ")}!`,
            player,
            items: grantedItems,
          };
        }

        // ── Altar / Shrine ─────────────────────────────────────
        case "altar": {
          if ((features.blessing_available as boolean | undefined) === false) {
            return { result: "The altar's blessing has already been bestowed." };
          }

          // Heal to full
          await ctx.db
            .update(characters)
            .set({
              hp: character.hpMax,
              mp: character.mpMax,
              updatedAt: new Date(),
            })
            .where(eq(characters.id, character.id));

          // Mark blessing used
          const updatedFeatures = { ...features, blessing_available: false };
          await ctx.db
            .update(rooms)
            .set({ roomFeatures: updatedFeatures })
            .where(eq(rooms.id, currentRoom.id));

          const healedCharacter = { ...character, hp: character.hpMax, mp: character.mpMax };
          const player = buildPlayer(healedCharacter, items);

          return {
            result: "Divine light washes over you. Your HP and MP are fully restored!",
            player,
          };
        }

        // ── Campfire / Safe Room ───────────────────────────────
        case "campfire": {
          // Heal to full and update last safe
          const newPosition = character.position as Position;
          await ctx.db
            .update(characters)
            .set({
              hp: character.hpMax,
              mp: character.mpMax,
              lastSafe: newPosition,
              updatedAt: new Date(),
            })
            .where(eq(characters.id, character.id));

          const healedCharacter = {
            ...character,
            hp: character.hpMax,
            mp: character.mpMax,
            lastSafe: newPosition,
          };
          const player = buildPlayer(healedCharacter, items);

          return {
            result: "You rest by the campfire. HP and MP fully restored. Safe point updated.",
            player,
          };
        }

        // ── Trap ───────────────────────────────────────────────
        case "trap": {
          const trapData = features.trap as {
            type: string;
            dc: number;
            damage: string;
          } | undefined;

          if (!trapData) {
            return { result: "The trap has already been disarmed." };
          }

          if ((features.trap_resolved as boolean | undefined) === true) {
            return { result: "This trap has already been dealt with." };
          }

          // DEX check vs trap DC
          const dexMod = statModifier(stats.dex);
          const check = rollCheck(dexMod, trapData.dc);

          const updatedFeatures = { ...features, trap_resolved: true };
          await ctx.db
            .update(rooms)
            .set({ roomFeatures: updatedFeatures })
            .where(eq(rooms.id, currentRoom.id));

          if (check.success) {
            return {
              result: check.critical
                ? "With incredible reflexes, you not only avoid the trap but disarm it completely!"
                : `You deftly avoid the ${trapData.type} trap!`,
            };
          }

          // Take damage
          const damage = rollDice(trapData.damage);
          const newHp = Math.max(0, character.hp - damage);

          await ctx.db
            .update(characters)
            .set({ hp: newHp, updatedAt: new Date() })
            .where(eq(characters.id, character.id));

          const damagedCharacter = { ...character, hp: newHp };
          const player = buildPlayer(damagedCharacter, items);

          return {
            result: check.fumble
              ? `You stumble right into the ${trapData.type} trap! You take ${damage} damage!`
              : `The ${trapData.type} trap catches you! You take ${damage} damage.`,
            player,
          };
        }

        default: {
          return {
            result: `You examine the ${input.feature}, but nothing happens.`,
          };
        }
      }
    }),

  // ─── Rest ───────────────────────────────────────────────────────────────────
  rest: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y, hierContextFor(character));
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      // Allow resting in safe rooms, shrines, and npc_rooms
      const RESTABLE_ROOMS = ["safe_room", "shrine", "npc_room"];
      if (!RESTABLE_ROOMS.includes(currentRoom.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot rest here. Find a safe room, shrine, or friendly area.",
        });
      }

      // Determine recovery rates — campfire/tavern rooms heal more
      const features = (currentRoom.roomFeatures ?? {}) as Record<string, unknown>;
      const hasCampfire = features.campfire === true;
      const hpPercent = hasCampfire
        ? GAME_CONFIG.REST_TAVERN_HP_PERCENT
        : GAME_CONFIG.REST_HP_PERCENT;
      const mpPercent = hasCampfire
        ? GAME_CONFIG.REST_TAVERN_MP_PERCENT
        : GAME_CONFIG.REST_MP_PERCENT;

      const hpRecovery = Math.ceil(character.hpMax * hpPercent);
      const mpRecovery = Math.ceil(character.mpMax * mpPercent);
      const newHp = Math.min(character.hpMax, character.hp + hpRecovery);
      const newMp = Math.min(character.mpMax, character.mp + mpRecovery);
      const hpGained = newHp - character.hp;
      const mpGained = newMp - character.mp;

      // Update character
      await ctx.db
        .update(characters)
        .set({
          hp: newHp,
          mp: newMp,
          lastSafe: position,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = {
        ...character,
        hp: newHp,
        mp: newMp,
        lastSafe: position,
      };
      const player = buildPlayer(updatedCharacter, items);

      const message = hasCampfire
        ? `You rest by the campfire. Restored ${hpGained} HP and ${mpGained} MP.`
        : `You take a moment to rest. Restored ${hpGained} HP and ${mpGained} MP.`;

      logGameEvent({
        characterId: character.id,
        characterName: character.name,
        userId,
        type: "rest",
        detail: `Rested (+${hpGained} HP, +${mpGained} MP)`,
        metadata: { x: position.x, y: position.y, hpGained, mpGained, campfire: hasCampfire },
      });

      return { player, message };
    }),

  // ─── Shrine ────────────────────────────────────────────────────────────────
  shrine: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y, hierContextFor(character));
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      const features = (currentRoom.roomFeatures ?? {}) as Record<string, unknown>;
      const shrineData = features.shrine as ShrineData | undefined;

      if (!shrineData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is no shrine here.",
        });
      }

      if (shrineData.usesRemaining <= 0) {
        return {
          player: null,
          message: "The shrine has gone dark. Its power is spent.",
        };
      }

      // Decrement shrine uses
      const updatedShrine: ShrineData = {
        ...shrineData,
        usesRemaining: shrineData.usesRemaining - 1,
      };
      const updatedFeatures = {
        ...features,
        shrine: updatedShrine,
        blessing_available: updatedShrine.usesRemaining > 0,
      };

      await ctx.db
        .update(rooms)
        .set({ roomFeatures: updatedFeatures })
        .where(eq(rooms.id, currentRoom.id));

      // Apply shrine effect
      const currentBuffs = (character.buffs as PlayerBuff[]) ?? [];
      let message = "";

      const updates: Partial<{
        hp: number;
        mp: number;
        buffs: PlayerBuff[];
        updatedAt: Date;
      }> = { updatedAt: new Date() };

      switch (shrineData.shrineType) {
        case "healing": {
          updates.hp = character.hpMax;
          updates.mp = character.mpMax;
          message = "Divine light washes over you. HP and MP fully restored!";
          break;
        }
        case "shield": {
          const shieldValue =
            GAME_CONFIG.SHRINE_SHIELD_BASE +
            character.level * GAME_CONFIG.SHRINE_SHIELD_PER_LEVEL;
          // Replace existing shield buff if any
          const filteredBuffs = currentBuffs.filter((b) => b.type !== "shield");
          filteredBuffs.push({ type: "shield", value: shieldValue });
          updates.buffs = filteredBuffs;
          message = `A shimmering shield surrounds you, absorbing up to ${shieldValue} damage.`;
          break;
        }
        case "blessing": {
          // Random: attack or AC blessing
          const blessingRoll = Math.random();
          const filteredBuffs = currentBuffs.filter((b) => b.type !== "blessing");
          if (blessingRoll < 0.5) {
            filteredBuffs.push({
              type: "blessing",
              value: GAME_CONFIG.SHRINE_BLESSING_ATTACK_BONUS,
              stat: "attack",
              combatsRemaining: GAME_CONFIG.SHRINE_BLESSING_COMBATS,
            });
            message = `The shrine blesses you with +${GAME_CONFIG.SHRINE_BLESSING_ATTACK_BONUS} to attack for ${GAME_CONFIG.SHRINE_BLESSING_COMBATS} combats.`;
          } else {
            filteredBuffs.push({
              type: "blessing",
              value: GAME_CONFIG.SHRINE_BLESSING_AC_BONUS,
              stat: "ac",
              combatsRemaining: GAME_CONFIG.SHRINE_BLESSING_COMBATS,
            });
            message = `The shrine blesses you with +${GAME_CONFIG.SHRINE_BLESSING_AC_BONUS} AC for ${GAME_CONFIG.SHRINE_BLESSING_COMBATS} combats.`;
          }
          updates.buffs = filteredBuffs;
          break;
        }
      }

      await ctx.db
        .update(characters)
        .set(updates)
        .where(eq(characters.id, character.id));

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = {
        ...character,
        hp: updates.hp ?? character.hp,
        mp: updates.mp ?? character.mp,
        buffs: updates.buffs ?? currentBuffs,
      };
      const player = buildPlayer(updatedCharacter, items);

      const usesLeft = updatedShrine.usesRemaining;
      if (usesLeft > 0) {
        message += ` (${usesLeft} use${usesLeft === 1 ? "" : "s"} remaining)`;
      } else {
        message += " The shrine grows dim...";
      }

      logGameEvent({
        characterId: character.id,
        characterName: character.name,
        userId,
        type: "shrine",
        detail: `Used ${shrineData.shrineType} shrine`,
        metadata: { x: position.x, y: position.y, shrineType: shrineData.shrineType },
      });

      return { player, message };
    }),

  // ─── Visit Base ────────────────────────────────────────────────────────────
  visitBase: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      if (character.baseLevel < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Base is not yet unlocked. Reach level ${GAME_CONFIG.BASE_UNLOCK_LEVEL} to unlock your base.`,
        });
      }

      // Save current position for return
      const currentPosition = character.position as Position;
      const basePosition: Position = { x: 0, y: 0 };

      await ctx.db
        .update(characters)
        .set({
          position: basePosition,
          lastSafe: currentPosition,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      // Get base room
      const baseRoom = await getRoomAt(ctx.db, character.id, 0, 0, hierContextFor(character));
      if (!baseRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base room not found" });
      }

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = {
        ...character,
        position: basePosition,
        lastSafe: currentPosition,
      };
      const player = buildPlayer(updatedCharacter, items);
      const room = buildRoom(baseRoom);

      return { player, room };
    }),

  // ─── Fast Travel to Base ────────────────────────────────────────────────────
  fastTravelBase: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      if (character.baseLevel < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Base is not yet unlocked. Reach level ${GAME_CONFIG.BASE_UNLOCK_LEVEL} to unlock your base.`,
        });
      }

      // Set position to origin
      const basePosition: Position = { x: 0, y: 0 };
      await ctx.db
        .update(characters)
        .set({
          position: basePosition,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      // Get base room
      const baseRoom = await getRoomAt(ctx.db, character.id, 0, 0, hierContextFor(character));
      if (!baseRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base room not found" });
      }

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, position: basePosition };
      const player = buildPlayer(updatedCharacter, items);
      const room = buildRoom(baseRoom);

      return { player, room };
    }),

  // ─── World Map ──────────────────────────────────────────────────────────────
  getWorldMap: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return getWorldMap(ctx.db, input.characterId, userId);
    }),

  // ─── Region Map ─────────────────────────────────────────────────────────────
  getRegionMap: protectedProcedure
    .input(z.object({ characterId: z.string().uuid(), regionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return getRegionMap(ctx.db, input.characterId, userId, input.regionId);
    }),

  // ─── Travel to Region ──────────────────────────────────────────────────────
  travelToRegion: protectedProcedure
    .input(z.object({ characterId: z.string().uuid(), regionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return travelToRegion(ctx.db, input.characterId, userId, input.regionId);
    }),

  // ─── Travel to Area ────────────────────────────────────────────────────────
  travelToArea: protectedProcedure
    .input(z.object({ characterId: z.string().uuid(), areaId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return travelToArea(ctx.db, input.characterId, userId, input.areaId);
    }),

  // ─── Enter Building ────────────────────────────────────────────────────────
  enterBuilding: protectedProcedure
    .input(z.object({ characterId: z.string().uuid(), buildingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return enterBuilding(ctx.db, input.characterId, userId, input.buildingId);
    }),

  // ─── Exit Building ─────────────────────────────────────────────────────────
  exitBuilding: protectedProcedure
    .input(z.object({ characterId: z.string().uuid(), buildingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return exitBuilding(ctx.db, input.characterId, userId, input.buildingId);
    }),

  // ─── Change Floor ──────────────────────────────────────────────────────────
  changeFloor: protectedProcedure
    .input(z.object({
      characterId: z.string().uuid(),
      direction: z.enum(["up", "down"]),
      currentFloor: z.number().int().min(0),
      buildingId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      return changeFloor(ctx.db, input.characterId, userId, input.direction, input.currentFloor, input.buildingId);
    }),
});
