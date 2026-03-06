"use client";

import { useCallback, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TerminalHUD, TerminalModal, TerminalLoading } from "@/components/terminal";
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
import { trpc } from "@/lib/trpc";
import type { Store, NPC, DialogueNode, GameItem, Direction } from "@/lib/types";

export default function PlayCharacterPage() {
  const params = useParams();
  const characterId = params.characterId as string;

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
    setPlayer,
    setCurrentRoom,
    setMapViewport,
  } = useGameStore();

  // ── Load character data ──
  const characterQuery = trpc.character.get.useQuery(
    { id: characterId },
    { enabled: !!characterId }
  );

  const mapQuery = trpc.game.getMap.useQuery(
    { characterId },
    { enabled: !!characterId }
  );

  // Sync character data into store
  useEffect(() => {
    if (characterQuery.data) {
      setPlayer(characterQuery.data);
    }
  }, [characterQuery.data, setPlayer]);

  // Sync map data into store and extract current room
  useEffect(() => {
    if (mapQuery.data) {
      setMapViewport(mapQuery.data);
      // Extract current room from map viewport
      for (const row of mapQuery.data.cells) {
        for (const cell of row) {
          if (cell.isCurrent && cell.room) {
            setCurrentRoom(cell.room);
            break;
          }
        }
      }
    }
  }, [mapQuery.data, setMapViewport, setCurrentRoom]);

  // ── Mutations ──
  const moveMutation = trpc.game.move.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      setCurrentRoom(data.room);
      setMapViewport(data.mapViewport);
      addToGameLog(`You enter ${data.room.name}.`);

      if (data.enterCombat && data.encounter) {
        addToGameLog("Enemies block your path!");
        setScreen("combat");
      } else if (data.room.type === "store") {
        // Store rooms are handled by entering the store
        addToGameLog("You see a merchant's stall.");
      } else if (data.room.type === "npc_room") {
        addToGameLog("Someone is here...");
      }
    },
    onError(err) {
      addToGameLog(`Cannot move: ${err.message}`);
    },
  });

  const searchMutation = trpc.game.searchRoom.useMutation({
    onSuccess(data) {
      addToGameLog(data.message);
      if (data.success && "items" in data && data.items) {
        // Refetch character to update inventory
        characterQuery.refetch();
      }
    },
    onError(err) {
      addToGameLog(`Search failed: ${err.message}`);
    },
  });

  // ── NPC dialogue state ──
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
          const direction = action.replace("move_", "") as Direction;
          addToGameLog(`You move ${direction}...`);
          moveMutation.mutate({ characterId, direction });
          break;
        }
        case "search":
          addToGameLog("You search the room carefully...");
          searchMutation.mutate({ characterId });
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
    [addToGameLog, setScreen, moveMutation, searchMutation, characterId]
  );

  // ── Store handlers ──
  const handleBuy = useCallback(
    (itemId: string) => {
      addToGameLog(`Purchased item ${itemId}`);
      // TODO: Wire to store.buy tRPC mutation
    },
    [addToGameLog]
  );

  const handleSell = useCallback(
    (itemId: string) => {
      addToGameLog(`Sold item ${itemId}`);
      // TODO: Wire to store.sell tRPC mutation
    },
    [addToGameLog]
  );

  // ── NPC handlers ──
  const handleNPCChoice = useCallback(
    (choiceIndex: number) => {
      addToGameLog(`Chose dialogue option ${choiceIndex + 1}`);
      // TODO: Wire to npc.advanceDialogue tRPC mutation
    },
    [addToGameLog]
  );

  // ── Inventory handlers ──
  const handleEquip = useCallback(
    (itemId: string) => {
      addToGameLog(`Equipped ${itemId}`);
      // TODO: Wire to inventory.equip tRPC mutation
    },
    [addToGameLog]
  );

  const handleUnequip = useCallback(
    (itemId: string) => {
      addToGameLog(`Unequipped ${itemId}`);
      // TODO: Wire to inventory.unequip tRPC mutation
    },
    [addToGameLog]
  );

  const handleUseItem = useCallback(
    (itemId: string) => {
      addToGameLog(`Used ${itemId}`);
      // TODO: Wire to inventory.use tRPC mutation
    },
    [addToGameLog]
  );

  const handleDrop = useCallback(
    (itemId: string) => {
      addToGameLog(`Dropped ${itemId}`);
      // TODO: Wire to inventory.drop tRPC mutation
    },
    [addToGameLog]
  );

  // ── Help modal ──
  const [showHelp, setShowHelp] = useState(false);

  // ── Loading state ──
  if (characterQuery.isLoading || mapQuery.isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <TerminalLoading />
      </div>
    );
  }

  if (characterQuery.error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-terminal-red font-mono">
        Failed to load character: {characterQuery.error.message}
      </div>
    );
  }

  if (!player || !currentRoom || !mapViewport) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <TerminalLoading />
      </div>
    );
  }

  const showInventory = screen === "inventory";
  const showCharacter = screen === "character";
  const showStore = screen === "store";
  const showNPC = screen === "npc";

  // Placeholder data for store/NPC overlays until those are wired
  const storeData: Store = activeStore ?? {
    id: "",
    name: "Store",
    localInventory: [],
    marketplaceInventory: [],
  };
  const npcData: NPC = activeNPC ?? {
    id: "",
    name: "NPC",
    description: "",
    dialogue: {},
    currentNode: "start",
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      <TerminalHUD
        className="h-full"
        topBar={<StatusBar player={player} />}
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
            <Map viewport={mapViewport} />
          </div>

          {/* Text panel */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <TextPanel room={currentRoom} gameLog={gameLog} />
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
          items={[]}
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
        <CharacterSheet player={player} onClose={closeOverlay} />
      </TerminalModal>

      {/* ── Store Overlay ── */}
      <TerminalModal
        open={showStore}
        onClose={closeOverlay}
        title={storeData.name}
        className="max-w-2xl"
      >
        <StorePanel
          store={storeData}
          player={player}
          onBuy={handleBuy}
          onSell={handleSell}
          onClose={closeOverlay}
        />
      </TerminalModal>

      {/* ── NPC Dialog Overlay ── */}
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
        ) : npcData.dialogue[npcData.currentNode] ? (
          <NPCDialog
            npc={npcData}
            currentNode={npcData.dialogue[npcData.currentNode]!}
            onChoice={handleNPCChoice}
            onClose={closeOverlay}
          />
        ) : null}
      </TerminalModal>

      {/* ── Help Modal ── */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
