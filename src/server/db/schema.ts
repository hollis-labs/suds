import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ─── NextAuth Tables ─────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ─── Invites ─────────────────────────────────────────────────────────────────

export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  usedBy: uuid("used_by").references(() => users.id),
  usedAt: timestamp("used_at", { mode: "date" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Worlds ─────────────────────────────────────────────────────────────────

export const worlds = pgTable("worlds", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  theme: text("theme").notNull(),
  seed: text("seed"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Regions ────────────────────────────────────────────────────────────────

export const regions = pgTable("regions", {
  id: uuid("id").defaultRandom().primaryKey(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  theme: text("theme").notNull(),
  position: jsonb("position").notNull(), // {x, y} on world map
  connections: text("connections").array().default([]).notNull(), // region IDs
  metadata: jsonb("metadata").default({}).notNull(), // landmarks, faction, flavor
  generatedBy: text("generated_by").notNull(), // "seed" | "ai" | "template"
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Areas ──────────────────────────────────────────────────────────────────

export const areas = pgTable("areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionId: uuid("region_id")
    .notNull()
    .references(() => regions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  areaType: text("area_type").notNull(), // town | wilderness | ruins | fortress | dungeon_entrance
  gridWidth: integer("grid_width").notNull(),
  gridHeight: integer("grid_height").notNull(),
  position: jsonb("position").notNull(), // {x, y} on region map
  connections: text("connections").array().default([]).notNull(), // adjacent area IDs
  metadata: jsonb("metadata").default({}).notNull(), // POIs, buildings list, terrain
  generatedBy: text("generated_by").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Characters ──────────────────────────────────────────────────────────────

export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  class: text("class").notNull(),
  theme: text("theme").notNull(),
  level: integer("level").default(1).notNull(),
  xp: integer("xp").default(0).notNull(),
  xpNext: integer("xp_next").default(300).notNull(),
  hp: integer("hp").notNull(),
  hpMax: integer("hp_max").notNull(),
  mp: integer("mp").notNull(),
  mpMax: integer("mp_max").notNull(),
  gold: integer("gold").default(50).notNull(),
  stats: jsonb("stats").notNull(),
  ac: integer("ac").notNull(),
  position: jsonb("position").default({ x: 0, y: 0 }).notNull(),
  equipment: jsonb("equipment").default({}).notNull(),
  abilities: text("abilities").array().default([]).notNull(),
  lastSafe: jsonb("last_safe").default({ x: 0, y: 0 }).notNull(),
  baseLevel: integer("base_level").default(0).notNull(),
  companion: jsonb("companion"), // NPC adventurer companion, nullable
  buffs: jsonb("buffs").default([]).notNull(), // active buffs (shield, blessing)
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ─── Inventory Items ─────────────────────────────────────────────────────────

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rarity: text("rarity").notNull(),
  stats: jsonb("stats").default({}).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  slot: integer("slot"),
  isEquipped: boolean("is_equipped").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Rooms ───────────────────────────────────────────────────────────────────

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    exits: text("exits").array().notNull(),
    depth: integer("depth").notNull(),
    hasEncounter: boolean("has_encounter").default(false).notNull(),
    encounterData: jsonb("encounter_data"),
    hasLoot: boolean("has_loot").default(false).notNull(),
    lootData: jsonb("loot_data"),
    visited: boolean("visited").default(false).notNull(),
    roomFeatures: jsonb("room_features").default({}).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => [unique().on(table.characterId, table.x, table.y)]
);

// ─── Stores ──────────────────────────────────────────────────────────────────

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    roomX: integer("room_x").notNull(),
    roomY: integer("room_y").notNull(),
    name: text("name").notNull(),
    inventory: jsonb("inventory").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => [unique().on(table.characterId, table.roomX, table.roomY)]
);

// ─── Marketplace Items ───────────────────────────────────────────────────────

export const marketplaceItems = pgTable("marketplace_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemData: jsonb("item_data").notNull(),
  minLevel: integer("min_level").default(1).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── NPCs ────────────────────────────────────────────────────────────────────

export const npcs = pgTable("npcs", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  roomX: integer("room_x").notNull(),
  roomY: integer("room_y").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  dialogue: jsonb("dialogue").notNull(),
  questId: uuid("quest_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Combat State ────────────────────────────────────────────────────────────

export const combatState = pgTable("combat_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .unique()
    .references(() => characters.id, { onDelete: "cascade" }),
  monsters: jsonb("monsters").notNull(),
  turnOrder: jsonb("turn_order").notNull(),
  currentTurn: integer("current_turn").default(0).notNull(),
  round: integer("round").default(1).notNull(),
  log: jsonb("log").default([]).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Quests ──────────────────────────────────────────────────────────────────

export const quests = pgTable("quests", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  objectives: jsonb("objectives").notNull(),
  rewards: jsonb("rewards").notNull(),
  status: text("status").default("available").notNull(),
  givenBy: uuid("given_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Travel Stones ───────────────────────────────────────────────────────────

export const travelStones = pgTable(
  "travel_stones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    roomX: integer("room_x").notNull(),
    roomY: integer("room_y").notNull(),
    placedAt: timestamp("placed_at", { mode: "date" }).defaultNow(),
  },
  (table) => [unique().on(table.characterId, table.roomX, table.roomY)]
);

// ─── Room Annotations ────────────────────────────────────────────────────────

export const roomAnnotations = pgTable(
  "room_annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    roomX: integer("room_x").notNull(),
    roomY: integer("room_y").notNull(),
    note: text("note"),
    marker: text("marker"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => [unique().on(table.characterId, table.roomX, table.roomY)]
);

// ─── Lore Entries ───────────────────────────────────────────────────────────

export const loreEntries = pgTable("lore_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull(), // "room" | "npc" | "item" | "search" | "combat"
  sourceId: text("source_id"), // optional reference to originating entity
  discoveredAt: timestamp("discovered_at", { mode: "date" }).defaultNow(),
});

// ─── Player Notes ───────────────────────────────────────────────────────────

export const playerNotes = pgTable("player_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ─── Game Events ────────────────────────────────────────────────────────────

export const gameEvents = pgTable("game_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  characterName: text("character_name").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  detail: text("detail"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── Content Library ────────────────────────────────────────────────────────

export const contentLibrary = pgTable("content_library", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // room_description, npc_dialogue, lore_fragment, quest
  theme: text("theme").notNull(), // horror, funny, epic, dark_fantasy
  tags: jsonb("tags").default([]).notNull(), // array of strings for context matching
  content: jsonb("content").notNull(), // the actual content (string or object)
  quality: integer("quality").default(3).notNull(), // 1-5 rating for future curation
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── AI Usage ───────────────────────────────────────────────────────────────

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  model: text("model").notNull(),
  feature: text("feature").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  durationMs: integer("duration_ms"),
  characterId: uuid("character_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ─── News Posts ─────────────────────────────────────────────────────

export const newsPosts = pgTable("news_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").default("update").notNull(),
  authorId: uuid("author_id").references(() => users.id),
  published: boolean("published").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type NewVerificationToken = InferInsertModel<typeof verificationTokens>;

export type Invite = InferSelectModel<typeof invites>;
export type NewInvite = InferInsertModel<typeof invites>;

export type Character = InferSelectModel<typeof characters>;
export type NewCharacter = InferInsertModel<typeof characters>;

export type InventoryItem = InferSelectModel<typeof inventoryItems>;
export type NewInventoryItem = InferInsertModel<typeof inventoryItems>;

export type Room = InferSelectModel<typeof rooms>;
export type NewRoom = InferInsertModel<typeof rooms>;

export type Store = InferSelectModel<typeof stores>;
export type NewStore = InferInsertModel<typeof stores>;

export type MarketplaceItem = InferSelectModel<typeof marketplaceItems>;
export type NewMarketplaceItem = InferInsertModel<typeof marketplaceItems>;

export type Npc = InferSelectModel<typeof npcs>;
export type NewNpc = InferInsertModel<typeof npcs>;

export type CombatState = InferSelectModel<typeof combatState>;
export type NewCombatState = InferInsertModel<typeof combatState>;

export type Quest = InferSelectModel<typeof quests>;
export type NewQuest = InferInsertModel<typeof quests>;

export type TravelStone = InferSelectModel<typeof travelStones>;
export type NewTravelStone = InferInsertModel<typeof travelStones>;

export type RoomAnnotation = InferSelectModel<typeof roomAnnotations>;
export type NewRoomAnnotation = InferInsertModel<typeof roomAnnotations>;

export type LoreEntry = InferSelectModel<typeof loreEntries>;
export type NewLoreEntry = InferInsertModel<typeof loreEntries>;

export type PlayerNote = InferSelectModel<typeof playerNotes>;
export type NewPlayerNote = InferInsertModel<typeof playerNotes>;

export type GameEvent = InferSelectModel<typeof gameEvents>;
export type NewGameEvent = InferInsertModel<typeof gameEvents>;

export type AiUsage = InferSelectModel<typeof aiUsage>;
export type NewAiUsage = InferInsertModel<typeof aiUsage>;

export type ContentLibraryEntry = InferSelectModel<typeof contentLibrary>;
export type NewContentLibraryEntry = InferInsertModel<typeof contentLibrary>;

export type NewsPost = InferSelectModel<typeof newsPosts>;
export type NewNewsPost = InferInsertModel<typeof newsPosts>;

export type World = InferSelectModel<typeof worlds>;
export type NewWorld = InferInsertModel<typeof worlds>;

export type Region = InferSelectModel<typeof regions>;
export type NewRegion = InferInsertModel<typeof regions>;

export type Area = InferSelectModel<typeof areas>;
export type NewArea = InferInsertModel<typeof areas>;
