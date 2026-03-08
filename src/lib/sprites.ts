// Sprite sheet configuration for SUDS v2 pixel art assets
// All sprite sheets are in public/sprites/ and positions are measured from the actual PNGs

export interface SpriteRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteSheet {
  src: string;
  width: number;
  height: number;
}

export interface SpriteDef {
  sheet: SpriteSheet;
  region: SpriteRegion;
  label: string;
}

// --- Sprite Sheets ---

const SHEETS = {
  terrainGround: {
    src: "/sprites/terrain-ground-tiles.png",
    width: 1536,
    height: 1024,
  },
  terrainInterior: {
    src: "/sprites/terrain-interior-tiles.png",
    width: 1536,
    height: 1024,
  },
  buildingTown: {
    src: "/sprites/building-town-icons.png",
    width: 1536,
    height: 1024,
  },
  buildingSpecial: {
    src: "/sprites/building-special-icons.png",
    width: 1536,
    height: 1024,
  },
  mapMarkers: {
    src: "/sprites/map-markers.png",
    width: 1536,
    height: 1024,
  },
  hudIcons: {
    src: "/sprites/ui-hud-icons.png",
    width: 1536,
    height: 1024,
  },
  regionBanners: {
    src: "/sprites/region-banners.png",
    width: 1536,
    height: 1024,
  },
  classPortraits: {
    src: "/sprites/class-portraits.png",
    width: 1024,
    height: 1024,
  },
  buttonBorders: {
    src: "/sprites/ui-button-borders.png",
    width: 1536,
    height: 1024,
  },
} as const satisfies Record<string, SpriteSheet>;

// --- Sprite Definitions ---
// Positions measured from actual PNG bounding boxes

export const SPRITES = {
  // Terrain ground tiles (9 tiles in a row)
  terrain_grass: { sheet: SHEETS.terrainGround, region: { x: 164, y: 449, w: 127, h: 125 }, label: "Grass" },
  terrain_stone: { sheet: SHEETS.terrainGround, region: { x: 307, y: 449, w: 132, h: 124 }, label: "Stone" },
  terrain_water: { sheet: SHEETS.terrainGround, region: { x: 455, y: 453, w: 131, h: 121 }, label: "Water" },
  terrain_road: { sheet: SHEETS.terrainGround, region: { x: 600, y: 450, w: 136, h: 124 }, label: "Road" },
  terrain_forest: { sheet: SHEETS.terrainGround, region: { x: 747, y: 449, w: 136, h: 125 }, label: "Forest" },
  terrain_mountain: { sheet: SHEETS.terrainGround, region: { x: 896, y: 449, w: 128, h: 125 }, label: "Mountain" },
  terrain_sand: { sheet: SHEETS.terrainGround, region: { x: 1032, y: 450, w: 135, h: 124 }, label: "Sand" },
  terrain_dirt: { sheet: SHEETS.terrainGround, region: { x: 1176, y: 449, w: 131, h: 125 }, label: "Dirt" },
  terrain_bridge: { sheet: SHEETS.terrainGround, region: { x: 1319, y: 449, w: 121, h: 125 }, label: "Bridge" },

  // Terrain interior tiles (6 tiles)
  terrain_wall: { sheet: SHEETS.terrainInterior, region: { x: 96, y: 397, w: 191, h: 190 }, label: "Wall" },
  terrain_door: { sheet: SHEETS.terrainInterior, region: { x: 320, y: 397, w: 195, h: 192 }, label: "Door" },
  terrain_stairs_up: { sheet: SHEETS.terrainInterior, region: { x: 546, y: 397, w: 192, h: 192 }, label: "Stairs Up" },
  terrain_stairs_down: { sheet: SHEETS.terrainInterior, region: { x: 773, y: 397, w: 199, h: 192 }, label: "Stairs Down" },
  terrain_floor_wood: { sheet: SHEETS.terrainInterior, region: { x: 1006, y: 397, w: 201, h: 192 }, label: "Wood Floor" },
  terrain_lava: { sheet: SHEETS.terrainInterior, region: { x: 1243, y: 397, w: 196, h: 192 }, label: "Lava" },

  // Building town icons (5 buildings)
  building_tavern: { sheet: SHEETS.buildingTown, region: { x: 68, y: 330, w: 265, h: 345 }, label: "Tavern" },
  building_shop: { sheet: SHEETS.buildingTown, region: { x: 361, y: 460, w: 239, h: 219 }, label: "Shop" },
  building_temple: { sheet: SHEETS.buildingTown, region: { x: 638, y: 320, w: 239, h: 359 }, label: "Temple" },
  building_house: { sheet: SHEETS.buildingTown, region: { x: 904, y: 464, w: 239, h: 213 }, label: "House" },
  building_castle: { sheet: SHEETS.buildingTown, region: { x: 1173, y: 403, w: 273, h: 277 }, label: "Castle" },

  // Building special icons (3 buildings)
  building_dungeon: { sheet: SHEETS.buildingSpecial, region: { x: 67, y: 357, w: 498, h: 390 }, label: "Dungeon" },
  building_tower: { sheet: SHEETS.buildingSpecial, region: { x: 594, y: 212, w: 346, h: 791 }, label: "Tower" },
  building_ruins: { sheet: SHEETS.buildingSpecial, region: { x: 978, y: 352, w: 497, h: 435 }, label: "Ruins" },

  // Map markers (8 markers)
  marker_player: { sheet: SHEETS.mapMarkers, region: { x: 197, y: 437, w: 91, h: 118 }, label: "Player" },
  marker_npc: { sheet: SHEETS.mapMarkers, region: { x: 341, y: 432, w: 96, h: 123 }, label: "NPC" },
  marker_loot: { sheet: SHEETS.mapMarkers, region: { x: 492, y: 434, w: 126, h: 121 }, label: "Loot" },
  marker_encounter: { sheet: SHEETS.mapMarkers, region: { x: 638, y: 437, w: 132, h: 118 }, label: "Encounter" },
  marker_entrance: { sheet: SHEETS.mapMarkers, region: { x: 794, y: 431, w: 122, h: 126 }, label: "Entrance" },
  marker_quest: { sheet: SHEETS.mapMarkers, region: { x: 954, y: 425, w: 70, h: 136 }, label: "Quest" },
  marker_campfire: { sheet: SHEETS.mapMarkers, region: { x: 1072, y: 425, w: 132, h: 136 }, label: "Campfire" },
  marker_other_player: { sheet: SHEETS.mapMarkers, region: { x: 1238, y: 432, w: 100, h: 123 }, label: "Other Player" },

  // HUD icons (8 icons — star and sword are close together, split manually)
  ui_heart: { sheet: SHEETS.hudIcons, region: { x: 218, y: 444, w: 122, h: 109 }, label: "Heart" },
  ui_mana: { sheet: SHEETS.hudIcons, region: { x: 363, y: 436, w: 101, h: 122 }, label: "Mana" },
  ui_coin: { sheet: SHEETS.hudIcons, region: { x: 485, y: 437, w: 119, h: 119 }, label: "Coin" },
  ui_star: { sheet: SHEETS.hudIcons, region: { x: 621, y: 431, w: 120, h: 129 }, label: "Star" },
  ui_sword: { sheet: SHEETS.hudIcons, region: { x: 758, y: 435, w: 120, h: 125 }, label: "Sword" },
  ui_shield: { sheet: SHEETS.hudIcons, region: { x: 896, y: 436, w: 118, h: 122 }, label: "Shield" },
  ui_skull: { sheet: SHEETS.hudIcons, region: { x: 1034, y: 440, w: 120, h: 119 }, label: "Skull" },
  ui_chest: { sheet: SHEETS.hudIcons, region: { x: 1174, y: 442, w: 145, h: 111 }, label: "Chest" },

  // Region banners (3 banners)
  banner_ashen: { sheet: SHEETS.regionBanners, region: { x: 61, y: 241, w: 432, h: 527 }, label: "Ashen Coast" },
  banner_verdant: { sheet: SHEETS.regionBanners, region: { x: 519, y: 241, w: 442, h: 527 }, label: "Verdant Vale" },
  banner_iron: { sheet: SHEETS.regionBanners, region: { x: 988, y: 240, w: 480, h: 528 }, label: "Iron Peaks" },

  // Button borders (5 variants stacked vertically: action/green, nav/gold, danger/red, info/blue, disabled/gray)
  btn_action: { sheet: SHEETS.buttonBorders, region: { x: 289, y: 58, w: 948, h: 129 }, label: "Action Button" },
  btn_nav: { sheet: SHEETS.buttonBorders, region: { x: 289, y: 240, w: 948, h: 128 }, label: "Nav Button" },
  btn_danger: { sheet: SHEETS.buttonBorders, region: { x: 288, y: 427, w: 950, h: 123 }, label: "Danger Button" },
  btn_info: { sheet: SHEETS.buttonBorders, region: { x: 289, y: 606, w: 952, h: 126 }, label: "Info Button" },
  btn_disabled: { sheet: SHEETS.buttonBorders, region: { x: 288, y: 788, w: 948, h: 125 }, label: "Disabled Button" },

  // Class portraits (4 cols x 3 rows grid)
  portrait_warrior: { sheet: SHEETS.classPortraits, region: { x: 25, y: 18, w: 248, h: 231 }, label: "Warrior" },
  portrait_mage: { sheet: SHEETS.classPortraits, region: { x: 279, y: 18, w: 237, h: 231 }, label: "Mage" },
  portrait_rogue: { sheet: SHEETS.classPortraits, region: { x: 527, y: 18, w: 236, h: 231 }, label: "Rogue" },
  portrait_cleric: { sheet: SHEETS.classPortraits, region: { x: 770, y: 18, w: 230, h: 231 }, label: "Cleric" },
  portrait_barbarian: { sheet: SHEETS.classPortraits, region: { x: 25, y: 271, w: 248, h: 233 }, label: "Barbarian" },
  portrait_ranger: { sheet: SHEETS.classPortraits, region: { x: 279, y: 271, w: 237, h: 233 }, label: "Ranger" },
  portrait_druid: { sheet: SHEETS.classPortraits, region: { x: 527, y: 271, w: 236, h: 233 }, label: "Druid" },
  portrait_monk: { sheet: SHEETS.classPortraits, region: { x: 770, y: 271, w: 230, h: 233 }, label: "Monk" },
  portrait_paladin: { sheet: SHEETS.classPortraits, region: { x: 25, y: 524, w: 248, h: 240 }, label: "Paladin" },
  portrait_bard: { sheet: SHEETS.classPortraits, region: { x: 279, y: 524, w: 237, h: 240 }, label: "Bard" },
  portrait_sorcerer: { sheet: SHEETS.classPortraits, region: { x: 527, y: 524, w: 236, h: 240 }, label: "Sorcerer" },
  portrait_warlock: { sheet: SHEETS.classPortraits, region: { x: 770, y: 524, w: 230, h: 240 }, label: "Warlock" },
} as const satisfies Record<string, SpriteDef>;

export type SpriteId = keyof typeof SPRITES;

export function getSprite(id: SpriteId): SpriteDef {
  return SPRITES[id];
}

// Helper to get all sprites in a category
export function getSpritesByPrefix(prefix: string): Array<{ id: SpriteId; def: SpriteDef }> {
  return (Object.entries(SPRITES) as Array<[SpriteId, SpriteDef]>)
    .filter(([id]) => id.startsWith(prefix))
    .map(([id, def]) => ({ id, def }));
}
