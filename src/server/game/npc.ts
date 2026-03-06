import type { DialogueNode } from "@/lib/types";
import type { Theme } from "@/lib/constants";
import { roll } from "@/server/game/dice";
import namesData from "@/server/gamedata/names.json";
import themesData from "@/server/gamedata/themes.json";

// ---------------------------------------------------------------------------
// Theme-specific dialogue content
// ---------------------------------------------------------------------------

interface ThemeDialogueContent {
  greetings: string[];
  dungeonInfo: string[];
  loreInfo: string[];
  rumors: string[];
  farewells: string[];
  questHints: string[];
  descriptions: string[];
}

const THEME_DIALOGUE: Record<Theme, ThemeDialogueContent> = {
  horror: {
    greetings: [
      "You shouldn't be here... none of us should. But since you are, what do you want?",
      "*jumps* Oh! A living person! I thought... never mind. What do you need?",
      "Keep your voice down. They listen through the walls. How can I help you?",
    ],
    dungeonInfo: [
      "The deeper you go, the worse it gets. I've heard things... wet, dragging sounds from below. Don't go past the third level unless you're ready to lose your mind.",
      "There are things down there that don't have names. The old explorers called them 'the scratching ones.' I call them a reason to stay right here.",
    ],
    loreInfo: [
      "This place was a temple once, before the corruption took root. They say the priests performed a ritual that went wrong — opened something that should have stayed sealed.",
      "The walls bleed on certain nights. Not metaphorically. Actually bleed. The old texts say it's the dungeon remembering what happened here.",
    ],
    rumors: [
      "I heard a group went down to level five last week. Only one came back, and she won't speak anymore. Just stares at the walls and whispers numbers.",
      "They say there's a chamber deep below where the dead don't stay dead. Something keeps pulling them back, over and over.",
    ],
    farewells: [
      "Be careful out there. And if you hear whispering... don't answer.",
      "May whatever gods still watch over this place keep you safe. I doubt they will, but still.",
    ],
    questHints: [
      "I lost something precious deeper in. If you find a locket with a cracked portrait... bring it back to me. Please.",
    ],
    descriptions: [
      "A gaunt figure huddles in the corner, eyes darting nervously. Dark circles frame haunted, sleepless eyes.",
      "A pale-skinned wanderer wrapped in a tattered cloak, flinching at every sound.",
      "A scarred survivor clutching a dim lantern, whispering prayers under their breath.",
    ],
  },
  funny: {
    greetings: [
      "Oh hey! A customer! Or are you lost? Either way, same prices. What's up?",
      "Welcome, welcome! Please ignore the goblin in the corner, he's on break. What can I do ya for?",
      "Ah, an adventurer! I can tell by the smell. No offense. How can I help?",
    ],
    dungeonInfo: [
      "Pro tip: the monsters on level three are allergic to confidence. Walk in like you own the place and they just... stare at you confused. Doesn't help with the damage though.",
      "There's a room down there with a mimic that's given up pretending to be a chest. Now it just sits there looking sad. Don't open it though — it's still bitey.",
    ],
    loreInfo: [
      "Legend says this dungeon was built by a wizard who got really into interior decorating. Went a bit overboard with the death traps, if you ask me.",
      "The ancient texts speak of a great hero who once cleared this entire dungeon. Then they realized they forgot to loot the boss and had to do it all again.",
    ],
    rumors: [
      "Word is there's a dragon down on level seven, but it mostly just hoards office supplies. Pens, staplers, that sort of thing. Very territorial about its sticky notes.",
      "Someone said they found a sword that talks. It mostly just complains about being used for violence. Very passive-aggressive weapon.",
    ],
    farewells: [
      "Good luck out there! Try not to die — it's terrible for repeat business!",
      "Off you go then! Remember: if it looks like a trap, smells like a trap, and has a sign that says 'Not A Trap'... it's probably a trap.",
    ],
    questHints: [
      "I lost my pet chicken somewhere in the dungeon. His name is Lord Cluckington III. He's wearing a tiny helmet. Don't ask.",
    ],
    descriptions: [
      "A cheerful merchant with a suspiciously stained apron and a grin that's about 20% too wide.",
      "A rotund figure wearing mismatched armor pieces and a hat shaped like a fish.",
      "An enthusiastic person juggling three potions and somehow not dropping any of them. Yet.",
    ],
  },
  epic: {
    greetings: [
      "Hail, brave adventurer. Your coming was foretold in the ancient scrolls. How may I serve your quest?",
      "Welcome, hero. I am but a humble guide in these legendary halls. What knowledge do you seek?",
      "The light of destiny shines upon you, traveler. Speak, and I shall aid your noble cause.",
    ],
    dungeonInfo: [
      "Beyond the Great Gate lies the Hall of Trials, where only the worthy may pass. Many heroes have tested their mettle there — few have emerged victorious.",
      "The deeper chambers were sealed by the Titan Kings millennia ago. Ancient guardians still patrol those halls, bound by oaths older than memory.",
    ],
    loreInfo: [
      "In the Age of Heroes, this fortress was the last bastion against the Shadow Tide. The great paladin Arathorn held these walls for seven days and seven nights.",
      "The crystal formations you see were left by the Elder Dragons when they shaped the world. Each one holds a fragment of primordial power.",
    ],
    rumors: [
      "It is said that a legendary artifact lies in the deepest vault — a weapon forged in starfire, capable of turning the tide of any battle.",
      "Travelers speak of a hidden chamber where the spirits of fallen heroes gather. Those deemed worthy may receive their blessing.",
    ],
    farewells: [
      "May the light of the ancients guide your path, hero. Your legend grows with each step.",
      "Go forth with valor, brave one. The songs of your deeds shall echo through these halls for eternity.",
    ],
    questHints: [
      "An ancient relic was stolen from the Shrine of Light. If you could recover it, the blessings of the old gods would be yours.",
    ],
    descriptions: [
      "A tall, regal figure in flowing robes, their eyes gleaming with ancient wisdom and quiet strength.",
      "A battle-worn knight standing proud, their armor engraved with the sigils of a legendary order.",
      "A serene elder whose voice carries the weight of centuries, surrounded by a faint golden aura.",
    ],
  },
  dark_fantasy: {
    greetings: [
      "Another soul drawn to this forsaken place. I suppose you want something. Everyone does.",
      "You have the look of someone who's seen too much and understood too little. What do you want?",
      "Still alive, are you? That's more than most can say down here. Speak quickly.",
    ],
    dungeonInfo: [
      "The corruption runs deeper than the stone. Every level you descend, you'll feel it — a weight on your soul, a whisper in your thoughts. Turn back if you still can.",
      "The old passages have changed. Walls shift when you're not looking. Rooms appear that weren't there before. This place is alive, and it's hungry.",
    ],
    loreInfo: [
      "This was once a place of learning. Scholars came from every kingdom to study here. Then they discovered something in the deep — something that should have stayed buried. The corruption consumed them all.",
      "The fallen order once swore to protect this place. One by one, they succumbed to the darkness. Now they walk these halls as its guardians, bound by twisted duty.",
    ],
    rumors: [
      "They say there's a cure for the corruption hidden somewhere below. I don't believe it, but desperation makes believers of us all.",
      "A cursed knight wanders the lower levels, still searching for redemption. Some say if you defeat them, they'll thank you with their dying breath.",
    ],
    farewells: [
      "Try to hold onto who you are down there. The darkness has a way of making you forget.",
      "Survive if you can. That's all any of us can do.",
    ],
    questHints: [
      "My companion fell to the corruption three days ago. If you find them... end their suffering. They would have wanted that.",
    ],
    descriptions: [
      "A weary figure with hollow eyes and bandaged hands, carrying the weight of countless losses.",
      "A cynical wanderer in a threadbare cloak, their expression hardened by grief and survival.",
      "A haunted soul bearing ritual scars, who speaks with the quiet resignation of someone who has given up hope.",
    ],
  },
};

// ---------------------------------------------------------------------------
// NPC generation
// ---------------------------------------------------------------------------

/**
 * Generate an NPC with a name, description, and dialogue tree.
 *
 * @param theme - Current dungeon theme
 * @param depth - Distance from origin
 * @returns NPC data with name, description, and dialogue tree
 */
export function generateNPC(
  theme: Theme,
  _depth: number,
): { name: string; description: string; dialogue: Record<string, DialogueNode> } {
  // Pick a name: firstName + title
  const firstNames = namesData.npcFirstNames;
  const titles = namesData.npcTitles;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]!;
  const title = titles[Math.floor(Math.random() * titles.length)]!;
  const name = `${firstName} ${title}`;

  // Pick a description based on theme
  const themeContent = THEME_DIALOGUE[theme];
  const description =
    themeContent.descriptions[
      Math.floor(Math.random() * themeContent.descriptions.length)
    ]!;

  // Generate dialogue tree
  const dialogue = generateDialogueTree(theme);

  return { name, description, dialogue };
}

// ---------------------------------------------------------------------------
// Dialogue tree generation
// ---------------------------------------------------------------------------

/**
 * Generate a dialogue tree with at least 6-8 nodes, branching from root.
 *
 * Structure:
 *   root -> dungeon_info, lore_info, rumors, quest_hint, farewell
 *   dungeon_info -> back_to_root, farewell
 *   lore_info -> back_to_root, farewell
 *   rumors -> back_to_root, farewell
 *   quest_hint -> accept_quest, back_to_root
 *   accept_quest -> back_to_root
 *   farewell -> null (end)
 */
export function generateDialogueTree(
  theme: Theme,
): Record<string, DialogueNode> {
  const content = THEME_DIALOGUE[theme];

  const pickRandom = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)]!;

  const greeting = pickRandom(content.greetings);
  const dungeonText = pickRandom(content.dungeonInfo);
  const loreText = pickRandom(content.loreInfo);
  const rumorText = pickRandom(content.rumors);
  const farewellText = pickRandom(content.farewells);
  const questText = pickRandom(content.questHints);

  const tree: Record<string, DialogueNode> = {
    root: {
      id: "root",
      text: greeting,
      choices: [
        { text: "Ask about the dungeon", nextId: "dungeon_info" },
        { text: "Ask about lore", nextId: "lore_info" },
        { text: "Trade rumors", nextId: "rumors" },
        { text: "Any tasks for me?", nextId: "quest_hint" },
        { text: "Farewell", nextId: "farewell" },
      ],
    },
    dungeon_info: {
      id: "dungeon_info",
      text: dungeonText,
      choices: [
        { text: "Tell me more", nextId: "lore_info" },
        { text: "Back", nextId: "root" },
        { text: "Farewell", nextId: "farewell" },
      ],
    },
    lore_info: {
      id: "lore_info",
      text: loreText,
      choices: [
        { text: "Interesting... any rumors?", nextId: "rumors" },
        { text: "Back", nextId: "root" },
        { text: "Farewell", nextId: "farewell" },
      ],
    },
    rumors: {
      id: "rumors",
      text: rumorText,
      choices: [
        { text: "Back", nextId: "root" },
        { text: "Farewell", nextId: "farewell" },
      ],
    },
    quest_hint: {
      id: "quest_hint",
      text: questText,
      choices: [
        { text: "I'll help", nextId: "accept_quest", action: "accept_quest" },
        { text: "Not right now", nextId: "root" },
        { text: "Farewell", nextId: "farewell" },
      ],
    },
    accept_quest: {
      id: "accept_quest",
      text: "Thank you. I won't forget this. Come back when it's done.",
      choices: [
        { text: "Anything else?", nextId: "root" },
        { text: "Farewell", nextId: "farewell" },
      ],
    },
    farewell: {
      id: "farewell",
      text: farewellText,
      choices: [
        { text: "Wait, one more thing...", nextId: "root" },
        { text: "Goodbye", nextId: null },
      ],
    },
  };

  return tree;
}
