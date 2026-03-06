import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  characters,
  rooms,
  inventoryItems,
  combatState as combatStateTable,
} from "@/server/db/schema";
import { initCombat, resolveTurn, calculateRewards, type CombatExtra } from "@/server/game/combat";
import { generateLoot, generateGoldDrop } from "@/server/game/loot";
import { calculateLevelUp } from "@/server/game/player";
import { GAME_CONFIG } from "@/lib/constants";
import type { CharacterClass, Theme } from "@/lib/constants";
import type {
  Player,
  Room as RoomType,
  Position,
  MonsterEncounter,
  GameItem,
  Stats,
  CombatState,
  CombatAction,
  CombatLogEntry,
  Monster,
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

  const equippedWeapon = items.find((i) => i.type === "weapon" && i.isEquipped);
  const equippedArmor = items.find((i) => i.type === "armor" && i.isEquipped);
  const equippedAccessory = items.find((i) => i.type === "accessory" && i.isEquipped);

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
      weapon: equippedWeapon ? toGameItem(equippedWeapon) : undefined,
      armor: equippedArmor ? toGameItem(equippedArmor) : undefined,
      accessory: equippedAccessory ? toGameItem(equippedAccessory) : undefined,
    },
    abilities: character.abilities,
    lastSafe: character.lastSafe as Position,
    baseLevel: character.baseLevel,
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
  };
}

/** Deserialize CombatExtra from JSONB */
function deserializeExtra(data: Record<string, unknown> | null): CombatExtra {
  if (!data) {
    return { playerBuffs: [], monsterBuffs: new Map(), roundNumber: 1 };
  }
  const mb = (data.monsterBuffs ?? {}) as Record<string, unknown[]>;
  return {
    playerBuffs: (data.playerBuffs ?? []) as CombatExtra["playerBuffs"],
    monsterBuffs: new Map(Object.entries(mb).map(([k, v]) => [Number(k), v as CombatExtra["playerBuffs"]])),
    roundNumber: (data.roundNumber ?? 1) as number,
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

export async function handleDeath(
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
      gold: character.gold - goldLost,
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

      return buildCombatState(row).state;
    }),

  // ─── Start Combat ───────────────────────────────────────────────────────────
  start: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      // Check for existing combat
      const existing = await getActiveCombat(ctx.db, input.characterId);
      if (existing) {
        return buildCombatState(existing);
      }

      // Get current room
      const position = character.position as Position;
      const [currentRoom] = await ctx.db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.characterId, character.id),
            eq(rooms.x, position.x),
            eq(rooms.y, position.y)
          )
        );

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

      // Initialize combat via engine
      const { state, extra } = initCombat(player, encounter);

      // Persist to DB (store extra in turnOrder JSONB)
      const [inserted] = await ctx.db
        .insert(combatStateTable)
        .values({
          characterId: character.id,
          monsters: state.monsters,
          turnOrder: { order: state.turnOrder, extra: serializeExtra(extra) },
          currentTurn: state.currentTurn,
          round: state.round,
          log: state.log,
        })
        .returning();

      return buildCombatState(inserted!).state;
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

      // Build player
      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));
      const player = buildPlayer(character, items);

      // Resolve turn
      const turnResult = resolveTurn(
        currentState,
        player,
        input.action as CombatAction,
        currentExtra,
        input.targetIndex,
        input.itemId
      );

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

          // If no level up, just update xp/gold/hp
          if (!levelUp) {
            await ctx.db
              .update(characters)
              .set({
                xp: newXp,
                gold: character.gold + totalGold,
                hp: turnResult.player.hp,
                mp: turnResult.player.mp,
                updatedAt: new Date(),
              })
              .where(eq(characters.id, character.id));
          } else {
            // Level up already saved xp/stats/level — just add gold and sync hp/mp
            await ctx.db
              .update(characters)
              .set({
                gold: character.gold + totalGold,
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

          // Clear encounter from room
          const [currentRoom] = await ctx.db
            .select()
            .from(rooms)
            .where(
              and(
                eq(rooms.characterId, character.id),
                eq(rooms.x, (character.position as Position).x),
                eq(rooms.y, (character.position as Position).y)
              )
            );

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

          return {
            combatOver: true as const,
            victory: true as const,
            player: updatedPlayer,
            log: turnResult.result,
            rewards: {
              xp: rewards.xp,
              gold: totalGold,
              items: lootItems,
            },
            levelUp: levelUp ?? undefined,
          };
        }

        // ── Defeat ──────────────────────────────────────────────────────────
        const deathResult = await handleDeath(character.id, ctx.db);

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
          log: turnResult.result,
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
          turnOrder: { order: turnResult.state.turnOrder, extra: serializeExtra(turnResult.extra) },
          currentTurn: turnResult.state.currentTurn,
          round: turnResult.state.round,
          log: turnResult.state.log,
        })
        .where(eq(combatStateTable.characterId, character.id));

      // Save updated player HP/MP
      await ctx.db
        .update(characters)
        .set({
          hp: turnResult.player.hp,
          mp: turnResult.player.mp,
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
        log: turnResult.result,
      };
    }),

  // ─── Respawn ────────────────────────────────────────────────────────────────
  respawn: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await getOwnedCharacter(ctx.db, input.characterId, userId);

      // Clean up any lingering combat state
      await ctx.db
        .delete(combatStateTable)
        .where(eq(combatStateTable.characterId, input.characterId));

      const deathResult = await handleDeath(input.characterId, ctx.db);

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
      const [respawnRoom] = await ctx.db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.characterId, input.characterId),
            eq(rooms.x, deathResult.respawnPosition.x),
            eq(rooms.y, deathResult.respawnPosition.y)
          )
        );

      if (!respawnRoom) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Respawn room not found",
        });
      }

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
});
