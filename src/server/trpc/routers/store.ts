import { z } from "zod";
import { eq, and } from "drizzle-orm";
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
import type {
  Player,
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

  const equippedWeapon = items.find((i) => i.type === "weapon" && i.isEquipped);
  const equippedArmor = items.find((i) => i.type === "armor" && i.isEquipped);
  const equippedAccessory = items.find(
    (i) => i.type === "accessory" && i.isEquipped
  );

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

      if (storeRow.characterId !== character.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This store is not accessible",
        });
      }

      // Find item in store inventory
      const inventory = storeRow.inventory as StoreItem[];
      const storeItemIndex = inventory.findIndex(
        (si) => si.item.itemId === input.itemId
      );

      if (storeItemIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found in store",
        });
      }

      const storeItem = inventory[storeItemIndex]!;
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

      // Decrease store stock or remove item
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

      // Build updated response
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, gold: newGold };
      const player = buildPlayer(updatedCharacter, refreshedItems);

      const updatedLocalInventory = updatedInventory.map((si) => ({
        ...si,
        price: calculateBuyPrice(si.item, chaMod),
      }));

      const store: Store = {
        id: storeRow.id,
        name: storeRow.name,
        localInventory: updatedLocalInventory,
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
