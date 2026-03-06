"use client";

import { useCallback, useState } from "react";
import { TerminalHUD, TerminalModal } from "@/components/terminal";
import {
  StatusBar,
  ActionBar,
  Map,
  TextPanel,
  StorePanel,
  NPCDialog,
  InventoryPanel,
  CharacterSheet,
  HelpModal,
} from "@/components/game";
import { useGameStore } from "@/stores/gameStore";
import { GAME_CONFIG } from "@/lib/constants";
import {
  mockPlayer,
  mockRoom,
  mockMapViewport,
  mockGameLog,
} from "@/lib/mockData";
import type { Store, NPC, DialogueNode, GameItem } from "@/lib/types";

// TODO: Wire up tRPC calls when ready
// import { trpc } from "@/lib/trpc";

// ── Mock data for overlays (temporary) ───────────────────────────────

const mockStore: Store = {
  id: "store-001",
  name: "Grimwick's Goods",
  localInventory: [
    {
      item: {
        id: "si-1",
        itemId: "potion-heal-01",
        name: "Potion of Healing",
        type: "potion",
        rarity: "common",
        stats: { healing: 15 },
        quantity: 5,
        slot: null,
        isEquipped: false,
        description: "A ruby-red liquid that mends wounds.",
      },
      price: 25,
      stock: 5,
    },
    {
      item: {
        id: "si-2",
        itemId: "scroll-fire-01",
        name: "Scroll of Fireball",
        type: "scroll",
        rarity: "uncommon",
        stats: { fireDamage: 20 },
        quantity: 2,
        slot: null,
        isEquipped: false,
        description: "Unleash a ball of flame.",
      },
      price: 80,
      stock: 2,
    },
  ],
  marketplaceInventory: [
    {
      item: {
        id: "si-3",
        itemId: "sword-iron-01",
        name: "Iron Longsword",
        type: "weapon",
        rarity: "common",
        stats: { attack: 3 },
        quantity: 1,
        slot: null,
        isEquipped: false,
        description: "A sturdy iron blade.",
      },
      price: 50,
      stock: 1,
    },
  ],
};

const mockNPC: NPC = {
  id: "npc-001",
  name: "Old Harwick",
  description: "A weathered hermit with knowing eyes.",
  dialogue: {
    start: {
      id: "start",
      text: "Ah, another soul braving the depths. What brings you to my alcove, adventurer?",
      choices: [
        { text: "Tell me about the dungeon.", nextId: "dungeon_info" },
        { text: "Any rumors?", nextId: "rumors" },
        { text: "Farewell.", nextId: null },
      ],
    },
    dungeon_info: {
      id: "dungeon_info",
      text: "This place was once a great dwarven stronghold. Now it crawls with things best left unnamed. Watch for traps on the deeper floors.",
      choices: [
        { text: "Any rumors?", nextId: "rumors" },
        { text: "Thank you. Farewell.", nextId: null },
      ],
    },
    rumors: {
      id: "rumors",
      text: "I heard a shadow dragon has claimed the throne room to the south. Few who venture there return.",
      choices: [
        { text: "Tell me about the dungeon.", nextId: "dungeon_info" },
        { text: "I'll be careful. Farewell.", nextId: null },
      ],
    },
  },
  currentNode: "start",
};

// Mock inventory items for the inventory panel
const mockInventoryItems: GameItem[] = [
  {
    id: "inv-1",
    itemId: "longsword-01",
    name: "Flame-Touched Longsword",
    type: "weapon",
    rarity: "uncommon",
    stats: { attack: 4, fireDamage: 2 },
    quantity: 1,
    slot: 0,
    isEquipped: true,
    description: "A blade that glows faintly with inner fire.",
  },
  {
    id: "inv-2",
    itemId: "chainmail-01",
    name: "Dwarven Chainmail",
    type: "armor",
    rarity: "uncommon",
    stats: { ac: 5, con: 1 },
    quantity: 1,
    slot: 1,
    isEquipped: true,
    description: "Finely crafted chainmail of dwarven origin.",
  },
  {
    id: "inv-3",
    itemId: "potion-heal-01",
    name: "Potion of Healing",
    type: "potion",
    rarity: "common",
    stats: { healing: 15 },
    quantity: 3,
    slot: null,
    isEquipped: false,
    description: "A ruby-red liquid that mends wounds.",
  },
  {
    id: "inv-4",
    itemId: "scroll-fire-01",
    name: "Scroll of Fire",
    type: "scroll",
    rarity: "rare",
    stats: { fireDamage: 25 },
    quantity: 1,
    slot: null,
    isEquipped: false,
    description: "A scroll inscribed with arcane runes.",
  },
  {
    id: "inv-5",
    itemId: "shield-iron-01",
    name: "Iron Shield",
    type: "accessory",
    rarity: "common",
    stats: { ac: 2 },
    quantity: 1,
    slot: null,
    isEquipped: false,
    description: "A battered but reliable iron shield.",
  },
];

// ── Page Component ───────────────────────────────────────────────────

export default function PlayPage() {
  const {
    player,
    currentRoom,
    mapViewport,
    gameLog,
    screen,
    activeStore,
    activeNPC,
    addToGameLog,
    setScreen,
    setActiveStore,
    setActiveNPC,
  } = useGameStore();

  // Use mock data until tRPC is wired up
  const activePlayer = player ?? mockPlayer;
  const activeRoom = currentRoom ?? mockRoom;
  const activeMap = mapViewport ?? mockMapViewport;
  const activeLog = gameLog.length > 0 ? gameLog : mockGameLog;

  // TODO: Replace with actual tRPC mutations
  // const moveMutation = trpc.game.move.useMutation();
  // const getMapQuery = trpc.game.getMap.useQuery();

  // Track NPC dialogue node for mock
  // TODO: Replace with tRPC state management
  const currentNPCNode: DialogueNode | null =
    screen === "npc" && activeNPC
      ? activeNPC.dialogue[activeNPC.currentNode] ?? null
      : null;

  // ── Overlay close handlers ──

  const closeOverlay = useCallback(() => {
    setScreen("exploring");
    setActiveStore(null);
    setActiveNPC(null);
  }, [setScreen, setActiveStore, setActiveNPC]);

  // ── Action handler ──

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case "move_north":
        case "move_south":
        case "move_east":
        case "move_west": {
          const direction = action.replace("move_", "");
          addToGameLog(`You move ${direction}...`);
          // TODO: moveMutation.mutate({ direction });

          // TODO: When entering a store room, activate the store overlay via tRPC
          // TODO: When entering an NPC room, activate the NPC overlay via tRPC
          // For demo: simulate entering store/NPC rooms
          break;
        }
        case "search":
          addToGameLog("You search the room carefully...");
          break;
        case "inventory":
          setScreen("inventory");
          break;
        case "character":
          setScreen("character");
          break;
        case "help":
          setShowHelp(true);
          break;
        // Combat actions
        case "attack":
        case "defend":
        case "cast":
        case "flee":
        case "use_item":
          addToGameLog(`You chose to ${action.replace("_", " ")}!`);
          break;
        default:
          addToGameLog(`Unknown action: ${action}`);
      }
    },
    [addToGameLog, setScreen]
  );

  // ── Store handlers ──
  // TODO: Replace with tRPC mutations
  const handleBuy = useCallback(
    (itemId: string) => {
      addToGameLog(`Purchased item ${itemId}`);
    },
    [addToGameLog]
  );

  const handleSell = useCallback(
    (itemId: string) => {
      addToGameLog(`Sold item ${itemId}`);
    },
    [addToGameLog]
  );

  // ── NPC handlers ──
  // TODO: Replace with tRPC mutations
  const handleNPCChoice = useCallback(
    (choiceIndex: number) => {
      // In a real scenario, this would call tRPC to advance dialogue
      addToGameLog(`Chose dialogue option ${choiceIndex + 1}`);
    },
    [addToGameLog]
  );

  // ── Inventory handlers ──
  // TODO: Replace with tRPC mutations
  const handleEquip = useCallback(
    (itemId: string) => {
      addToGameLog(`Equipped ${itemId}`);
    },
    [addToGameLog]
  );

  const handleUnequip = useCallback(
    (itemId: string) => {
      addToGameLog(`Unequipped ${itemId}`);
    },
    [addToGameLog]
  );

  const handleUseItem = useCallback(
    (itemId: string) => {
      addToGameLog(`Used ${itemId}`);
    },
    [addToGameLog]
  );

  const handleDrop = useCallback(
    (itemId: string) => {
      addToGameLog(`Dropped ${itemId}`);
    },
    [addToGameLog]
  );

  // ── Determine which overlay is active ──

  const [showHelp, setShowHelp] = useState(false);

  const showInventory = screen === "inventory";
  const showCharacter = screen === "character";
  const showStore = screen === "store";
  const showNPC = screen === "npc";

  // Use active store from store or fall back to mock for demo
  const storeData = activeStore ?? mockStore;
  const npcData = activeNPC ?? mockNPC;

  return (
    <div className="h-screen w-screen overflow-hidden">
      <TerminalHUD
        className="h-full"
        topBar={<StatusBar player={activePlayer} />}
        bottomBar={
          <ActionBar
            onAction={handleAction}
            screen={screen}
          />
        }
      >
        {/* Main content: stacked on mobile, side-by-side on md+ */}
        <div className="flex flex-col md:flex-row h-full gap-4">
          {/* Map panel */}
          <div className="w-full md:w-[35%] shrink-0 flex flex-col items-center justify-center md:border-r border-b md:border-b-0 border-terminal-border pb-4 md:pb-0 md:pr-4">
            <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider mb-2">
              Dungeon Map
            </div>
            <Map viewport={activeMap} />
          </div>

          {/* Text panel */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <TextPanel room={activeRoom} gameLog={activeLog} />
          </div>
        </div>
      </TerminalHUD>

      {/* ── Inventory Overlay ── */}
      <TerminalModal
        open={showInventory}
        onClose={closeOverlay}
        title="INVENTORY"
        className="max-w-2xl"
      >
        <InventoryPanel
          items={mockInventoryItems}
          maxSlots={GAME_CONFIG.MAX_INVENTORY_SLOTS}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUse={handleUseItem}
          onDrop={handleDrop}
          onClose={closeOverlay}
        />
      </TerminalModal>

      {/* ── Character Sheet Overlay ── */}
      <TerminalModal
        open={showCharacter}
        onClose={closeOverlay}
        title="CHARACTER SHEET"
        className="max-w-lg"
      >
        <CharacterSheet player={activePlayer} onClose={closeOverlay} />
      </TerminalModal>

      {/* ── Store Overlay ── */}
      {/* TODO: Activate when entering store room type via tRPC */}
      <TerminalModal
        open={showStore}
        onClose={closeOverlay}
        title={storeData.name}
        className="max-w-2xl"
      >
        <StorePanel
          store={storeData}
          player={activePlayer}
          onBuy={handleBuy}
          onSell={handleSell}
          onClose={closeOverlay}
        />
      </TerminalModal>

      {/* ── NPC Dialog Overlay ── */}
      {/* TODO: Activate when entering NPC room type via tRPC */}
      <TerminalModal
        open={showNPC}
        onClose={closeOverlay}
        title={npcData.name}
        className="max-w-lg"
      >
        {currentNPCNode ? (
          <NPCDialog
            npc={npcData}
            currentNode={currentNPCNode}
            onChoice={handleNPCChoice}
            onClose={closeOverlay}
          />
        ) : (
          <NPCDialog
            npc={npcData}
            currentNode={npcData.dialogue[npcData.currentNode]!}
            onChoice={handleNPCChoice}
            onClose={closeOverlay}
          />
        )}
      </TerminalModal>

      {/* ── Help Modal ── */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
