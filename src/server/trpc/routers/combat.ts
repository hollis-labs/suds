import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  characters,
  rooms,
  inventoryItems,
  combatState as combatStateTable,
} from "@/server/db/schema";
import { initCombat, resolveTurn, calculateRewards, rollChase, type CombatExtra } from "@/server/game/combat";
import { generateLoot, generateGoldDrop } from "@/server/game/loot";
import { generateEncounter } from "@/server/game/encounters";
import { calculateLevelUp } from "@/server/game/player";
import { directionToOffset, computeMapViewport, roomKey } from "@/server/game/map";
import { generateAdventurer, rollAdventurerAppearance, rollAdventurerHelps } from "@/server/game/companion";
import { GAME_CONFIG } from "@/lib/constants";
import { logGameEvent } from "@/server/game/events";
import { buildEquipmentSlots } from "@/server/game/equipment";
import type { CharacterClass, Theme } from "@/lib/constants";
import type {
  Player,
  PlayerBuff,
  Room as RoomType,
  Position,
  MonsterEncounter,
  Companion,
  GameItem,
  Stats,
  CombatState,
  CombatAction,
  CombatLogEntry,
  Monster,
  MapViewport,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers (shared with game.ts — ideally extract later)
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

/**
 * Inject player-level buffs (shield, blessing) into combat extra at combat start.
 * Shield -> damageAbsorb buff. Blessing -> attackBonus or acBonus buff.
 */
function injectPlayerBuffs(extra: CombatExtra, playerBuffs: PlayerBuff[]): void {
  for (const buff of playerBuffs) {
    if (buff.type === "shield" && buff.value > 0) {
      extra.playerBuffs.push({
        name: "shrine_shield",
        damageAbsorb: buff.value,
        roundsRemaining: 999, // lasts until depleted
      });
    }
    if (buff.type === "blessing" && buff.combatsRemaining && buff.combatsRemaining > 0) {
      if (buff.stat === "attack") {
        extra.playerBuffs.push({
          name: "shrine_blessing_attack",
          attackBonus: buff.value,
          roundsRemaining: 999, // lasts entire combat
        });
      } else if (buff.stat === "ac") {
        extra.playerBuffs.push({
          name: "shrine_blessing_ac",
          acBonus: buff.value,
          roundsRemaining: 999, // lasts entire combat
        });
      }
    }
  }
}

/**
 * After combat ends, decrement blessing combatsRemaining and deplete shield if used.
 * Returns updated buffs array for DB persistence.
 */
function decrementPlayerBuffs(
  playerBuffs: PlayerBuff[],
  combatExtra: CombatExtra
): PlayerBuff[] {
  const updated: PlayerBuff[] = [];
  for (const buff of playerBuffs) {
    if (buff.type === "shield") {
      // Check if shield was consumed in combat
      const shieldBuff = combatExtra.playerBuffs.find((b) => b.name === "shrine_shield");
      const remainingAbsorb = shieldBuff?.damageAbsorb ?? 0;
      if (remainingAbsorb > 0) {
        updated.push({ ...buff, value: remainingAbsorb });
      }
      // If depleted, don't add back
    } else if (buff.type === "blessing") {
      const remaining = (buff.combatsRemaining ?? 1) - 1;
      if (remaining > 0) {
        updated.push({ ...buff, combatsRemaining: remaining });
      }
      // If expired, don't add back
    } else {
      updated.push(buff);
    }
  }
  return updated;
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

/** Get room at position — handles shared (world) and legacy (per-character) rooms */
async function getRoomAt(
  db: DbClient,
  characterId: string,
  x: number,
  y: number,
  context?: { areaId?: string | null; buildingId?: string | null; floor?: number | null }
) {
  if (context?.areaId) {
    const conditions = [eq(rooms.x, x), eq(rooms.y, y)];
    if (context.buildingId) {
      conditions.push(eq(rooms.buildingId, context.buildingId));
      if (context.floor != null) conditions.push(eq(rooms.floor, context.floor));
    } else {
      conditions.push(eq(rooms.areaId, context.areaId));
      conditions.push(isNull(rooms.buildingId));
    }
    const [sharedRoom] = await db.select().from(rooms).where(and(...conditions));
    if (sharedRoom) return sharedRoom;
  }
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.characterId, characterId), eq(rooms.x, x), eq(rooms.y, y)));
  return room ?? null;
}

/** Build hierarchy context for room lookups from a character record */
function hierContextFor(character: typeof characters.$inferSelect) {
  return character.worldId
    ? { areaId: character.currentAreaId, buildingId: character.currentBuildingId, floor: character.currentFloor }
    : undefined;
}

/** Build typed Room from a DB row */
function buildRoom(row: typeof rooms.$inferSelect): RoomType {
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
  };
}

/** Build room map for viewport computation */
function buildRoomMap(rows: (typeof rooms.$inferSelect)[]): Map<string, RoomType> {
  const map = new Map<string, RoomType>();
  for (const row of rows) {
    map.set(roomKey(row.x, row.y), buildRoom(row));
  }
  return map;
}

/** Get all rooms visible to a character (shared or legacy) */
async function getCharacterRooms(db: DbClient, character: typeof characters.$inferSelect) {
  if (character.worldId && character.currentAreaId) {
    const conditions = character.currentBuildingId
      ? [
          eq(rooms.buildingId, character.currentBuildingId),
          ...(character.currentFloor != null ? [eq(rooms.floor, character.currentFloor)] : []),
        ]
      : [eq(rooms.areaId, character.currentAreaId), isNull(rooms.buildingId)];
    return db.select().from(rooms).where(and(...conditions));
  }
  return db.select().from(rooms).where(eq(rooms.characterId, character.id));
}

/** Get full room + mapViewport data for a flee destination */
async function getFleeRoomData(
  db: DbClient,
  character: typeof characters.$inferSelect,
  x: number,
  y: number,
): Promise<{ room: RoomType; mapViewport: MapViewport }> {
  const roomRow = await getRoomAt(db, character.id, x, y, hierContextFor(character));
  if (!roomRow) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Flee destination room not found" });
  }
  const room = buildRoom(roomRow);

  const allRooms = await getCharacterRooms(db, character);

  const mapViewport = computeMapViewport({ x, y }, buildRoomMap(allRooms));

  return { room, mapViewport };
}

/** Get active combat state for a character, or null */
async function getActiveCombat(db: DbClient, characterId: string) {
  const [state] = await db
    .select()
    .from(combatStateTable)
    .where(eq(combatStateTable.characterId, characterId));
  return state ?? null;
}

/** Serialize CombatExtra for JSONB storage (Map -> object) */
function serializeExtra(extra: CombatExtra): Record<string, unknown> {
  return {
    playerBuffs: extra.playerBuffs,
    monsterBuffs: Object.fromEntries(extra.monsterBuffs),
    roundNumber: extra.roundNumber,
    aggro: extra.aggro,
  };
}

/** Deserialize CombatExtra from JSONB */
function deserializeExtra(data: Record<string, unknown> | null): CombatExtra {
  if (!data) {
    return { playerBuffs: [], monsterBuffs: new Map(), roundNumber: 1, aggro: 5 };
  }
  const mb = (data.monsterBuffs ?? {}) as Record<string, unknown[]>;
  return {
    playerBuffs: (data.playerBuffs ?? []) as CombatExtra["playerBuffs"],
    monsterBuffs: new Map(Object.entries(mb).map(([k, v]) => [Number(k), v as CombatExtra["playerBuffs"]])),
    roundNumber: (data.roundNumber ?? 1) as number,
    aggro: (data.aggro ?? 5) as number,
  };
}

/** Convert DB combat row to typed CombatState + extra */
function buildCombatState(
  row: typeof combatStateTable.$inferSelect
): { state: CombatState; extra: CombatExtra } {
  const turnOrderData = row.turnOrder as { order: CombatState["turnOrder"]; extra?: Record<string, unknown> };
  return {
    state: {
      id: row.id,
      monsters: row.monsters as Monster[],
      companion: (row.companion as Companion) ?? null,
      turnOrder: Array.isArray(row.turnOrder) ? row.turnOrder as CombatState["turnOrder"] : turnOrderData.order,
      currentTurn: row.currentTurn,
      round: row.round,
      log: row.log as CombatLogEntry[],
    },
    extra: Array.isArray(row.turnOrder) ? deserializeExtra(null) : deserializeExtra(turnOrderData.extra ?? null),
  };
}

// ---------------------------------------------------------------------------
// Death / Respawn
// ---------------------------------------------------------------------------

/** Preview death penalty without applying it (save hp=0 to DB) */
async function calculateDeathPenalty(
  character: typeof characters.$inferSelect,
  db: DbClient
): Promise<{ respawnPosition: Position; goldLost: number }> {
  const goldLost = Math.floor(character.gold * GAME_CONFIG.DEATH_GOLD_PENALTY);
  const respawnPosition = character.lastSafe as Position;

  // Save the character as dead (hp=0) but don't heal/move yet — respawn does that
  await db
    .update(characters)
    .set({ hp: 0, updatedAt: new Date() })
    .where(eq(characters.id, character.id));

  return { respawnPosition, goldLost };
}

/** Actually apply death: heal, reposition, deduct gold. Called by combat.respawn. */
async function applyRespawn(
  characterId: string,
  db: DbClient
): Promise<{ respawnPosition: Position; goldLost: number }> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId));

  if (!character) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
  }

  const goldLost = Math.floor(character.gold * GAME_CONFIG.DEATH_GOLD_PENALTY);
  const respawnPosition = character.lastSafe as Position;

  await db
    .update(characters)
    .set({
      hp: character.hpMax,
      mp: character.mpMax,
      position: respawnPosition,
      gold: Math.max(0, character.gold - goldLost),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId));

  return { respawnPosition, goldLost };
}

// ---------------------------------------------------------------------------
// Level-up application
// ---------------------------------------------------------------------------

interface LevelUpResult {
  newLevel: number;
  hpGained: number;
  statIncreased: string;
  newAbilities: string[];
  xpNext: number;
}

async function applyLevelUp(
  db: DbClient,
  character: typeof characters.$inferSelect,
  totalXp: number
): Promise<LevelUpResult | null> {
  if (
    totalXp < character.xpNext ||
    character.level >= GAME_CONFIG.MAX_LEVEL
  ) {
    return null;
  }

  const levelUp = calculateLevelUp(
    character.level,
    character.stats as Stats,
    character.class as CharacterClass
  );

  // Build updated stats with +1 to primary
  const updatedStats = { ...(character.stats as Stats) };
  if (levelUp.statIncreased in updatedStats) {
    (updatedStats as Record<string, number>)[levelUp.statIncreased] += 1;
  }

  // Merge new abilities
  const updatedAbilities = [
    ...character.abilities,
    ...levelUp.newAbilities,
  ];

  // Unlock base if reaching the unlock level
  const unlockBase =
    levelUp.newLevel >= GAME_CONFIG.BASE_UNLOCK_LEVEL &&
    character.baseLevel < 1;

  await db
    .update(characters)
    .set({
      level: levelUp.newLevel,
      hpMax: character.hpMax + levelUp.hpGained,
      hp: character.hpMax + levelUp.hpGained, // full HP on level up
      xp: totalXp,
      xpNext: levelUp.xpNext,
      stats: updatedStats,
      abilities: updatedAbilities,
      ...(unlockBase ? { baseLevel: 1 } : {}),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, character.id));

  return levelUp;
}

// ---------------------------------------------------------------------------
// Combat Router
// ---------------------------------------------------------------------------

const combatActionSchema = z.enum([
  "attack",
  "defend",
  "cast",
  "flee",
  "use_item",
]);

export const combatRouter = router({
  // ─── Get State ──────────────────────────────────────────────────────────────
  getState: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await getOwnedCharacter(ctx.db, input.characterId, userId);

      const row = await getActiveCombat(ctx.db, input.characterId);
      if (!row) return null;

      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const combatResult = buildCombatState(row);
      // Companion is persisted in combat_state row; fall back to character data for legacy rows
      if (!combatResult.state.companion) {
        combatResult.state.companion = (character.companion as Companion) ?? null;
      }
      return combatResult.state;
    }),

  // ─── Start Combat ───────────────────────────────────────────────────────────
  start: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      // Check for existing combat — clean up stale state
      const existing = await getActiveCombat(ctx.db, input.characterId);
      if (existing) {
        // If it's from a different encounter (no matching room encounter),
        // or the player already won/fled, delete it and start fresh.
        const { state: existingState, extra: existingExtra } = buildCombatState(existing);
        // Companion is now persisted in combat_state row; fall back to character data for legacy rows
        if (!existingState.companion) {
          existingState.companion = (character.companion as Companion) ?? null;
        }

        // Auto-resolve any pending monster turns so the client gets a player-turn state
        let currentState = existingState;
        let currentExtra = existingExtra;
        const existingItems = await ctx.db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.characterId, character.id));
        let existingPlayer = buildPlayer(character, existingItems);
        let existingCombatOver = false;
        let existingVictory = false;

        while (
          currentState.turnOrder[currentState.currentTurn]?.type === "monster" ||
          currentState.turnOrder[currentState.currentTurn]?.type === "companion"
        ) {
          const entry = currentState.turnOrder[currentState.currentTurn]!;
          const turnResult = resolveTurn(
            currentState,
            existingPlayer,
            "attack" as CombatAction,
            currentExtra,
            entry.type === "monster" ? (entry.index ?? 0) : undefined,
          );
          currentState = turnResult.state;
          currentExtra = turnResult.extra;
          existingPlayer = turnResult.player;
          if (turnResult.combatOver) {
            existingCombatOver = true;
            existingVictory = turnResult.victory;
            break;
          }
        }

        // If player died during auto-resolution of existing combat
        if (existingCombatOver && !existingVictory) {
          await ctx.db
            .delete(combatStateTable)
            .where(eq(combatStateTable.characterId, character.id));
          const deathResult = await calculateDeathPenalty(character, ctx.db);
          const [updatedChar] = await ctx.db
            .select()
            .from(characters)
            .where(eq(characters.id, character.id));
          const updatedItems = await ctx.db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.characterId, character.id));
          const updatedPlayer = buildPlayer(updatedChar!, updatedItems);
          return {
            combatOver: true as const,
            victory: false as const,
            player: updatedPlayer,
            log: currentState.log,
            goldLost: deathResult.goldLost,
            respawnPosition: deathResult.respawnPosition,
          };
        }

        // Save player HP/MP changes + updated combat state
        if (existingPlayer.hp !== character.hp || existingPlayer.mp !== character.mp) {
          await ctx.db
            .update(characters)
            .set({ hp: existingPlayer.hp, mp: existingPlayer.mp, updatedAt: new Date() })
            .where(eq(characters.id, character.id));
        }

        await ctx.db
          .update(combatStateTable)
          .set({
            monsters: currentState.monsters,
            companion: currentState.companion ?? null,
            turnOrder: { order: currentState.turnOrder, extra: serializeExtra(currentExtra) },
            currentTurn: currentState.currentTurn,
            round: currentState.round,
            log: currentState.log,
          })
          .where(eq(combatStateTable.characterId, character.id));

        const [refreshedChar] = await ctx.db
          .select()
          .from(characters)
          .where(eq(characters.id, character.id));
        const refreshedItems = await ctx.db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.characterId, character.id));
        const refreshedPlayer = buildPlayer(refreshedChar!, refreshedItems);

        return {
          combatOver: false as const,
          state: currentState,
          player: refreshedPlayer,
          log: currentState.log,
        };
      }

      // Get current room
      const position = character.position as Position;
      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y, hierContextFor(character));

      if (!currentRoom) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Current room not found",
        });
      }

      if (!currentRoom.hasEncounter || !currentRoom.encounterData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No encounter in this room",
        });
      }

      const encounter = currentRoom.encounterData as MonsterEncounter;

      // Build player for combat engine
      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));
      const player = buildPlayer(character, items);

      // Initialize combat via engine (include companion if active)
      const companion = player.companion ?? null;
      const { state, extra } = initCombat(player, encounter, companion);

      // Inject player-level buffs (shield, blessing) into combat
      if (player.buffs && player.buffs.length > 0) {
        injectPlayerBuffs(extra, player.buffs);
        // Log active buffs
        for (const buff of player.buffs) {
          if (buff.type === "shield" && buff.value > 0) {
            state.log.push({
              round: 0,
              actor: "system",
              action: "info",
              result: `Your shrine shield absorbs up to ${buff.value} damage.`,
            });
          }
          if (buff.type === "blessing" && buff.combatsRemaining && buff.combatsRemaining > 0) {
            state.log.push({
              round: 0,
              actor: "system",
              action: "info",
              result: `Shrine blessing active: +${buff.value} ${buff.stat} (${buff.combatsRemaining} combats remaining).`,
            });
          }
        }
      }

      // Add initiative log messages
      const monsterNames = encounter.monsters.map((m) => m.name).join(", ");
      state.log.push({
        round: 0,
        actor: "system",
        action: "info",
        result: `Rolling for initiative... You face: ${monsterNames}!`,
      });

      if (companion && companion.hp > 0) {
        state.log.push({
          round: 0,
          actor: "system",
          action: "info",
          result: `${companion.name} fights alongside you!`,
        });
      }

      const playerTurnEntry = state.turnOrder.findIndex((e) => e.type === "player");
      if (playerTurnEntry === 0) {
        state.log.push({
          round: 0,
          actor: "system",
          action: "info",
          result: `${player.name} wins initiative and goes first!`,
        });
      } else {
        state.log.push({
          round: 0,
          actor: "system",
          action: "info",
          result: `The enemies seize the initiative!`,
        });
      }

      // If monsters go first, auto-resolve their turns
      let currentState = state;
      let currentExtra = extra;
      let autoResolvePlayer = player;
      let autoResolveCombatOver = false;
      let autoResolveVictory = false;
      while (
        currentState.turnOrder[currentState.currentTurn]?.type === "monster" ||
        currentState.turnOrder[currentState.currentTurn]?.type === "companion"
      ) {
        const entry = currentState.turnOrder[currentState.currentTurn]!;
        const turnResult = resolveTurn(
          currentState,
          autoResolvePlayer,
          "attack" as CombatAction,
          currentExtra,
          entry.type === "monster" ? (entry.index ?? 0) : undefined,
        );
        currentState = turnResult.state;
        currentExtra = turnResult.extra;
        autoResolvePlayer = turnResult.player;
        if (turnResult.combatOver) {
          autoResolveCombatOver = true;
          autoResolveVictory = turnResult.victory;
          break;
        }
      }

      // If player died during monster auto-resolution (before their first turn)
      if (autoResolveCombatOver && !autoResolveVictory) {
        // Player killed before getting a turn — save as dead, don't heal yet
        const deathResult = await calculateDeathPenalty(character, ctx.db);

        // Refresh player
        const [updatedChar] = await ctx.db
          .select()
          .from(characters)
          .where(eq(characters.id, character.id));
        const updatedItems = await ctx.db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.characterId, character.id));
        const updatedPlayer = buildPlayer(updatedChar!, updatedItems);

        return {
          combatOver: true as const,
          victory: false as const,
          player: updatedPlayer,
          log: currentState.log,
          goldLost: deathResult.goldLost,
          respawnPosition: deathResult.respawnPosition,
        };
      }

      // Save player HP/MP if monsters dealt damage during auto-resolution
      if (autoResolvePlayer.hp !== player.hp || autoResolvePlayer.mp !== player.mp) {
        await ctx.db
          .update(characters)
          .set({
            hp: autoResolvePlayer.hp,
            mp: autoResolvePlayer.mp,
            updatedAt: new Date(),
          })
          .where(eq(characters.id, character.id));
      }

      // Persist combat state to DB
      const [inserted] = await ctx.db
        .insert(combatStateTable)
        .values({
          characterId: character.id,
          monsters: currentState.monsters,
          companion: currentState.companion ?? null,
          turnOrder: { order: currentState.turnOrder, extra: serializeExtra(currentExtra) },
          currentTurn: currentState.currentTurn,
          round: currentState.round,
          log: currentState.log,
        })
        .returning();

      const built = buildCombatState(inserted!);

      // Return combat state + updated player so client reflects HP changes
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));
      const [refreshedChar] = await ctx.db
        .select()
        .from(characters)
        .where(eq(characters.id, character.id));
      const refreshedPlayer = buildPlayer(refreshedChar!, refreshedItems);

      return {
        combatOver: false as const,
        state: built.state,
        player: refreshedPlayer,
        log: currentState.log,
      };
    }),

  // ─── Combat Action ──────────────────────────────────────────────────────────
  action: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        action: combatActionSchema,
        targetIndex: z.number().int().min(0).optional(),
        itemId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      const combatRow = await getActiveCombat(ctx.db, input.characterId);
      if (!combatRow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active combat",
        });
      }

      const { state: currentState, extra: currentExtra } = buildCombatState(combatRow);
      // Companion is persisted in combat_state row; fall back to character data for legacy rows
      if (!currentState.companion) {
        currentState.companion = (character.companion as Companion) ?? null;
      }

      // Build player
      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));
      const player = buildPlayer(character, items);

      // Resolve player turn
      let turnResult = resolveTurn(
        currentState,
        player,
        input.action as CombatAction,
        currentExtra,
        input.targetIndex,
        input.itemId
      );

      // Resolve monster + companion turns until it's the player's turn again (or combat ends)
      while (
        !turnResult.combatOver &&
        (turnResult.state.turnOrder[turnResult.state.currentTurn]?.type === "monster" ||
         turnResult.state.turnOrder[turnResult.state.currentTurn]?.type === "companion")
      ) {
        const entry = turnResult.state.turnOrder[turnResult.state.currentTurn]!;
        turnResult = resolveTurn(
          turnResult.state,
          turnResult.player,
          "attack" as CombatAction,
          turnResult.extra,
          entry.type === "monster" ? (entry.index ?? 0) : undefined,
        );
      }

      // ── Combat Over ─────────────────────────────────────────────────────────
      if (turnResult.combatOver) {
        // Delete combat state
        await ctx.db
          .delete(combatStateTable)
          .where(eq(combatStateTable.characterId, character.id));

        if (turnResult.victory) {
          // Calculate rewards
          const rewards = calculateRewards(currentState.monsters);

          // Generate loot
          const position = character.position as Position;
          const depth = Math.abs(position.x) + Math.abs(position.y);
          const theme = character.theme as Theme;
          const lootItems = generateLoot(character.level, depth, theme);
          const goldDrop = generateGoldDrop(character.level, depth);
          const totalGold = rewards.gold + goldDrop;

          // Apply XP
          const newXp = character.xp + rewards.xp;

          // Check level up
          const levelUp = await applyLevelUp(ctx.db, character, newXp);

          // Decrement player buffs after combat
          const currentBuffs = (character.buffs as PlayerBuff[]) ?? [];
          const updatedBuffs = decrementPlayerBuffs(currentBuffs, turnResult.extra);

          // If no level up, just update xp/gold/hp/buffs
          if (!levelUp) {
            await ctx.db
              .update(characters)
              .set({
                xp: newXp,
                gold: character.gold + totalGold,
                hp: turnResult.player.hp,
                mp: turnResult.player.mp,
                buffs: updatedBuffs,
                updatedAt: new Date(),
              })
              .where(eq(characters.id, character.id));
          } else {
            // Level up already saved xp/stats/level — just add gold, sync hp/mp, and update buffs
            await ctx.db
              .update(characters)
              .set({
                gold: character.gold + totalGold,
                buffs: updatedBuffs,
                updatedAt: new Date(),
              })
              .where(eq(characters.id, character.id));
          }

          // Add loot to inventory
          for (const item of lootItems) {
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

          // Update companion HP after combat (or clear if dead)
          if (turnResult.state.companion) {
            if (turnResult.state.companion.hp <= 0) {
              // Companion died — break the bond
              await ctx.db
                .update(characters)
                .set({ companion: null, updatedAt: new Date() })
                .where(eq(characters.id, character.id));
              turnResult.state.log.push({
                round: turnResult.state.round,
                actor: "system",
                action: "info",
                result: `${turnResult.state.companion.name} has fallen in battle. Their journey ends here.`,
              });
            } else {
              // Sync companion HP
              await ctx.db
                .update(characters)
                .set({ companion: turnResult.state.companion, updatedAt: new Date() })
                .where(eq(characters.id, character.id));
            }
          }

          // Clear encounter from room
          const pos = character.position as Position;
          const currentRoom = await getRoomAt(ctx.db, character.id, pos.x, pos.y, hierContextFor(character));

          if (currentRoom) {
            await ctx.db
              .update(rooms)
              .set({
                hasEncounter: false,
                encounterData: null,
              })
              .where(eq(rooms.id, currentRoom.id));
          }

          // Refresh player for response
          const [updatedChar] = await ctx.db
            .select()
            .from(characters)
            .where(eq(characters.id, character.id));
          const updatedItems = await ctx.db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.characterId, character.id));
          const updatedPlayer = buildPlayer(updatedChar!, updatedItems);

          logGameEvent({
            characterId: character.id,
            characterName: character.name,
            userId,
            type: "combat_victory",
            detail: `Defeated ${turnResult.state.monsters.map((m: Monster) => m.name).join(", ")} (+${rewards.xp} XP, +${totalGold}g)`,
            metadata: { xp: rewards.xp, gold: totalGold, loot: lootItems.length },
          });
          if (levelUp) {
            logGameEvent({
              characterId: character.id,
              characterName: character.name,
              userId,
              type: "level_up",
              detail: `Leveled up to ${levelUp.newLevel}`,
              metadata: { newLevel: levelUp.newLevel },
            });
          }

          return {
            combatOver: true as const,
            victory: true as const,
            player: updatedPlayer,
            log: turnResult.state.log,
            rewards: {
              xp: rewards.xp,
              gold: totalGold,
              items: lootItems,
            },
            levelUp: levelUp ?? undefined,
          };
        }

        // ── Fled ──────────────────────────────────────────────────────────
        const fled = turnResult.state.round === -1;
        if (fled) {
          const position = character.position as Position;
          const hCtx = hierContextFor(character);
          const currentRoomRow = await getRoomAt(ctx.db, character.id, position.x, position.y, hCtx);
          const exits = currentRoomRow?.exits ?? [];

          // Filter exits to only those with existing rooms in DB
          const validExits: string[] = [];
          for (const exit of exits) {
            const off = directionToOffset(exit as "north" | "south" | "east" | "west");
            const room = await getRoomAt(ctx.db, character.id, position.x + off.x, position.y + off.y, hCtx);
            if (room) validExits.push(exit);
          }

          if (validExits.length === 0) {
            // No reachable exits — flee fails, combat continues
            turnResult.state.round = currentExtra.roundNumber;
            turnResult.state.log.push({
              round: currentExtra.roundNumber,
              actor: "system",
              action: "info",
              result: "There's nowhere to run!",
            });
            // Fall through to combat-continues below
          } else {
            // Pick a random valid exit and move player
            const exitDir = validExits[Math.floor(Math.random() * validExits.length)]!;
            const offset = directionToOffset(exitDir as "north" | "south" | "east" | "west");
            const newX = position.x + offset.x;
            const newY = position.y + offset.y;
            const newPosition = { x: newX, y: newY };

            // Move character
            await ctx.db
              .update(characters)
              .set({ position: newPosition, updatedAt: new Date() })
              .where(eq(characters.id, character.id));

            // Roll chase for each alive monster
            const { chasers, aggroAfter } = rollChase(
              turnResult.state.monsters,
              currentExtra.aggro
            );

            const fleeLog = [...turnResult.state.log];
            fleeLog.push({
              round: currentExtra.roundNumber,
              actor: "system",
              action: "info",
              result: `You flee ${exitDir}!`,
            });

            if (chasers.length > 0) {
              // Some monsters give chase — end current combat, transition room,
              // return chasers so client can start fresh combat with new initiative
              const chaserNames = chasers.map((i) => turnResult.state.monsters[i]!.name);
              fleeLog.push({
                round: currentExtra.roundNumber,
                actor: "system",
                action: "info",
                result: `${chaserNames.join(", ")} ${chasers.length === 1 ? "gives" : "give"} chase!`,
              });

              const chasingMonsters = chasers.map((i) => ({ ...turnResult.state.monsters[i]! }));

              // Delete old combat state — fresh combat will be started by client
              await ctx.db
                .delete(combatStateTable)
                .where(eq(combatStateTable.characterId, character.id));

              // Clear encounter from the original room
              if (currentRoomRow) {
                await ctx.db
                  .update(rooms)
                  .set({ hasEncounter: false, encounterData: null })
                  .where(eq(rooms.id, currentRoomRow.id));
              }

              // Save player HP, apply aggro cooldown, and decrement buffs
              const fleeChaseBuffs = decrementPlayerBuffs(
                (character.buffs as PlayerBuff[]) ?? [],
                turnResult.extra
              );
              await ctx.db
                .update(characters)
                .set({
                  hp: turnResult.player.hp,
                  mp: turnResult.player.mp,
                  buffs: fleeChaseBuffs,
                  updatedAt: new Date(),
                })
                .where(eq(characters.id, character.id));

              const [updatedChar] = await ctx.db
                .select()
                .from(characters)
                .where(eq(characters.id, character.id));
              const updatedItems = await ctx.db
                .select()
                .from(inventoryItems)
                .where(eq(inventoryItems.characterId, character.id));
              const updatedPlayer = buildPlayer(updatedChar!, updatedItems);

              // Store the encounter on the new room so combat.start picks it up
              const newRoomRow = await getRoomAt(ctx.db, character.id, newX, newY, hCtx);
              if (newRoomRow) {
                await ctx.db
                  .update(rooms)
                  .set({
                    hasEncounter: true,
                    encounterData: { monsters: chasingMonsters },
                  })
                  .where(eq(rooms.id, newRoomRow.id));
              }

              // Get full room data for client transition
              const fleeRoomData = await getFleeRoomData(ctx.db, character, newX, newY);

              logGameEvent({
                characterId: character.id,
                characterName: character.name,
                userId,
                type: "combat_flee",
                detail: `Fled ${exitDir} (chased!)`,
                metadata: { direction: exitDir, chased: true },
              });

              return {
                combatOver: true as const,
                victory: false as const,
                fled: true as const,
                chased: true as const,
                player: updatedPlayer,
                log: fleeLog,
                newRoom: fleeRoomData.room,
                mapViewport: fleeRoomData.mapViewport,
              };
            }

            // No chasers — combat ends, clear state
            fleeLog.push({
              round: currentExtra.roundNumber,
              actor: "system",
              action: "info",
              result: "You lost them!",
            });

            await ctx.db
              .delete(combatStateTable)
              .where(eq(combatStateTable.characterId, character.id));

            // Clear encounter from the original room
            if (currentRoomRow) {
              await ctx.db
                .update(rooms)
                .set({ hasEncounter: false, encounterData: null })
                .where(eq(rooms.id, currentRoomRow.id));
            }

            // Save player HP and decrement buffs
            const fleeCleanBuffs = decrementPlayerBuffs(
              (character.buffs as PlayerBuff[]) ?? [],
              turnResult.extra
            );
            await ctx.db
              .update(characters)
              .set({
                hp: turnResult.player.hp,
                mp: turnResult.player.mp,
                buffs: fleeCleanBuffs,
                updatedAt: new Date(),
              })
              .where(eq(characters.id, character.id));

            const [updatedChar] = await ctx.db
              .select()
              .from(characters)
              .where(eq(characters.id, character.id));
            const updatedItems = await ctx.db
              .select()
              .from(inventoryItems)
              .where(eq(inventoryItems.characterId, character.id));
            const updatedPlayer = buildPlayer(updatedChar!, updatedItems);

            // Get full room data for client transition
            const fleeRoomData = await getFleeRoomData(ctx.db, character, newX, newY);

            // Check for encounter in new room
            let newEncounter = false;
            if (fleeRoomData.room.hasEncounter && fleeRoomData.room.encounterData) {
              newEncounter = true;
            }

            // Roll for NPC adventurer encounter while fleeing
            let adventurerMet: Companion | null = null;
            let adventurerHelps = false;
            if (!updatedPlayer.companion) {
              const hpPercent = updatedPlayer.hp / updatedPlayer.hpMax;
              if (rollAdventurerAppearance(hpPercent)) {
                const adventurer = generateAdventurer(updatedPlayer.level);
                adventurerMet = adventurer;
                if (rollAdventurerHelps()) {
                  adventurerHelps = true;
                  fleeLog.push({
                    round: currentExtra.roundNumber,
                    actor: adventurer.name,
                    action: "info",
                    result: `"Hey! You look like you could use a hand!" ${adventurer.name} readies their weapon.`,
                  });
                } else {
                  fleeLog.push({
                    round: currentExtra.roundNumber,
                    actor: adventurer.name,
                    action: "info",
                    result: `You pass ${adventurer.name} in the corridor. "Good luck in there!" they say, hurrying the other way.`,
                  });
                  adventurerMet = null; // They didn't help, don't track
                }
              }
            }

            logGameEvent({
              characterId: character.id,
              characterName: character.name,
              userId,
              type: "combat_flee",
              detail: `Fled ${exitDir} successfully`,
              metadata: { direction: exitDir, chased: false },
            });

            return {
              combatOver: true as const,
              victory: false as const,
              fled: true as const,
              chased: false as const,
              player: updatedPlayer,
              log: fleeLog,
              newRoom: fleeRoomData.room,
              mapViewport: fleeRoomData.mapViewport,
              newEncounter,
              adventurerMet: adventurerHelps ? adventurerMet : null,
            };
          }
        }

        // ── Defeat ──────────────────────────────────────────────────────────
        const deathResult = await calculateDeathPenalty(character, ctx.db);

        logGameEvent({
          characterId: character.id,
          characterName: character.name,
          userId,
          type: "death",
          detail: `Defeated in combat (-${deathResult.goldLost}g)`,
          metadata: { goldLost: deathResult.goldLost },
        });

        // Refresh player
        const [updatedChar] = await ctx.db
          .select()
          .from(characters)
          .where(eq(characters.id, character.id));
        const updatedItems = await ctx.db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.characterId, character.id));
        const updatedPlayer = buildPlayer(updatedChar!, updatedItems);

        return {
          combatOver: true as const,
          victory: false as const,
          player: updatedPlayer,
          log: turnResult.state.log,
          goldLost: deathResult.goldLost,
          respawnPosition: deathResult.respawnPosition,
        };
      }

      // ── Combat Continues ──────────────────────────────────────────────────
      // Save updated combat state
      await ctx.db
        .update(combatStateTable)
        .set({
          monsters: turnResult.state.monsters,
          companion: turnResult.state.companion ?? null,
          turnOrder: { order: turnResult.state.turnOrder, extra: serializeExtra(turnResult.extra) },
          currentTurn: turnResult.state.currentTurn,
          round: turnResult.state.round,
          log: turnResult.state.log,
        })
        .where(eq(combatStateTable.characterId, character.id));

      // Sync shield absorb from combat extra back to player buffs so UI shows current value
      const currentBuffs = (character.buffs as PlayerBuff[]) ?? [];
      const syncedBuffs = currentBuffs.map((buff) => {
        if (buff.type === "shield") {
          const shieldBuff = turnResult.extra.playerBuffs.find((b) => b.name === "shrine_shield");
          const remainingAbsorb = shieldBuff?.damageAbsorb ?? 0;
          return { ...buff, value: remainingAbsorb };
        }
        return buff;
      }).filter((buff) => buff.type !== "shield" || buff.value > 0);

      // Save updated player HP/MP/buffs
      await ctx.db
        .update(characters)
        .set({
          hp: turnResult.player.hp,
          mp: turnResult.player.mp,
          buffs: syncedBuffs,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      // Refresh player for response
      const [refreshedChar] = await ctx.db
        .select()
        .from(characters)
        .where(eq(characters.id, character.id));
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));
      const refreshedPlayer = buildPlayer(refreshedChar!, refreshedItems);

      return {
        combatOver: false as const,
        state: turnResult.state,
        player: refreshedPlayer,
        log: turnResult.state.log,
      };
    }),

  // ─── Respawn ────────────────────────────────────────────────────────────────
  respawn: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      // Clean up any lingering combat state
      await ctx.db
        .delete(combatStateTable)
        .where(eq(combatStateTable.characterId, input.characterId));

      // Apply respawn: heal, reposition, deduct gold
      const deathResult = await applyRespawn(input.characterId, ctx.db);

      // Fetch updated player
      const [updatedChar] = await ctx.db
        .select()
        .from(characters)
        .where(eq(characters.id, input.characterId));
      const updatedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, input.characterId));
      const player = buildPlayer(updatedChar!, updatedItems);

      // Fetch respawn room
      const respawnRoom = await getRoomAt(
        ctx.db,
        input.characterId,
        deathResult.respawnPosition.x,
        deathResult.respawnPosition.y,
        hierContextFor(updatedChar!)
      );

      if (!respawnRoom) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Respawn room not found",
        });
      }

      logGameEvent({
        characterId: character.id,
        characterName: character.name,
        userId,
        type: "respawn",
        detail: `Respawned at ${respawnRoom.name} (-${deathResult.goldLost}g)`,
        metadata: { goldLost: deathResult.goldLost, x: deathResult.respawnPosition.x, y: deathResult.respawnPosition.y },
      });

      return {
        player,
        room: {
          id: respawnRoom.id,
          x: respawnRoom.x,
          y: respawnRoom.y,
          name: respawnRoom.name,
          type: respawnRoom.type,
          description: respawnRoom.description,
          exits: respawnRoom.exits,
          depth: respawnRoom.depth,
          hasEncounter: respawnRoom.hasEncounter,
          encounterData: respawnRoom.encounterData as MonsterEncounter | null,
          hasLoot: respawnRoom.hasLoot,
          lootData: respawnRoom.lootData as GameItem[] | null,
          visited: respawnRoom.visited,
          roomFeatures: (respawnRoom.roomFeatures ?? {}) as Record<string, unknown>,
        } satisfies RoomType,
        goldLost: deathResult.goldLost,
      };
    }),

  // ── Companion: Party Up ──────────────────────────────────────────────
  partyUp: protectedProcedure
    .input(z.object({
      characterId: z.string().uuid(),
      companion: z.object({
        id: z.string(),
        name: z.string(),
        class: z.string(),
        level: z.number(),
        hp: z.number(),
        hpMax: z.number(),
        ac: z.number(),
        attack: z.number(),
        damage: z.string(),
        abilities: z.array(z.string()),
        personality: z.string(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const character = await getOwnedCharacter(ctx.db, input.characterId, ctx.session.user.id!);

      await ctx.db
        .update(characters)
        .set({ companion: input.companion, updatedAt: new Date() })
        .where(eq(characters.id, character.id));

      return { success: true, companion: input.companion };
    }),

  // ── Companion: Dismiss ────────────────────────────────────────────────
  dismissCompanion: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const character = await getOwnedCharacter(ctx.db, input.characterId, ctx.session.user.id!);

      await ctx.db
        .update(characters)
        .set({ companion: null, updatedAt: new Date() })
        .where(eq(characters.id, character.id));

      return { success: true };
    }),
});
