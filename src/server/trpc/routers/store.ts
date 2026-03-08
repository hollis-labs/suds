import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import type { Theme } from "@/lib/constants";
import {
  characters,
  rooms,
  inventoryItems,
  stores,
} from "@/server/db/schema";
import {
  generateStore,
  getMarketplaceItems,
  calculateBuyPrice,
  calculateSellPrice,
} from "@/server/game/store";
import { statModifier, GAME_CONFIG } from "@/lib/constants";
import { buildEquipmentSlots } from "@/server/game/equipment";
import type {
  Player,
  PlayerBuff,
  Position,
  GameItem,
  Stats,
  StoreItem,
  Store,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers (shared pattern — ideally extract later)
// ---------------------------------------------------------------------------

function buildPlayer(
  character: typeof characters.$inferSelect,
  items: (typeof inventoryItems.$inferSelect)[]
): Player {
  const toGameItem = (item: typeof inventoryItems.$inferSelect): GameItem => ({
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

type DbClient = typeof import("@/server/db").db;

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

/** Get room at position handling both shared and legacy rooms */
async function getRoomAtForStore(
  db: DbClient,
  character: typeof characters.$inferSelect,
  x: number,
  y: number
) {
  // World character: check shared rooms first
  if (character.worldId && character.currentAreaId) {
    const conditions = [eq(rooms.x, x), eq(rooms.y, y)];
    if (character.currentBuildingId) {
      conditions.push(eq(rooms.buildingId, character.currentBuildingId));
      if (character.currentFloor != null) {
        conditions.push(eq(rooms.floor, character.currentFloor));
      }
    } else {
      conditions.push(eq(rooms.areaId, character.currentAreaId));
      conditions.push(isNull(rooms.buildingId));
    }
    const [sharedRoom] = await db.select().from(rooms).where(and(...conditions));
    if (sharedRoom) return sharedRoom;
  }
  // Legacy fallback
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.characterId, character.id), eq(rooms.x, x), eq(rooms.y, y)));
  return room ?? null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const storeRouter = router({
  // ─── Get Store Inventory ──────────────────────────────────────────────────
  getInventory: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(
        ctx.db,
        input.characterId,
        userId
      );
      const position = character.position as Position;
      const stats = character.stats as Stats;

      // Get current room
      const currentRoom = await getRoomAtForStore(ctx.db, character, position.x, position.y);

      if (!currentRoom) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Current room not found",
        });
      }

      if (currentRoom.type !== "store") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is no store in this room.",
        });
      }

      // Check for existing store at this position
      let [storeRow] = await ctx.db
        .select()
        .from(stores)
        .where(
          and(
            eq(stores.characterId, character.id),
            eq(stores.roomX, position.x),
            eq(stores.roomY, position.y)
          )
        );

      // Generate store if none exists
      if (!storeRow) {
        const depth = Math.abs(position.x) + Math.abs(position.y);
        const generated = generateStore(
          character.level,
          depth,
          character.theme as Theme
        );

        const [inserted] = await ctx.db
          .insert(stores)
          .values({
            characterId: character.id,
            roomX: position.x,
            roomY: position.y,
            name: generated.name,
            inventory: generated.localInventory,
          })
          .returning();

        storeRow = inserted!;
      }

      // Get marketplace items
      const marketplaceItems = getMarketplaceItems(character.level);

      // Apply CHA discount to prices
      const chaMod = statModifier(stats.cha);
      const localInventory = (
        storeRow.inventory as StoreItem[]
      ).map((si) => ({
        ...si,
        price: calculateBuyPrice(si.item, chaMod),
      }));

      const marketplaceInventory = marketplaceItems.map((si) => ({
        ...si,
        price: calculateBuyPrice(si.item, chaMod),
      }));

      const store: Store = {
        id: storeRow.id,
        name: storeRow.name,
        localInventory,
        marketplaceInventory,
      };

      return { store, playerGold: character.gold };
    }),

  // ─── Buy Item ─────────────────────────────────────────────────────────────
  buy: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        itemId: z.string(),
        storeId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(
        ctx.db,
        input.characterId,
        userId
      );
      const stats = character.stats as Stats;

      // Get store
      const [storeRow] = await ctx.db
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId));

      if (!storeRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Store not found",
        });
      }

      // Legacy stores are per-character; shared stores have null characterId
      if (storeRow.characterId && storeRow.characterId !== character.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This store is not accessible",
        });
      }

      // Find item in local store inventory or marketplace
      const inventory = storeRow.inventory as StoreItem[];
      const storeItemIndex = inventory.findIndex(
        (si) => si.item.itemId === input.itemId
      );

      let storeItem: StoreItem;
      let isMarketplace = false;

      if (storeItemIndex !== -1) {
        storeItem = inventory[storeItemIndex]!;
      } else {
        // Check marketplace items
        const marketplaceItems = getMarketplaceItems(character.level);
        const marketItem = marketplaceItems.find(
          (si) => si.item.itemId === input.itemId
        );
        if (!marketItem) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found in store",
          });
        }
        storeItem = marketItem;
        isMarketplace = true;
      }

      const chaMod = statModifier(stats.cha);
      const price = calculateBuyPrice(storeItem.item, chaMod);

      // Check gold
      if (character.gold < price) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Not enough gold. Need ${price}, have ${character.gold}.`,
        });
      }

      // Check inventory space
      const currentItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      if (currentItems.length >= GAME_CONFIG.MAX_INVENTORY_SLOTS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Inventory is full (${GAME_CONFIG.MAX_INVENTORY_SLOTS} slots).`,
        });
      }

      // Deduct gold
      const newGold = character.gold - price;
      await ctx.db
        .update(characters)
        .set({ gold: newGold, updatedAt: new Date() })
        .where(eq(characters.id, character.id));

      // Add item to player inventory
      await ctx.db.insert(inventoryItems).values({
        characterId: character.id,
        itemId: storeItem.item.itemId,
        name: storeItem.item.name,
        type: storeItem.item.type,
        rarity: storeItem.item.rarity,
        stats: storeItem.item.stats,
        quantity: 1,
        isEquipped: false,
      });

      // Decrease store stock or remove item (marketplace items have unlimited stock)
      if (!isMarketplace) {
        const updatedInventory = [...inventory];
        if (storeItem.stock <= 1) {
          updatedInventory.splice(storeItemIndex, 1);
        } else {
          updatedInventory[storeItemIndex] = {
            ...storeItem,
            stock: storeItem.stock - 1,
          };
        }

        await ctx.db
          .update(stores)
          .set({ inventory: updatedInventory })
          .where(eq(stores.id, storeRow.id));
      }

      // Build updated response — re-read store to get current local inventory
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, gold: newGold };
      const player = buildPlayer(updatedCharacter, refreshedItems);

      const [refreshedStore] = await ctx.db
        .select()
        .from(stores)
        .where(eq(stores.id, storeRow.id));

      const currentLocalInventory = (refreshedStore!.inventory as StoreItem[]).map((si) => ({
        ...si,
        price: calculateBuyPrice(si.item, chaMod),
      }));

      const store: Store = {
        id: storeRow.id,
        name: storeRow.name,
        localInventory: currentLocalInventory,
        marketplaceInventory: getMarketplaceItems(character.level).map(
          (si) => ({
            ...si,
            price: calculateBuyPrice(si.item, chaMod),
          })
        ),
      };

      return { player, store };
    }),

  // ─── Sell Item ────────────────────────────────────────────────────────────
  sell: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        itemId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(
        ctx.db,
        input.characterId,
        userId
      );

      // Verify player is in a store room
      const position = character.position as Position;
      const currentRoom = await getRoomAtForStore(ctx.db, character, position.x, position.y);

      if (!currentRoom || currentRoom.type !== "store") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must be in a store to sell items.",
        });
      }

      // Get item from inventory
      const [item] = await ctx.db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.id, input.itemId),
            eq(inventoryItems.characterId, character.id)
          )
        );

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found in inventory",
        });
      }

      // Cannot sell equipped items
      if (item.isEquipped) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot sell an equipped item. Unequip it first.",
        });
      }

      // Calculate sell price
      const gameItem: GameItem = {
        id: item.id,
        itemId: item.itemId,
        name: item.name,
        type: item.type as GameItem["type"],
        rarity: item.rarity as GameItem["rarity"],
        stats: (item.stats ?? {}) as Record<string, number>,
        quantity: item.quantity,
        slot: item.slot,
        isEquipped: item.isEquipped,
      };

      const sellPrice = calculateSellPrice(gameItem);

      // Add gold to player
      const newGold = character.gold + sellPrice;
      await ctx.db
        .update(characters)
        .set({ gold: newGold, updatedAt: new Date() })
        .where(eq(characters.id, character.id));

      // Remove item from inventory
      await ctx.db
        .delete(inventoryItems)
        .where(eq(inventoryItems.id, item.id));

      // Build updated player
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, gold: newGold };
      const player = buildPlayer(updatedCharacter, refreshedItems);

      return { player, soldItem: gameItem.name, goldReceived: sellPrice };
    }),
});
