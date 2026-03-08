import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, inventoryItems } from "@/server/db/schema";
import { statModifier } from "@/lib/constants";
import { buildEquipmentSlots, getEquipSlot } from "@/server/game/equipment";
import type {
  Player,
  PlayerBuff,
  Position,
  GameItem,
  Stats,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
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

/** Recalculate AC based on equipped armor + DEX modifier */
function calculateAC(
  stats: Stats,
  items: (typeof inventoryItems.$inferSelect)[]
): number {
  const equippedArmor = items.find(
    (i) => i.type === "armor" && i.isEquipped
  );
  const armorStats = (equippedArmor?.stats ?? {}) as Record<string, number>;
  const baseAC = armorStats.ac ?? armorStats.defense ?? 10;
  const dexMod = statModifier(stats.dex);
  return baseAC + dexMod;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const EQUIPPABLE_TYPES = ["weapon", "armor", "accessory"];
const CONSUMABLE_TYPES = ["potion", "scroll"];

export const inventoryRouter = router({
  // ─── List Inventory ───────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(
        ctx.db,
        input.characterId,
        userId
      );

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      return items.map(
        (item): GameItem => ({
          id: item.id,
          itemId: item.itemId,
          name: item.name,
          type: item.type as GameItem["type"],
          rarity: item.rarity as GameItem["rarity"],
          stats: (item.stats ?? {}) as Record<string, number>,
          quantity: item.quantity,
          slot: item.slot,
          isEquipped: item.isEquipped,
        })
      );
    }),

  // ─── Equip Item ───────────────────────────────────────────────────────────
  equip: protectedProcedure
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

      // Get the item
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

      // Check item is equippable
      if (!EQUIPPABLE_TYPES.includes(item.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot equip ${item.type} items. Only weapons, armor, and accessories can be equipped.`,
        });
      }

      // Determine which equipment slot this item occupies
      const targetSlot = getEquipSlot(item.type, item.itemId);

      // Unequip any currently equipped item in the same slot
      // For weapon/armor: match by type. For accessories: match by sub-slot.
      const allEquipped = await ctx.db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.characterId, character.id),
            eq(inventoryItems.isEquipped, true)
          )
        );

      for (const equipped of allEquipped) {
        if (getEquipSlot(equipped.type, equipped.itemId) === targetSlot) {
          await ctx.db
            .update(inventoryItems)
            .set({ isEquipped: false })
            .where(eq(inventoryItems.id, equipped.id));
        }
      }

      // Equip the new item
      await ctx.db
        .update(inventoryItems)
        .set({ isEquipped: true })
        .where(eq(inventoryItems.id, item.id));

      // Refresh items and recalculate AC
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const stats = character.stats as Stats;
      const newAC = calculateAC(stats, refreshedItems);

      if (newAC !== character.ac) {
        await ctx.db
          .update(characters)
          .set({ ac: newAC, updatedAt: new Date() })
          .where(eq(characters.id, character.id));
      }

      const updatedCharacter = { ...character, ac: newAC };
      const player = buildPlayer(updatedCharacter, refreshedItems);

      return { player };
    }),

  // ─── Unequip Item ─────────────────────────────────────────────────────────
  unequip: protectedProcedure
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

      // Get the item
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

      if (!item.isEquipped) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item is not equipped.",
        });
      }

      // Unequip
      await ctx.db
        .update(inventoryItems)
        .set({ isEquipped: false })
        .where(eq(inventoryItems.id, item.id));

      // Refresh items and recalculate AC
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const stats = character.stats as Stats;
      const newAC = calculateAC(stats, refreshedItems);

      if (newAC !== character.ac) {
        await ctx.db
          .update(characters)
          .set({ ac: newAC, updatedAt: new Date() })
          .where(eq(characters.id, character.id));
      }

      const updatedCharacter = { ...character, ac: newAC };
      const player = buildPlayer(updatedCharacter, refreshedItems);

      return { player };
    }),

  // ─── Use Item ─────────────────────────────────────────────────────────────
  useItem: protectedProcedure
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

      // Get the item
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

      // Check item is consumable
      if (!CONSUMABLE_TYPES.includes(item.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot use ${item.type} items. Only potions and scrolls can be used.`,
        });
      }

      const itemStats = (item.stats ?? {}) as Record<string, number>;
      let message = "";
      const updates: Partial<{
        hp: number;
        mp: number;
        updatedAt: Date;
      }> = { updatedAt: new Date() };

      if (item.type === "potion") {
        // Healing potion
        if (itemStats.heal) {
          const missingHp = character.hpMax - character.hp;
          const healAmount = Math.min(itemStats.heal, missingHp);
          const newHp = character.hp + healAmount;
          updates.hp = newHp;
          message = `You drink the ${item.name} and restore ${healAmount} HP.`;
        }
        // Mana potion
        else if (itemStats.mana) {
          const missingMp = character.mpMax - character.mp;
          const manaAmount = Math.min(itemStats.mana, missingMp);
          const newMp = character.mp + manaAmount;
          updates.mp = newMp;
          message = `You drink the ${item.name} and restore ${manaAmount} MP.`;
        } else {
          message = `You drink the ${item.name}. It has a curious taste but no noticeable effect.`;
        }
      } else if (item.type === "scroll") {
        // Damage scroll — for now, just report the effect
        const damage = itemStats.damage ?? 0;
        if (damage > 0) {
          message = `You read the ${item.name}. It crackles with ${damage} points of arcane energy, ready for combat.`;
        } else {
          message = `You read the ${item.name}. Ancient words echo in your mind.`;
        }
      }

      // Update character stats if changed
      if (updates.hp !== undefined || updates.mp !== undefined) {
        await ctx.db
          .update(characters)
          .set(updates)
          .where(eq(characters.id, character.id));
      }

      // Decrease quantity or remove item
      if (item.quantity <= 1) {
        await ctx.db
          .delete(inventoryItems)
          .where(eq(inventoryItems.id, item.id));
      } else {
        await ctx.db
          .update(inventoryItems)
          .set({ quantity: item.quantity - 1 })
          .where(eq(inventoryItems.id, item.id));
      }

      // Build updated player
      const refreshedItems = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = {
        ...character,
        hp: updates.hp ?? character.hp,
        mp: updates.mp ?? character.mp,
      };
      const player = buildPlayer(updatedCharacter, refreshedItems);

      return { player, message };
    }),

  // ─── Drop Item ────────────────────────────────────────────────────────────
  drop: protectedProcedure
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

      // Get the item
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

      // Cannot drop equipped items
      if (item.isEquipped) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot drop an equipped item. Unequip it first.",
        });
      }

      // Delete from inventory
      await ctx.db
        .delete(inventoryItems)
        .where(eq(inventoryItems.id, item.id));

      return { success: true, droppedItem: item.name };
    }),
});
