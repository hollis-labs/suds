import { db } from "../db";
import { worlds, regions, areas } from "../db/schema";
import type { NewWorld, NewRegion, NewArea } from "../db/schema";

/**
 * Seeds the starter world "Aethermoor" with 3 regions and 2-3 areas each.
 * Idempotent — checks if Aethermoor already exists before inserting.
 */
export async function seedStarterWorld() {
  // Check if world already exists
  const existing = await db.query.worlds.findFirst({
    where: (w, { eq }) => eq(w.name, "Aethermoor"),
  });

  if (existing) {
    console.log("Starter world 'Aethermoor' already exists, skipping seed.");
    return existing;
  }

  console.log("Seeding starter world: Aethermoor...");

  // ── World ──────────────────────────────────────────────────────────────────

  const worldData: NewWorld = {
    name: "Aethermoor",
    description:
      "A realm of fractured coastlines, tangled forests, and iron-crowned mountains. " +
      "Ancient magic still hums beneath the soil, drawing adventurers to its fog-laden shores. " +
      "Three great regions divide the land, each ruled by its own dangers and wonders.",
    theme: "dark_fantasy",
    seed: "aethermoor-v1",
  };

  const [world] = await db.insert(worlds).values(worldData).returning();
  console.log(`  Created world: ${world.name} (${world.id})`);

  // ── Regions ────────────────────────────────────────────────────────────────

  const regionDefs: Omit<NewRegion, "worldId">[] = [
    {
      name: "The Ashen Coast",
      description:
        "A windswept stretch of black-sand beaches and crumbling sea cliffs. " +
        "Shipwrecks litter the shallows, and the villages that cling to the shore " +
        "are haunted by salt-crusted undead that crawl from the tide at dusk. " +
        "Lighthouse keepers whisper of a drowned city visible on moonless nights.",
      theme: "horror",
      position: { x: 0, y: 0 },
      connections: [],
      metadata: {
        landmarks: ["The Drowned Lighthouse", "Wrecker's Reef", "Salt Hollow"],
        faction: "The Tidewatchers",
        flavor: "Coastal horror with maritime dangers",
      },
      generatedBy: "seed",
    },
    {
      name: "Verdant Vale",
      description:
        "An impossibly lush valley where ancient trees grow so tall their canopy " +
        "blocks the sky. Bioluminescent fungi light the forest floor, and the rivers " +
        "run with water said to restore vigor. But the deeper groves are tangled with " +
        "sentient thorns, and the fey courts that dwell within do not welcome trespassers.",
      theme: "epic",
      position: { x: 1, y: 0 },
      connections: [],
      metadata: {
        landmarks: [
          "The Glowing Grotto",
          "Thornheart Clearing",
          "Elder Root Bridge",
        ],
        faction: "The Green Wardens",
        flavor: "Enchanted forest with fey dangers",
      },
      generatedBy: "seed",
    },
    {
      name: "Iron Peaks",
      description:
        "A jagged mountain range where ore veins glow red-hot through exposed rock faces. " +
        "Dwarven forges once thundered here, but the deep mines were sealed after something " +
        "was unearthed in the lowest shafts. Now only desperate prospectors and exiled " +
        "warriors brave the high passes, hunted by wyverns and stone golems.",
      theme: "dark_fantasy",
      position: { x: 0, y: 1 },
      connections: [],
      metadata: {
        landmarks: [
          "The Sealed Mines of Kharn",
          "Wyvern's Roost",
          "The Ember Forge",
        ],
        faction: "The Iron Remnant",
        flavor: "Mountain fortress with underground horrors",
      },
      generatedBy: "seed",
    },
  ];

  const insertedRegions = await db
    .insert(regions)
    .values(regionDefs.map((r) => ({ ...r, worldId: world.id })))
    .returning();

  // Wire up connections between regions (all three connect to each other)
  const regionIds = insertedRegions.map((r) => r.id);
  for (let i = 0; i < insertedRegions.length; i++) {
    const otherIds = regionIds.filter((_, j) => j !== i);
    await db
      .update(regions)
      .set({ connections: otherIds })
      .where(
        (await import("drizzle-orm")).eq(regions.id, insertedRegions[i].id)
      );
  }

  for (const r of insertedRegions) {
    console.log(`  Created region: ${r.name} (${r.id})`);
  }

  // ── Areas ──────────────────────────────────────────────────────────────────

  const areasByRegion: Record<string, Omit<NewArea, "regionId">[]> = {
    "The Ashen Coast": [
      {
        name: "Saltmere Village",
        description:
          "A fishing village clinging to the cliff edge, its stilted buildings " +
          "groaning in the constant wind. The tavern serves grog that could strip paint, " +
          "and the locals eye strangers with suspicion born from too many raids.",
        areaType: "town",
        gridWidth: 15,
        gridHeight: 15,
        position: { x: 0, y: 0 },
        connections: [],
        metadata: {
          buildings: ["The Salted Eel Tavern", "Harbor Master's Office", "Chapel of Tides"],
          terrain: "coastal_town",
        },
        generatedBy: "seed",
      },
      {
        name: "Wrecker's Beach",
        description:
          "A treacherous stretch of black sand littered with the bones of ships. " +
          "At low tide, rusted hulls emerge like the ribs of dead leviathans. " +
          "Crabs the size of dogs scuttle between the wreckage, and worse things " +
          "surface when the fog rolls in.",
        areaType: "wilderness",
        gridWidth: 20,
        gridHeight: 20,
        position: { x: 1, y: 0 },
        connections: [],
        metadata: { terrain: "beach", hazards: ["undead", "crabs", "riptide"] },
        generatedBy: "seed",
      },
      {
        name: "The Drowned Lighthouse",
        description:
          "Half-submerged at the end of a crumbling causeway, this ancient lighthouse " +
          "still flickers with an eerie green flame. The interior spirals down " +
          "below sea level into flooded chambers where something still keeps the light burning.",
        areaType: "dungeon_entrance",
        gridWidth: 10,
        gridHeight: 10,
        position: { x: 2, y: 0 },
        connections: [],
        metadata: { terrain: "ruins", difficulty: "medium", floors: 3 },
        generatedBy: "seed",
      },
    ],
    "Verdant Vale": [
      {
        name: "Fernhollow Settlement",
        description:
          "A community of treehouses and rope bridges nestled in the mid-canopy. " +
          "The Green Wardens maintain a waystation here, offering supplies and warnings " +
          "to those foolish enough to venture deeper into the vale.",
        areaType: "town",
        gridWidth: 15,
        gridHeight: 15,
        position: { x: 0, y: 0 },
        connections: [],
        metadata: {
          buildings: ["Warden's Lodge", "The Hollow Stump Inn", "Herbalist's Hut"],
          terrain: "forest_town",
        },
        generatedBy: "seed",
      },
      {
        name: "The Glowing Grotto",
        description:
          "A vast cave mouth draped in luminescent moss, leading into chambers " +
          "filled with crystal formations that pulse with inner light. The fungi here " +
          "have medicinal properties, but the myconid colonies that tend them are territorial.",
        areaType: "wilderness",
        gridWidth: 20,
        gridHeight: 20,
        position: { x: 1, y: 0 },
        connections: [],
        metadata: { terrain: "cave", hazards: ["myconids", "spore_clouds"] },
        generatedBy: "seed",
      },
    ],
    "Iron Peaks": [
      {
        name: "Hammerfall Outpost",
        description:
          "A fortified camp at the base of the mountains, built from salvaged dwarven " +
          "stonework. Prospectors, mercenaries, and the occasional scholar gather here " +
          "before attempting the high passes. The forge still works, barely.",
        areaType: "fortress",
        gridWidth: 15,
        gridHeight: 15,
        position: { x: 0, y: 0 },
        connections: [],
        metadata: {
          buildings: ["The Broken Anvil Smithy", "Prospector's Hall", "Watchtower"],
          terrain: "mountain_fort",
        },
        generatedBy: "seed",
      },
      {
        name: "The Ember Pass",
        description:
          "A narrow mountain trail where volcanic vents spew sulfurous steam. " +
          "The rocks glow faintly orange at night, and wyverns nest in the higher crags. " +
          "It's the only route to the sealed mines — and the most dangerous.",
        areaType: "wilderness",
        gridWidth: 25,
        gridHeight: 15,
        position: { x: 1, y: 0 },
        connections: [],
        metadata: { terrain: "mountain_pass", hazards: ["wyverns", "volcanic_vents", "rockslides"] },
        generatedBy: "seed",
      },
      {
        name: "The Sealed Mines of Kharn",
        description:
          "Massive iron doors, fused shut by dwarven runes, mark the entrance to the " +
          "deepest mines in the Peaks. Claw marks score the doors from the inside. " +
          "Whatever the dwarves sealed away still stirs — tremors shake the ground at midnight.",
        areaType: "dungeon_entrance",
        gridWidth: 12,
        gridHeight: 12,
        position: { x: 2, y: 0 },
        connections: [],
        metadata: { terrain: "mine_entrance", difficulty: "hard", floors: 5 },
        generatedBy: "seed",
      },
    ],
  };

  for (const region of insertedRegions) {
    const areaDefs = areasByRegion[region.name];
    if (!areaDefs) continue;

    const insertedAreas = await db
      .insert(areas)
      .values(areaDefs.map((a) => ({ ...a, regionId: region.id })))
      .returning();

    // Wire area connections (sequential)
    const areaIds = insertedAreas.map((a) => a.id);
    const { eq } = await import("drizzle-orm");
    for (let i = 0; i < insertedAreas.length; i++) {
      const connected = areaIds.filter((_, j) => Math.abs(j - i) === 1);
      await db
        .update(areas)
        .set({ connections: connected })
        .where(eq(areas.id, insertedAreas[i].id));
    }

    for (const a of insertedAreas) {
      console.log(`    Created area: ${a.name} (${a.areaType}) in ${region.name}`);
    }
  }

  console.log("\nWorld seed complete!");
  return world;
}

// CLI entrypoint: `npx tsx src/server/game/world-seed.ts`
if (require.main === module || process.argv[1]?.includes("world-seed")) {
  seedStarterWorld()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("World seed failed:", err);
      process.exit(1);
    });
}
