import type { SpriteId } from "@/lib/sprites";
import type { Room } from "@/lib/types";
import type { RoomType } from "@/lib/constants";

// --- Core types ---

export type TileMarker =
  | "player"
  | "npc"
  | "loot"
  | "encounter"
  | "entrance"
  | "exit"
  | "quest"
  | "campfire"
  | "other_player"
  | "stairs_up"
  | "stairs_down";

export type TileVisibility = "hidden" | "discovered" | "visible";

export interface TileData {
  x: number;
  y: number;
  spriteId: SpriteId;
  walkable: boolean;
  visibility: TileVisibility;
  markers: TileMarker[];
  roomId?: string;
  buildingId?: string;
}

export interface TileMapData {
  width: number;
  height: number;
  tiles: TileData[][];
}

// --- Marker → SpriteId mapping ---

export const MARKER_SPRITE: Record<TileMarker, SpriteId> = {
  player: "marker_player",
  npc: "marker_npc",
  loot: "marker_loot",
  encounter: "marker_encounter",
  entrance: "marker_entrance",
  exit: "marker_entrance",
  quest: "marker_quest",
  campfire: "marker_campfire",
  other_player: "marker_other_player",
  stairs_up: "terrain_stairs_up",
  stairs_down: "terrain_stairs_down",
};

// --- Mapping functions ---

const ROOM_TYPE_SPRITE: Record<string, SpriteId> = {
  corridor: "terrain_stone",
  chamber: "terrain_dirt",
  shrine: "terrain_sand",
  trap_room: "terrain_lava",
  store: "terrain_road",
  npc_room: "terrain_road",
  boss_room: "terrain_stone",
  safe_room: "terrain_grass",
};

/** Interior sprites for building rooms — used when inside a building */
const INTERIOR_ROOM_TYPE_SPRITE: Record<string, SpriteId> = {
  corridor: "terrain_floor_wood",
  chamber: "terrain_floor_wood",
  shrine: "terrain_floor_wood",
  trap_room: "terrain_lava",
  store: "terrain_floor_wood",
  npc_room: "terrain_floor_wood",
  boss_room: "terrain_stone",
  safe_room: "terrain_floor_wood",
  wall: "terrain_wall",
  door: "terrain_door",
  stairs_up: "terrain_stairs_up",
  stairs_down: "terrain_stairs_down",
};

export function roomTypeToSpriteId(roomType: RoomType | string, interior = false): SpriteId {
  if (interior) {
    return INTERIOR_ROOM_TYPE_SPRITE[roomType] ?? "terrain_floor_wood";
  }
  return ROOM_TYPE_SPRITE[roomType] ?? "terrain_stone";
}

export function roomFeaturesToMarkers(
  features: Record<string, unknown>,
  hasEncounter: boolean,
  hasLoot: boolean
): TileMarker[] {
  const markers: TileMarker[] = [];

  if (hasEncounter) markers.push("encounter");
  if (hasLoot) markers.push("loot");

  if (features.hasNpc || features.npc) markers.push("npc");
  if (features.isEntrance || features.entrance) markers.push("entrance");
  if (features.isExit || features.exit) markers.push("exit");
  if (features.quest || features.hasQuest) markers.push("quest");
  if (features.campfire || features.isSafe) markers.push("campfire");
  if (features.stairsUp) markers.push("stairs_up");
  if (features.stairsDown) markers.push("stairs_down");

  return markers;
}

export function buildTileFromRoom(
  room: Room,
  playerPos: { x: number; y: number },
  visibility: TileVisibility,
  interior = false
): TileData {
  const isPlayer = room.x === playerPos.x && room.y === playerPos.y;
  const markers = roomFeaturesToMarkers(
    room.roomFeatures ?? {},
    room.hasEncounter,
    room.hasLoot
  );

  if (isPlayer) {
    markers.push("player");
  }

  // Store/NPC rooms get special markers
  if (room.type === "store" && !markers.includes("entrance")) {
    markers.push("entrance");
  }
  if (room.type === "npc_room" && !markers.includes("npc")) {
    markers.push("npc");
  }
  if (room.type === "safe_room" && !markers.includes("campfire")) {
    markers.push("campfire");
  }

  return {
    x: room.x,
    y: room.y,
    spriteId: roomTypeToSpriteId(room.type, interior),
    walkable: true,
    visibility,
    markers,
    roomId: room.id,
  };
}
