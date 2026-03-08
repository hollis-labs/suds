"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { TerminalHUD, TerminalModal, TerminalLoading } from "@/components/terminal";
import { HudBar } from "@/components/pixel/HudBar";
import {
  StatusBar,
  Map, // TODO: Remove legacy Map component after one release cycle post-migration
  TextPanel,
  CombatPanel,
  DeathScreen,
  VictoryScreen,
  LevelUpModal,
  StorePanel,
  NPCDialog,
  InventoryPanel,
  CharacterSheet,
  HelpModal,
  LorePanel,
  PartyPanel,
  NewsPanel,
  AboutPanel,
  WorldMapView,
  RegionMapView,
  RoomDetailDrawer,
} from "@/components/game";
import { TileMap } from "@/components/pixel/TileMap";
import { Breadcrumb } from "@/components/pixel/Breadcrumb";
import type { BreadcrumbSegment } from "@/components/pixel/Breadcrumb";
import { buildTileFromRoom } from "@/lib/tile-types";
import type { TileMapData, TileData } from "@/lib/tile-types";
import { useGameStore } from "@/stores/gameStore";
import { GAME_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { Store, NPC, DialogueNode, GameItem, Direction, CombatAction, CombatState, Player, NavigationLayer } from "@/lib/types";

// ── Keyboard map (module-level constant) ──────────────────────────────
const EXPLORING_KEY_MAP: Record<string, string> = {
  w: "move_north", W: "move_north", ArrowUp: "move_north",
  s: "move_south", S: "move_south", ArrowDown: "move_south",
  d: "move_east", D: "move_east", ArrowRight: "move_east",
  a: "move_west", A: "move_west", ArrowLeft: "move_west",
  x: "search", X: "search",
  r: "rest", R: "rest",
  f: "interact_shrine", F: "interact_shrine",
  t: "talk", T: "talk",
  b: "shop", B: "shop",
  i: "inventory", I: "inventory",
  c: "character", C: "character",
  "?": "help",
  l: "lore", L: "lore",
  p: "party", P: "party",
  n: "news", N: "news",
  "~": "about",
  q: "exit", Q: "exit",
};

// ── Directional Pad Component ─────────────────────────────────────────

interface DPadProps {
  onMove: (direction: Direction) => void;
  onSearch: () => void;
  disabled?: boolean;
  availableExits?: string[];
}

function DPad({ onMove, onSearch, disabled, availableExits = [] }: DPadProps) {
  // Blur after click so keyboard shortcuts continue to work
  const clickAndBlur = (handler: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    handler();
    e.currentTarget.blur();
  };

  const dirBtn = (dir: Direction, label: string) => {
    const hasExit = availableExits.includes(dir);
    return cn(
      "font-mono text-xs font-bold border",
      "w-12 h-12 md:w-10 md:h-8 flex items-center justify-center transition-all",
      disabled
        ? "text-terminal-border border-terminal-border cursor-not-allowed opacity-40"
        : hasExit
          ? "text-terminal-green border-terminal-green bg-terminal-green/5 hover:bg-terminal-green/15 active:bg-terminal-green/25 cursor-pointer terminal-glow"
          : "text-terminal-border border-terminal-border/50 opacity-30 cursor-not-allowed"
    );
  };

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      {/* North */}
      <div className="flex justify-center">
        <button
          className={dirBtn("north", "N")}
          onClick={clickAndBlur(() => !disabled && availableExits.includes("north") && onMove("north"))}
          disabled={disabled || !availableExits.includes("north")}
          title="North (W)"
        >
          N
        </button>
      </div>
      {/* West / Search / East */}
      <div className="flex gap-0.5">
        <button
          className={dirBtn("west", "W")}
          onClick={clickAndBlur(() => !disabled && availableExits.includes("west") && onMove("west"))}
          disabled={disabled || !availableExits.includes("west")}
          title="West (A)"
        >
          W
        </button>
        <button
          className={cn(
            "font-mono text-xs font-bold border border-terminal-border",
            "w-12 h-12 md:w-10 md:h-8 flex items-center justify-center transition-colors",
            disabled
              ? "text-terminal-border cursor-not-allowed opacity-40"
              : "text-terminal-amber border-terminal-amber/50 hover:border-terminal-amber hover:bg-terminal-amber/10 cursor-pointer"
          )}
          onClick={clickAndBlur(() => !disabled && onSearch())}
          disabled={disabled}
          title="Search (X)"
        >
          {"\u00B7"}
        </button>
        <button
          className={dirBtn("east", "E")}
          onClick={clickAndBlur(() => !disabled && availableExits.includes("east") && onMove("east"))}
          disabled={disabled || !availableExits.includes("east")}
          title="East (D)"
        >
          E
        </button>
      </div>
      {/* South */}
      <div className="flex justify-center">
        <button
          className={dirBtn("south", "S")}
          onClick={clickAndBlur(() => !disabled && availableExits.includes("south") && onMove("south"))}
          disabled={disabled || !availableExits.includes("south")}
          title="South (S)"
        >
          S
        </button>
      </div>
    </div>
  );
}

// ── Exploring Action Buttons ──────────────────────────────────────────

interface ExploringActionsProps {
  onAction: (action: string) => void;
  roomType?: string;
}

function ExploringActions({ onAction, roomType }: ExploringActionsProps) {
  const RESTABLE_ROOMS = ["safe_room", "shrine", "npc_room"];
  const canRest = roomType ? RESTABLE_ROOMS.includes(roomType) : false;

  const buttons = [
    { key: "X", label: "Search", action: "search" },
    ...(canRest
      ? [{ key: "R", label: "Rest", action: "rest" }]
      : []),
    ...(roomType === "shrine"
      ? [{ key: "F", label: "Shrine", action: "interact_shrine" }]
      : []),
    ...(roomType === "npc_room"
      ? [{ key: "T", label: "Talk", action: "talk" }]
      : []),
    ...(roomType === "store"
      ? [{ key: "B", label: "Shop", action: "shop" }]
      : []),
    { key: "I", label: "Inventory", action: "inventory" },
    { key: "C", label: "Character", action: "character" },
    { key: "P", label: "Party", action: "party" },
    { key: "L", label: "Codex", action: "lore" },
    { key: "N", label: "News", action: "news" },
    { key: "~", label: "About", action: "about" },
    { key: "Q", label: "Exit", action: "exit" },
    { key: "?", label: "Help", action: "help" },
  ];

  return (
    <div className="flex flex-wrap gap-2 font-mono text-xs">
      {buttons.map((btn) => (
        <button
          key={btn.action}
          onClick={(e) => { onAction(btn.action); e.currentTarget.blur(); }}
          className="text-terminal-green-dim hover:text-terminal-green transition-colors px-2 py-2.5 md:py-1 min-h-[44px] md:min-h-0 border border-terminal-border hover:border-terminal-green"
        >
          <span className="text-terminal-green">[{btn.key}]</span> {btn.label}
        </button>
      ))}
    </div>
  );
}

// ── Key Hints Bar ─────────────────────────────────────────────────────

function KeyHintsBar({ screen, roomType }: { screen: string; roomType?: string }) {
  const RESTABLE_ROOMS = ["safe_room", "shrine", "npc_room"];
  const canRest = roomType ? RESTABLE_ROOMS.includes(roomType) : false;
  const restHint = canRest ? " | R: Rest" : "";
  const shrineHint = roomType === "shrine" ? " | F: Shrine" : "";
  const npcHint = roomType === "npc_room" ? " | T: Talk" : "";
  const storeHint = roomType === "store" ? " | B: Shop" : "";
  const exploringHints = `WASD/Arrows: Move | X: Search${restHint}${shrineHint}${npcHint}${storeHint} | I: Inventory | C: Character | P: Party | L: Codex | N: News | ~: About | Q: Exit | ?: Help`;
  const combatHints = "1: Attack | 2: Defend | 3: Cast | 4: Flee | 5: Use Item | Esc: Back";

  return (
    <div className="hidden md:block font-mono text-[10px] text-terminal-border-bright tracking-wide">
      {screen === "combat" ? combatHints : exploringHints}
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────

export default function PlayCharacterPage() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.characterId as string;

  const {
    player,
    currentRoom,
    mapViewport,
    combatState,
    gameLog,
    screen,
    activeStore,
    activeNPC,
    navigationLayer,
    navigationNames,
    addToGameLog,
    setScreen,
    setActiveStore,
    setActiveNPC,
    setPlayer,
    setCurrentRoom,
    setMapViewport,
    setCombatState,
    setNavigationLayer,
    setNavigationNames,
  } = useGameStore();

  // Ref to avoid stale player in keyboard handlers
  const playerRef = useRef(player);
  playerRef.current = player;

  // ── Victory / Death / LevelUp overlay state ──
  const [victoryData, setVictoryData] = useState<{
    xp: number;
    gold: number;
    items: GameItem[];
  } | null>(null);
  const [deathData, setDeathData] = useState<{ goldLost: number } | null>(null);
  const [pendingAdventurer, setPendingAdventurer] = useState<import("@/lib/types").Companion | null>(null);
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: number;
    hpGained: number;
    statIncreased: string;
    statValue: number;
    newAbilities: string[];
  } | null>(null);

  // ── World navigation state ──
  const [currentRegionId, setCurrentRegionId] = useState<string | null>(null);
  const [currentBuildingId, setCurrentBuildingId] = useState<string | null>(null);

  // ── Layer transition animation ──
  const [layerTransitionClass, setLayerTransitionClass] = useState("");
  const prevLayerRef = useRef<{ layer: NavigationLayer; screen: string }>({ layer: "area", screen: "exploring" });
  const prevFloorRef = useRef<number | undefined>(undefined);

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

  // ── World navigation queries ──
  const isWorldCharacterEarly = !!characterQuery.data?.worldId;

  const worldMapQuery = trpc.game.getWorldMap.useQuery(
    { characterId },
    { enabled: isWorldCharacterEarly }
  );

  const regionMapQuery = trpc.game.getRegionMap.useQuery(
    { characterId, regionId: currentRegionId! },
    { enabled: screen === "region_map" && !!currentRegionId }
  );

  // ── Nearby players (shared world only, 30s refresh) ──
  const nearbyPlayersQuery = trpc.game.getNearbyPlayers.useQuery(
    { characterId },
    {
      enabled: isWorldCharacterEarly && screen === "exploring",
      refetchInterval: 30000,
    }
  );
  const nearbyPlayerPositions = useMemo(
    () => nearbyPlayersQuery.data?.players.map((p) => p.position) ?? [],
    [nearbyPlayersQuery.data]
  );

  // ── Populate navigation names on initial world map load ──
  const navNamesInitialized = useRef(false);
  useEffect(() => {
    if (navNamesInitialized.current) return;
    if (!worldMapQuery.data || !isWorldCharacterEarly) return;
    navNamesInitialized.current = true;
    const worldName = worldMapQuery.data.world.name;
    const firstRegion = worldMapQuery.data.regions.find((r) => r.discovered);
    setNavigationNames({ worldName, regionName: firstRegion?.name });
    if (firstRegion) {
      setCurrentRegionId(firstRegion.id);
    }
  }, [worldMapQuery.data, isWorldCharacterEarly, setNavigationNames]);

  // ── World navigation mutations ──
  const travelToRegionMutation = trpc.game.travelToRegion.useMutation({
    onSuccess(data) {
      setCurrentRegionId(data.region.id);
      setNavigationNames({ regionName: data.region.name });
      setNavigationLayer("region");
      setScreen("region_map");
      addToGameLog(`You travel to ${data.region.name}.`);
    },
    onError(err) {
      addToGameLog(`Cannot travel: ${err.message}`);
    },
  });

  const travelToAreaMutation = trpc.game.travelToArea.useMutation({
    onSuccess(data) {
      setNavigationNames({ areaName: data.area.name, buildingName: undefined, floor: undefined });
      setNavigationLayer("area");
      setScreen("exploring");
      addToGameLog(`You arrive at ${data.area.name}.`);
      // Refetch map for new position
      mapQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Cannot travel: ${err.message}`);
    },
  });

  const enterBuildingMutation = trpc.game.enterBuilding.useMutation({
    onSuccess(data) {
      setCurrentBuildingId(data.building.id);
      setNavigationNames({ buildingName: data.building.name, floor: data.floor });
      setNavigationLayer("building");
      setScreen("exploring");
      addToGameLog(`You enter ${data.building.name}.`);
      mapQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Cannot enter: ${err.message}`);
    },
  });

  const exitBuildingMutation = trpc.game.exitBuilding.useMutation({
    onSuccess() {
      setCurrentBuildingId(null);
      setNavigationNames({ buildingName: undefined, floor: undefined });
      setNavigationLayer("area");
      setScreen("exploring");
      addToGameLog("You exit the building.");
      mapQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Cannot exit: ${err.message}`);
    },
  });

  const changeFloorMutation = trpc.game.changeFloor.useMutation({
    onSuccess(data) {
      setNavigationNames({ floor: data.floor });
      addToGameLog(`You move to floor ${data.floor + 1} of ${data.buildingName}.`);
      mapQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Cannot change floor: ${err.message}`);
    },
  });

  // ── Mutations ──

  const loreAddMutation = trpc.lore.add.useMutation();

  const moveMutation = trpc.game.move.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      setCurrentRoom(data.room);
      setMapViewport(data.mapViewport);
      addToGameLog(`You enter ${data.room.name}.`);

      // Auto-discover room lore
      if (data.room.description) {
        loreAddMutation.mutate({
          characterId,
          title: data.room.name,
          content: data.room.description,
          source: "room",
          sourceId: data.room.id,
        });
      }

      if (data.enterCombat && data.encounter) {
        addToGameLog("Enemies block your path!");
        // Start combat — always full-screen, NOT in drawer
        setDrawerOpen(false);
        combatStartMutation.mutate({ characterId });
      } else if (data.room.type === "store") {
        addToGameLog("You see a merchant's stall.");
        // Auto-open drawer for interactive rooms (world characters)
        if (isWorldCharacter) setDrawerOpen(true);
      } else if (data.room.type === "npc_room") {
        addToGameLog("Someone is here...");
        if (isWorldCharacter) setDrawerOpen(true);
      } else if (data.room.type === "shrine") {
        if (isWorldCharacter) setDrawerOpen(true);
      } else {
        // Close drawer when entering non-interactive rooms
        setDrawerOpen(false);
      }
    },
    onError(err) {
      addToGameLog(`Cannot move: ${err.message}`);
    },
  });

  const restMutation = trpc.game.rest.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      addToGameLog(data.message);
    },
    onError(err) {
      addToGameLog(`Cannot rest: ${err.message}`);
    },
  });

  const shrineMutation = trpc.game.shrine.useMutation({
    onSuccess(data) {
      if (data.player) {
        setPlayer(data.player);
      }
      addToGameLog(data.message);
    },
    onError(err) {
      addToGameLog(`Shrine interaction failed: ${err.message}`);
    },
  });

  const searchMutation = trpc.game.searchRoom.useMutation({
    onSuccess(data) {
      addToGameLog(data.message);
      if (data.success && "items" in data && data.items) {
        characterQuery.refetch();
        // Discover search lore
        const itemNames = (data.items as { name: string }[]).map((i) => i.name).join(", ");
        if (itemNames) {
          loreAddMutation.mutate({
            characterId,
            title: `Found: ${itemNames}`,
            content: data.message,
            source: "search",
          });
        }
      }
    },
    onError(err) {
      addToGameLog(`Search failed: ${err.message}`);
    },
  });

  // ── Combat Mutations ──

  const combatStartMutation = trpc.combat.start.useMutation({
    onSuccess(data) {
      if (!data) return;

      // Check if combat ended during monster auto-resolution (e.g. player died before first turn)
      if ("combatOver" in data && data.combatOver) {
        const result = data as { combatOver: true; victory: boolean; player: Player; log: unknown[]; goldLost?: number };
        setPlayer(result.player);
        setCombatState(null);

        if (!result.victory) {
          setDeathData({ goldLost: result.goldLost ?? 0 });
          setScreen("death");
          addToGameLog("You were slain before you could act...");
        }
        return;
      }

      // Ongoing combat — extract state and player
      const result = data as { combatOver: false; state: CombatState; player: Player; log: unknown[] };
      setCombatState(result.state);
      setPlayer(result.player);
      setScreen("combat");
      addToGameLog("Combat begins!");
    },
    onError(err) {
      addToGameLog(`Combat failed to start: ${err.message}`);
    },
  });

  const combatActionMutation = trpc.combat.action.useMutation({
    onSuccess(data) {
      if (data.combatOver) {
        // Capture monster names before clearing state
        const defeatedMonsters = combatState?.monsters.map((m) => m.name) ?? [];

        // Combat is over
        setCombatState(null);
        setPlayer(data.player);

        if (data.victory) {
          // Show victory screen
          const rewards = "rewards" in data ? data.rewards : undefined;
          setVictoryData({
            xp: rewards?.xp ?? 0,
            gold: rewards?.gold ?? 0,
            items: rewards?.items ?? [],
          });

          // Check for level up
          const levelUp = "levelUp" in data ? data.levelUp : undefined;
          if (levelUp) {
            setLevelUpData({
              newLevel: levelUp.newLevel,
              hpGained: levelUp.hpGained,
              statIncreased: levelUp.statIncreased,
              statValue: 0, // We don't have old stat value; the modal handles it
              newAbilities: levelUp.newAbilities,
            });
          }

          addToGameLog("Victory! The enemies are defeated.");

          // Discover combat lore
          const monsterNames = defeatedMonsters.length > 0
            ? [...new Set(defeatedMonsters)].join(", ")
            : "unknown foes";
          loreAddMutation.mutate({
            characterId,
            title: `Battle: ${monsterNames}`,
            content: `Defeated ${monsterNames}. Earned ${rewards?.xp ?? 0} XP and ${rewards?.gold ?? 0} gold.`,
            source: "combat",
          });
        } else if ("fled" in data && data.fled) {
          // Fled — transition to new room
          const newRoom = "newRoom" in data ? data.newRoom as import("@/lib/types").Room : null;
          const viewport = "mapViewport" in data ? data.mapViewport as import("@/lib/types").MapViewport : null;

          if (newRoom) {
            setCurrentRoom(newRoom);
            addToGameLog(`You flee into ${newRoom.name}.`);
          }
          if (viewport) {
            setMapViewport(viewport);
          }

          if ("chased" in data && data.chased) {
            // Chased — monsters followed into the new room
            // Brief exploring state so player sees the room transition
            setScreen("exploring");
            addToGameLog("They're right behind you!");
            setTimeout(() => {
              combatStartMutation.mutate({ characterId });
            }, 1200);
          } else {
            // Clean escape
            addToGameLog("You lost them!");
            setScreen("exploring");

            // Check for adventurer encounter
            if ("adventurerMet" in data && data.adventurerMet) {
              const adventurer = data.adventurerMet as import("@/lib/types").Companion;
              setPendingAdventurer(adventurer);
              addToGameLog(`You encounter ${adventurer.name}! They offer to fight alongside you.`);
            }

            // Check for new encounter in the room we fled to
            if ("newEncounter" in data && data.newEncounter) {
              setTimeout(() => {
                addToGameLog("But something else lurks here...");
                combatStartMutation.mutate({ characterId });
              }, 1500);
            }
          }
        } else {
          // Player died
          const goldLost = "goldLost" in data ? (data.goldLost as number) : 0;
          setDeathData({ goldLost });
          setScreen("death");
          addToGameLog("You have been defeated...");
        }
      } else {
        // Combat continues
        if ("state" in data && data.state) {
          setCombatState(data.state as CombatState);
        }
        setPlayer(data.player);
      }
    },
    onError(err) {
      addToGameLog(`Combat action failed: ${err.message}`);
      // Re-start combat to refetch state and unstick the UI
      combatStartMutation.mutate({ characterId });
    },
  });

  const combatRespawnMutation = trpc.combat.respawn.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      setCurrentRoom(data.room);
      setDeathData(null);
      setCombatState(null);
      setScreen("exploring");
      addToGameLog(`You respawn at ${data.room.name}. Lost ${data.goldLost} gold.`);
      // Refetch map for new position
      mapQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Respawn failed: ${err.message}`);
    },
  });

  // ── Companion mutations ──
  const partyUpMutation = trpc.combat.partyUp.useMutation({
    onSuccess(data) {
      if (data.companion && player) {
        setPlayer({ ...player, companion: data.companion });
        addToGameLog(`${data.companion.name} joins your party!`);
      }
      setPendingAdventurer(null);
    },
    onError(err) {
      addToGameLog(`Failed to party up: ${err.message}`);
      setPendingAdventurer(null);
    },
  });

  const dismissCompanionMutation = trpc.combat.dismissCompanion.useMutation({
    onSuccess() {
      if (player) {
        setPlayer({ ...player, companion: null });
      }
      addToGameLog("Your companion parts ways with you.");
    },
    onError(err) {
      addToGameLog(`Failed to dismiss companion: ${err.message}`);
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

  // ── Combat action handler ──
  const handleCombatAction = useCallback(
    (action: CombatAction, targetIndex?: number, itemId?: string) => {
      combatActionMutation.mutate({
        characterId,
        action,
        targetIndex,
        itemId,
      });
    },
    [combatActionMutation, characterId]
  );

  // ── Respawn handler ──
  const handleRespawn = useCallback(() => {
    combatRespawnMutation.mutate({ characterId });
  }, [combatRespawnMutation, characterId]);

  // ── NPC node tracking (must be before handleAction) ──
  const [npcNodeId, setNpcNodeId] = useState<string | undefined>(undefined);

  // ── Victory continue handler ──
  const handleVictoryContinue = useCallback(() => {
    setVictoryData(null);
    setScreen("exploring");
    characterQuery.refetch();
    mapQuery.refetch();
  }, [setScreen, characterQuery, mapQuery]);

  // ── Level up dismiss handler ──
  const handleLevelUpClose = useCallback(() => {
    setLevelUpData(null);
    setScreen("exploring");
    characterQuery.refetch();
  }, [setScreen, characterQuery]);

  // ── Action handler (exploring) ──
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
        case "rest": {
          const RESTABLE = ["safe_room", "shrine", "npc_room"];
          if (currentRoom && RESTABLE.includes(currentRoom.type)) {
            addToGameLog("You take a moment to rest...");
            restMutation.mutate({ characterId });
          } else {
            addToGameLog("You cannot rest here. Find a safe room or shrine.");
          }
          break;
        }
        case "interact_shrine":
          if (currentRoom?.type === "shrine") {
            addToGameLog("You approach the shrine...");
            shrineMutation.mutate({ characterId });
          } else {
            addToGameLog("There is no shrine here.");
          }
          break;
        case "talk":
          if (currentRoom?.type === "npc_room") {
            addToGameLog("You approach to speak...");
            setNpcNodeId(undefined); // start from root
            setScreen("npc");
          } else {
            addToGameLog("There is no one to talk to here.");
          }
          break;
        case "shop":
          if (currentRoom?.type === "store") {
            addToGameLog("You browse the wares...");
            setScreen("store");
          } else {
            addToGameLog("There is no store here.");
          }
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
        case "lore":
          setScreen("lore");
          break;
        case "party":
          setScreen("party");
          break;
        case "news":
          setScreen("news");
          break;
        case "about":
          setScreen("about");
          break;
        case "world_map":
          setScreen("world_map");
          setNavigationLayer("world");
          break;
        case "exit":
          router.push("/characters");
          break;
        case "dismiss_companion":
          if (playerRef.current?.companion) {
            dismissCompanionMutation.mutate({ characterId });
          } else {
            addToGameLog("You have no companion to dismiss.");
          }
          break;
        default:
          addToGameLog(`Unknown action: ${action}`);
      }
    },
    [addToGameLog, setScreen, setNavigationLayer, moveMutation, searchMutation, restMutation, shrineMutation, dismissCompanionMutation, characterId, currentRoom, setNpcNodeId]
  );

  // ── DPad handlers ──
  const handleDPadMove = useCallback(
    (direction: Direction) => {
      handleAction(`move_${direction}`);
    },
    [handleAction]
  );

  const handleDPadSearch = useCallback(() => {
    handleAction("search");
  }, [handleAction]);

  // ── Global keyboard listener (window capture phase) ──
  // Uses window + capture phase — the most aggressive listener possible.
  // This fires BEFORE any element-level handlers and regardless of focus.
  // Uses refs to avoid stale closures with the empty deps useEffect.
  const screenRef = useRef(screen);
  const handleActionRef = useRef(handleAction);
  const handleRespawnRef = useRef(handleRespawn);
  screenRef.current = screen;
  handleActionRef.current = handleAction;
  handleRespawnRef.current = handleRespawn;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;
      if (e.ctrlKey || e.altKey) return;
      if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") return;

      const currentScreen = screenRef.current;

      if (currentScreen === "exploring") {
        const action = EXPLORING_KEY_MAP[e.key];
        if (action) {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleActionRef.current(action);
          return;
        }
      }

      if (currentScreen === "death") {
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleRespawnRef.current();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // ── Store mutations ──
  const storeBuyMutation = trpc.store.buy.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      setActiveStore(data.store);
      addToGameLog("Purchase complete!");
      characterQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Purchase failed: ${err.message}`);
    },
  });

  const storeSellMutation = trpc.store.sell.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      addToGameLog(`Sold ${data.soldItem} for ${data.goldReceived}g.`);
      characterQuery.refetch();
      storeQuery.refetch();
      inventoryQuery.refetch();
    },
    onError(err) {
      addToGameLog(`Sale failed: ${err.message}`);
    },
  });

  // ── Store query (lazy — only when screen is store) ──
  const storeQuery = trpc.store.getInventory.useQuery(
    { characterId },
    {
      enabled: screen === "store",
      refetchOnWindowFocus: false,
    }
  );

  // Sync store data into game store when query resolves
  useEffect(() => {
    if (storeQuery.data) {
      setActiveStore(storeQuery.data.store);
    }
  }, [storeQuery.data, setActiveStore]);

  // ── Inventory query (lazy — only when screen is inventory) ──
  const inventoryQuery = trpc.inventory.list.useQuery(
    { characterId },
    {
      enabled: screen === "inventory" || screen === "store",
      refetchOnWindowFocus: false,
    }
  );

  // ── NPC query (lazy — only when screen is npc) ──
  const npcQuery = trpc.npc.talk.useQuery(
    { characterId, nodeId: npcNodeId },
    {
      enabled: screen === "npc",
      refetchOnWindowFocus: false,
    }
  );

  // Sync NPC data into game store when query resolves + discover lore
  const lastNpcLoreId = useRef<string | null>(null);
  useEffect(() => {
    if (npcQuery.data) {
      setActiveNPC(npcQuery.data.npc);
      // Auto-discover NPC lore from root dialogue (once per NPC)
      const npc = npcQuery.data.npc;
      if (npc.id !== lastNpcLoreId.current) {
        lastNpcLoreId.current = npc.id;
        const rootNode = npc.dialogue["root"];
        if (rootNode?.text) {
          loreAddMutation.mutate({
            characterId,
            title: `${npc.name}'s words`,
            content: rootNode.text,
            source: "npc",
            sourceId: npc.id,
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcQuery.data, setActiveNPC, characterId]);

  // ── Store handlers ──
  const handleBuy = useCallback(
    (instanceId: string) => {
      if (!activeStore) return;
      // The StorePanel passes item.id (instance ID), but the server
      // matches on item.itemId (template/catalog ID). Look it up.
      const allItems = [
        ...activeStore.localInventory,
        ...activeStore.marketplaceInventory,
      ];
      const match = allItems.find((si) => si.item.id === instanceId);
      const itemId = match?.item.itemId ?? instanceId;
      storeBuyMutation.mutate({
        characterId,
        itemId,
        storeId: activeStore.id,
      });
    },
    [activeStore, storeBuyMutation, characterId]
  );

  const handleSell = useCallback(
    (itemId: string) => {
      storeSellMutation.mutate({
        characterId,
        itemId,
      });
    },
    [storeSellMutation, characterId]
  );

  // ── NPC handlers ──
  const handleNPCChoice = useCallback(
    (choiceIndex: number) => {
      if (!activeNPC) return;
      const node = activeNPC.dialogue[activeNPC.currentNode];
      if (!node) return;
      const choice = node.choices[choiceIndex];
      if (!choice) return;

      if (choice.nextId === null) {
        // End of conversation
        addToGameLog(`You finish talking to ${activeNPC.name}.`);
        closeOverlay();
        return;
      }

      // Advance dialogue client-side
      setActiveNPC({
        ...activeNPC,
        currentNode: choice.nextId,
      });
    },
    [activeNPC, setActiveNPC, addToGameLog, closeOverlay]
  );

  // ── Inventory mutations ──
  const equipMutation = trpc.inventory.equip.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      addToGameLog("Item equipped.");
      inventoryQuery.refetch();
    },
    onError(err) { addToGameLog(`Equip failed: ${err.message}`); },
  });

  const unequipMutation = trpc.inventory.unequip.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      addToGameLog("Item unequipped.");
      inventoryQuery.refetch();
    },
    onError(err) { addToGameLog(`Unequip failed: ${err.message}`); },
  });

  const useItemMutation = trpc.inventory.useItem.useMutation({
    onSuccess(data) {
      setPlayer(data.player);
      addToGameLog(data.message);
      inventoryQuery.refetch();
    },
    onError(err) { addToGameLog(`Use failed: ${err.message}`); },
  });

  const dropMutation = trpc.inventory.drop.useMutation({
    onSuccess(data) {
      addToGameLog(`Dropped ${data.droppedItem}.`);
      inventoryQuery.refetch();
    },
    onError(err) { addToGameLog(`Drop failed: ${err.message}`); },
  });

  const handleEquip = useCallback(
    (itemId: string) => { equipMutation.mutate({ characterId, itemId }); },
    [equipMutation, characterId]
  );

  const handleUnequip = useCallback(
    (itemId: string) => { unequipMutation.mutate({ characterId, itemId }); },
    [unequipMutation, characterId]
  );

  const handleUseItem = useCallback(
    (itemId: string) => { useItemMutation.mutate({ characterId, itemId }); },
    [useItemMutation, characterId]
  );

  const handleDrop = useCallback(
    (itemId: string) => { dropMutation.mutate({ characterId, itemId }); },
    [dropMutation, characterId]
  );

  // ── Room detail drawer (for world characters) ──
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Help modal ──
  const [showHelp, setShowHelp] = useState(false);

  // Backup keyboard handler on root div — some browsers/frameworks
  // swallow document-level keydown events
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Re-focus root div on screen change so keyboard shortcuts work.
    // Also runs when player loads (initial data fetch), ensuring focus is
    // set after the loading skeleton is replaced by the actual game UI.
    // Use requestAnimationFrame to ensure focus happens after modal unmount
    // completes and the DOM is fully settled.
    const raf = requestAnimationFrame(() => {
      rootRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [screen, player]);

  // Re-focus root div when user clicks anywhere inside it. Prevents focus
  // from getting "stuck" on a button after a click, which can cause some
  // browsers to suppress document-level keyboard events.
  const handleRootClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't steal focus from inputs/textareas
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }
    // After any click, schedule root focus so WASD shortcuts always work.
    // The timeout lets the click's own focus changes settle first.
    setTimeout(() => rootRef.current?.focus(), 0);
  }, []);

  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.ctrlKey || e.altKey) return;
      if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") return;

      // ── Escape: close drawer or go back one layer ──
      if (e.key === "Escape") {
        e.preventDefault();
        if (drawerOpen) {
          setDrawerOpen(false);
        } else if (isWorldCharacterEarly) {
          if (navigationLayer === "building") {
            setNavigationLayer("area");
            setScreen("exploring");
          } else if (navigationLayer === "area") {
            setNavigationLayer("region");
            setScreen("region_map");
          } else if (navigationLayer === "region") {
            setNavigationLayer("world");
            setScreen("world_map");
          }
        }
        return;
      }

      // ── M: toggle world map (world characters only) ──
      if ((e.key === "m" || e.key === "M") && isWorldCharacterEarly && screen !== "combat") {
        e.preventDefault();
        if (screen === "world_map") {
          setScreen("exploring");
          setNavigationLayer("area");
        } else {
          setScreen("world_map");
          setNavigationLayer("world");
        }
        return;
      }

      // ── Exploring keys (backup for window capture listener) ──
      if (screen === "exploring") {
        const action = EXPLORING_KEY_MAP[e.key];
        if (action) {
          e.preventDefault();
          handleAction(action);
          return;
        }
      }

      // ── Death screen ──
      if (screen === "death") {
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          handleRespawn();
        }
      }
    },
    [screen, handleAction, handleRespawn, drawerOpen, isWorldCharacterEarly, navigationLayer, setDrawerOpen, setNavigationLayer, setScreen]
  );

  // Determine if character uses new world system (derived before hooks that need it)
  const isWorldCharacter = !!player?.worldId;
  const legacyMapEnabled = process.env.NEXT_PUBLIC_LEGACY_MAP_ENABLED !== "false";

  // Build TileMapData from mapViewport for new-system characters
  const isInBuilding = navigationLayer === "building";
  const tileMapData = useMemo<TileMapData | null>(() => {
    if (!isWorldCharacter || !mapViewport || !player) return null;
    const cells = mapViewport.cells;
    const height = cells.length;
    const width = cells[0]?.length ?? 0;
    if (width === 0 || height === 0) return null;

    const tiles: TileData[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TileData[] = [];
      for (let x = 0; x < width; x++) {
        const cell = cells[y]![x]!;
        if (cell.room) {
          const visibility = cell.isCurrent
            ? "visible" as const
            : cell.room.visited
              ? "discovered" as const
              : "hidden" as const;
          row.push(
            buildTileFromRoom(
              cell.room,
              player.position,
              visibility,
              isInBuilding,
              nearbyPlayerPositions
            )
          );
        } else {
          row.push({
            x: cell.x,
            y: cell.y,
            spriteId: isInBuilding ? "terrain_wall" : "terrain_stone",
            walkable: false,
            visibility: "hidden" as const,
            markers: [],
          });
        }
      }
      tiles.push(row);
    }
    return { width, height, tiles };
  }, [isWorldCharacter, mapViewport, player, isInBuilding, nearbyPlayerPositions]);

  // ── Navigation loading state ──
  const navLoadingMessage = useMemo(() => {
    if (travelToRegionMutation.isPending) return `Traveling to ${navigationNames.regionName ?? "region"}...`;
    if (travelToAreaMutation.isPending) return `Exploring ${navigationNames.areaName ?? "area"}...`;
    if (enterBuildingMutation.isPending) return `Entering ${navigationNames.buildingName ?? "building"}...`;
    if (exitBuildingMutation.isPending) return "Exiting building...";
    if (changeFloorMutation.isPending) return `Moving to floor ${(navigationNames.floor ?? 0) + 1}...`;
    if (worldMapQuery.isFetching && !worldMapQuery.data) return "Loading world map...";
    if (regionMapQuery.isFetching && !regionMapQuery.data) return "Loading region map...";
    return null;
  }, [
    travelToRegionMutation.isPending,
    travelToAreaMutation.isPending,
    enterBuildingMutation.isPending,
    exitBuildingMutation.isPending,
    changeFloorMutation.isPending,
    worldMapQuery.isFetching,
    worldMapQuery.data,
    regionMapQuery.isFetching,
    regionMapQuery.data,
    navigationNames,
  ]);

  // Breadcrumb segments (extracted from inline IIFE for clarity)
  const breadcrumbSegments = useMemo<BreadcrumbSegment[]>(() => {
    const segs: BreadcrumbSegment[] = [];
    segs.push({
      label: navigationNames.worldName ?? "World",
      onClick: navigationLayer !== "world"
        ? () => { setScreen("world_map"); setNavigationLayer("world"); }
        : undefined,
    });
    if (navigationNames.regionName && (navigationLayer === "region" || navigationLayer === "area" || navigationLayer === "building")) {
      segs.push({
        label: navigationNames.regionName,
        onClick: navigationLayer !== "region"
          ? () => { setScreen("region_map"); setNavigationLayer("region"); }
          : undefined,
      });
    }
    if (navigationNames.areaName && (navigationLayer === "area" || navigationLayer === "building")) {
      segs.push({
        label: navigationNames.areaName,
        onClick: navigationLayer !== "area"
          ? () => { setScreen("exploring"); setNavigationLayer("area"); }
          : undefined,
      });
    }
    if (navigationNames.buildingName && navigationLayer === "building") {
      segs.push({ label: navigationNames.buildingName });
      if (navigationNames.floor !== undefined) {
        segs.push({ label: `Floor ${navigationNames.floor + 1}` });
      }
    }
    return segs;
  }, [navigationNames, navigationLayer, setScreen, setNavigationLayer]);

  const breadcrumbOnBack = useMemo(() => {
    if (navigationLayer === "region") return () => { setScreen("world_map"); setNavigationLayer("world"); };
    if (navigationLayer === "area") return () => { setScreen("region_map"); setNavigationLayer("region"); };
    if (navigationLayer === "building") return () => { setScreen("exploring"); setNavigationLayer("area"); };
    return undefined;
  }, [navigationLayer, setScreen, setNavigationLayer]);

  // ── Compute layer transition animation class ──
  useEffect(() => {
    const prev = prevLayerRef.current;
    const prevFloor = prevFloorRef.current;
    const curFloor = navigationNames.floor;
    prevLayerRef.current = { layer: navigationLayer, screen };
    prevFloorRef.current = curFloor;

    // Floor change within same building
    if (prev.layer === "building" && navigationLayer === "building" && prevFloor !== undefined && curFloor !== undefined && prevFloor !== curFloor) {
      setLayerTransitionClass(curFloor > prevFloor ? "layer-enter-floor-down" : "layer-enter-floor-up");
      return;
    }

    // Skip if layer didn't change
    if (prev.layer === navigationLayer && prev.screen === screen) return;

    const LAYER_DEPTH: Record<string, number> = { world: 0, region: 1, area: 2, building: 3 };
    const prevDepth = LAYER_DEPTH[prev.layer] ?? 0;
    const curDepth = LAYER_DEPTH[navigationLayer] ?? 0;

    if (curDepth > prevDepth) {
      // Zooming in
      setLayerTransitionClass(navigationLayer === "building" ? "layer-enter-building" : "layer-enter-zoom-in");
    } else if (curDepth < prevDepth) {
      // Zooming out
      setLayerTransitionClass("layer-enter-zoom-out");
    } else {
      setLayerTransitionClass("layer-enter-building"); // same-level transition, simple fade
    }
  }, [navigationLayer, screen, navigationNames.floor]);

  // Clear animation class after animation ends
  const handleTransitionEnd = useCallback(() => {
    setLayerTransitionClass("");
  }, []);

  // TileMap click handler — translate tile click to directional move
  const handleTileMove = useCallback(
    (nx: number, ny: number) => {
      if (!player) return;
      const dx = nx - player.position.x;
      const dy = ny - player.position.y;
      let direction: Direction | null = null;
      if (dx === 1 && dy === 0) direction = "east";
      else if (dx === -1 && dy === 0) direction = "west";
      else if (dx === 0 && dy === -1) direction = "north";
      else if (dx === 0 && dy === 1) direction = "south";
      if (direction) {
        moveMutation.mutate({ characterId, direction });
      }
    },
    [player, moveMutation, characterId]
  );

  const handleTileClick = useCallback(
    (x: number, y: number, tile: TileData) => {
      if (!player) return;
      const isCurrentTile = x === player.position.x && y === player.position.y;

      // Click on building entrance → enterBuilding (must be on the tile)
      if (isCurrentTile && tile.markers.includes("entrance") && tile.buildingId) {
        enterBuildingMutation.mutate({ characterId, buildingId: tile.buildingId });
        return;
      }
      // Stairs up/down in building → changeFloor (must be on the tile)
      if (isCurrentTile && tile.markers.includes("stairs_up") && currentBuildingId) {
        changeFloorMutation.mutate({ characterId, direction: "up", currentFloor: navigationNames.floor ?? 0, buildingId: currentBuildingId });
        return;
      }
      if (isCurrentTile && tile.markers.includes("stairs_down") && currentBuildingId) {
        changeFloorMutation.mutate({ characterId, direction: "down", currentFloor: navigationNames.floor ?? 0, buildingId: currentBuildingId });
        return;
      }
      // Click on current tile → open room detail drawer
      if (isCurrentTile) {
        setDrawerOpen(true);
        return;
      }
      // Adjacent walkable tile → move
      const dx = x - player.position.x;
      const dy = y - player.position.y;
      if (Math.abs(dx) + Math.abs(dy) === 1 && tile.walkable && tile.visibility !== "hidden") {
        handleTileMove(x, y);
      }
    },
    [player, characterId, currentBuildingId, navigationNames.floor, enterBuildingMutation, changeFloorMutation, handleTileMove]
  );

  const showInventory = screen === "inventory";
  const showCharacter = screen === "character";
  const showStore = screen === "store";
  const showNPC = screen === "npc";
  const showLore = screen === "lore";
  const showParty = screen === "party";
  const showNews = screen === "news";
  const showAbout = screen === "about";
  const inCombat = screen === "combat";
  const isDead = screen === "death";

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

  // ── Loading / error states (after all hooks) ──
  if (characterQuery.isLoading || mapQuery.isLoading) {
    return (
      <div className="h-dvh w-dvw flex items-center justify-center">
        <TerminalLoading />
      </div>
    );
  }

  if (characterQuery.error) {
    return (
      <div className="h-dvh w-dvw flex items-center justify-center text-terminal-red font-mono">
        Failed to load character: {characterQuery.error.message}
      </div>
    );
  }

  if (!player || !currentRoom || !mapViewport) {
    return (
      <div className="h-dvh w-dvw flex items-center justify-center">
        <TerminalLoading />
      </div>
    );
  }

  // ── Shared overlay elements (used by both layouts) ──
  const overlayElements = (
    <>
      {/* ── Death Screen Overlay ── */}
      {isDead && deathData && (
        <DeathScreen goldLost={deathData.goldLost} onRespawn={handleRespawn} />
      )}

      {/* ── Victory Screen Overlay ── */}
      {victoryData && (
        <VictoryScreen
          xpGained={victoryData.xp}
          goldGained={victoryData.gold}
          loot={victoryData.items}
          onContinue={handleVictoryContinue}
        />
      )}

      {/* ── Level Up Modal ── */}
      {levelUpData && (
        <LevelUpModal
          open={true}
          onClose={handleLevelUpClose}
          levelData={levelUpData}
        />
      )}

      {/* ── Help Modal ── */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );

  // ── Modal wrappers (terminal for legacy, later pixel for world characters) ──
  const modalElements = (
    <>
      {/* ── Inventory Overlay ── */}
      <TerminalModal
        open={showInventory}
        onClose={closeOverlay}
        title="INVENTORY"
        className="max-w-2xl"
      >
        <InventoryPanel
          items={inventoryQuery.data ?? []}
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
          inventory={inventoryQuery.data ?? []}
          onBuy={handleBuy}
          onSell={handleSell}
          onClose={closeOverlay}
        />
      </TerminalModal>

      {/* ── NPC Dialog Overlay ── */}
      <TerminalModal
        open={showNPC}
        onClose={closeOverlay}
        title={npcData.name || "???"}
        className="max-w-lg"
      >
        {npcQuery.isLoading ? (
          <div className="font-mono text-sm space-y-4 p-2">
            <div className="text-terminal-amber-dim text-xs italic text-center animate-pulse">
              {(() => {
                const phrases = [
                  "A shadowy figure turns to face you...",
                  "Someone eyes you cautiously...",
                  "A stranger notices your approach...",
                  "Footsteps halt as you draw near...",
                  "A weary traveler looks up at you...",
                ];
                return phrases[Math.floor(Math.random() * phrases.length)];
              })()}
            </div>
            <div className="flex items-center justify-center gap-2 text-terminal-border-bright text-[10px]">
              <span className="inline-block w-3 h-3 border border-terminal-amber/50 border-t-terminal-amber rounded-full animate-spin" />
              <span>Preparing dialogue</span>
            </div>
          </div>
        ) : currentNPCNode ? (
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

      {/* ── Lore / Codex Modal ── */}
      <TerminalModal open={showLore} onClose={closeOverlay} title="Codex">
        <LorePanel characterId={characterId} onClose={closeOverlay} />
      </TerminalModal>

      {/* ── Party Panel ── */}
      <TerminalModal open={showParty} onClose={closeOverlay} title="PARTY" className="max-w-lg">
        <PartyPanel
          companion={player.companion ?? null}
          onKick={() => {
            dismissCompanionMutation.mutate({ characterId });
            closeOverlay();
          }}
          onClose={closeOverlay}
        />
      </TerminalModal>

      {/* ── News Panel ── */}
      <TerminalModal open={showNews} onClose={closeOverlay} title="NEWS">
        <NewsPanel onClose={closeOverlay} />
      </TerminalModal>

      {/* ── About Panel ── */}
      <TerminalModal open={showAbout} onClose={closeOverlay} title="ABOUT">
        <AboutPanel onClose={closeOverlay} />
      </TerminalModal>

      {/* ── Party Up Dialog ── */}
      <TerminalModal
        open={!!pendingAdventurer}
        onClose={() => setPendingAdventurer(null)}
        title="Adventurer Encountered"
      >
        {pendingAdventurer && (
          <div className="space-y-3 font-mono text-sm">
            <p className="text-terminal-blue font-bold">{pendingAdventurer.name}</p>
            <p className="text-terminal-green-dim text-xs">
              Level {pendingAdventurer.level} {pendingAdventurer.class} — {pendingAdventurer.personality}
            </p>
            <p className="text-terminal-green-dim text-xs">
              HP: {pendingAdventurer.hp}/{pendingAdventurer.hpMax} | AC: {pendingAdventurer.ac} | ATK: +{pendingAdventurer.attack} | DMG: {pendingAdventurer.damage}
            </p>
            <p className="text-terminal-amber text-xs mt-2">
              &quot;Hey, want to team up? These dungeons are no place to go alone.&quot;
            </p>
            <div className="flex gap-2 mt-3">
              <button
                className="px-3 py-1 border border-terminal-green text-terminal-green text-xs hover:bg-terminal-green/10"
                onClick={() => {
                  partyUpMutation.mutate({
                    characterId,
                    companion: pendingAdventurer,
                  });
                }}
              >
                [Y] Party Up
              </button>
              <button
                className="px-3 py-1 border border-terminal-border text-terminal-border-bright text-xs hover:bg-terminal-border/10"
                onClick={() => {
                  addToGameLog(`You decline ${pendingAdventurer.name}'s offer.`);
                  setPendingAdventurer(null);
                }}
              >
                [N] Decline
              </button>
            </div>
          </div>
        )}
      </TerminalModal>
    </>
  );

  // ── Root wrapper (shared by both layouts) ──
  const rootProps = {
    className: "h-dvh w-dvw overflow-hidden outline-none flex justify-center",
    tabIndex: -1 as const,
    ref: rootRef,
    onKeyDown: handleRootKeyDown,
    onClick: handleRootClick,
    autoFocus: true,
  };

  // ── PIXEL LAYOUT (world characters) ──
  if (isWorldCharacter) {
    return (
      // eslint-disable-next-line jsx-a11y/no-autofocus
      <div {...rootProps}>
      <div className="w-full max-w-[1400px] h-full bg-gray-950 flex flex-col">
        {/* Top: HudBar */}
        <HudBar
          hp={player.hp}
          maxHp={player.hpMax}
          mp={player.mp}
          maxMp={player.mpMax}
          gold={player.gold}
          level={player.level}
        />

        {/* Main content: stacked on mobile, side-by-side on md+ */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* ── Left panel: TileMap + Breadcrumb ── */}
          <div className="w-full md:w-[40%] shrink-0 flex flex-col items-center md:border-r border-b md:border-b-0 border-gray-700">
            <div className={cn("overflow-hidden w-full flex-1", inCombat ? "max-h-[20dvh]" : "max-h-[60dvh]", "md:max-h-none", screen === "exploring" && layerTransitionClass)} onAnimationEnd={handleTransitionEnd}>
              {tileMapData && player ? (
                <TileMap
                  mapData={tileMapData}
                  playerPosition={player.position}
                  viewportWidth={Math.min(tileMapData.width, 11)}
                  viewportHeight={Math.min(tileMapData.height, 9)}
                  tileSize={32}
                  onTileClick={handleTileClick}
                  onMove={handleTileMove}
                  keyboardEnabled={screen === "exploring" && !inCombat}
                />
              ) : null}
            </div>
            {/* Breadcrumb */}
            {navigationNames.worldName && (
              <Breadcrumb
                segments={breadcrumbSegments}
                onBack={breadcrumbOnBack}
                className="w-full"
              />
            )}
          </div>

          {/* ── Right panel: Game log + Actions / Combat / WorldMap / RegionMap ── */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
            {/* Navigation loading overlay */}
            {navLoadingMessage && (
              <div className="absolute inset-0 z-30 bg-gray-950/80 flex items-center justify-center">
                <div className="text-gray-400 font-mono text-sm animate-pulse">{navLoadingMessage}</div>
              </div>
            )}
            {screen === "world_map" && worldMapQuery.data ? (
              <div className={cn("flex-1 min-h-0 overflow-hidden", layerTransitionClass)} onAnimationEnd={handleTransitionEnd}>
                <WorldMapView
                  regions={worldMapQuery.data.regions}
                  currentRegionId={currentRegionId ?? undefined}
                  onSelectRegion={(regionId) => {
                    travelToRegionMutation.mutate({ characterId, regionId });
                  }}
                />
              </div>
            ) : screen === "region_map" && regionMapQuery.data ? (
              <div className={cn("flex-1 min-h-0 overflow-hidden", layerTransitionClass)} onAnimationEnd={handleTransitionEnd}>
                <RegionMapView
                  regionName={regionMapQuery.data.region.name}
                  areas={regionMapQuery.data.areas}
                  currentAreaId={undefined}
                  onSelectArea={(areaId) => {
                    travelToAreaMutation.mutate({ characterId, areaId });
                  }}
                  onBack={() => {
                    setScreen("world_map");
                    setNavigationLayer("world");
                  }}
                />
              </div>
            ) : inCombat && combatState ? (
              <CombatPanel
                combatState={combatState}
                player={player}
                onAction={handleCombatAction}
                className="flex-1 min-h-0"
              />
            ) : (
              <>
                {/* Room info + game log */}
                <div className={cn("flex-1 min-h-0 overflow-hidden", layerTransitionClass)} onAnimationEnd={handleTransitionEnd}>
                  <TextPanel
                    room={currentRoom}
                    gameLog={gameLog}
                    isLoading={moveMutation.isPending}
                  />
                </div>

                {/* Action buttons */}
                <div className="shrink-0 pt-3 border-t border-gray-700 mt-2">
                  <ExploringActions onAction={handleAction} roomType={currentRoom?.type} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Overlays and modals */}
        {overlayElements}
        {modalElements}

        {/* Room Detail Drawer */}
        <RoomDetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          room={currentRoom}
          onAction={(action) => {
            handleAction(action);
            if (["talk", "shop"].includes(action)) {
              setDrawerOpen(false);
            }
          }}
        />
      </div>
      </div>
    );
  }

  // ── TERMINAL LAYOUT (legacy characters) ──
  return (
    <div
      className="h-dvh w-dvw overflow-hidden outline-none flex justify-center"
      tabIndex={-1}
      ref={rootRef}
      onKeyDown={handleRootKeyDown}
      onClick={handleRootClick}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
    >
    <div className="w-full max-w-[1400px] h-full">
      <TerminalHUD
        className="h-full"
        topBar={<StatusBar player={player} />}
        bottomBar={<KeyHintsBar screen={screen} roomType={currentRoom?.type} />}
      >
        {/* Main content: stacked on mobile, side-by-side on md+ */}
        <div className="flex flex-col md:flex-row h-full min-h-0 gap-2 md:gap-4">
          {/* ── Left panel (35%): Map + DPad ── */}
          <div className="w-full md:w-[35%] shrink-0 md:shrink flex flex-col md:flex-col items-center justify-center md:justify-start md:border-r border-b md:border-b-0 border-terminal-border pb-1 md:pb-0 md:pr-4 gap-1 md:gap-4">
            <div className="hidden md:block text-terminal-green-dim text-[10px] uppercase tracking-wider">
              Dungeon Map
            </div>
            <div className={cn("overflow-hidden w-full", inCombat ? "max-h-[20dvh]" : "max-h-[40dvh]", "md:max-h-none")}>
              {!legacyMapEnabled ? (
                <div className="flex items-center justify-center h-full p-4 text-center text-amber-400">
                  <div>
                    <p className="font-bold mb-2">Character Migration Needed</p>
                    <p className="text-sm text-zinc-400">
                      This character needs to be migrated to the shared world.
                      Contact an administrator to run the migration.
                    </p>
                  </div>
                </div>
              ) : (
                <Map viewport={mapViewport} />
              )}
            </div>
            {/* Legacy DPad */}
            {!inCombat && legacyMapEnabled && (
              <DPad
                onMove={handleDPadMove}
                onSearch={handleDPadSearch}
                disabled={moveMutation.isPending || searchMutation.isPending}
                availableExits={currentRoom?.exits ?? []}
              />
            )}
          </div>

          {/* ── Right panel (65%): Text + Actions/Combat ── */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
            {screen === "world_map" && worldMapQuery.data ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <WorldMapView
                  regions={worldMapQuery.data.regions}
                  currentRegionId={currentRegionId ?? undefined}
                  onSelectRegion={(regionId) => {
                    travelToRegionMutation.mutate({ characterId, regionId });
                  }}
                />
              </div>
            ) : screen === "region_map" && regionMapQuery.data ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <RegionMapView
                  regionName={regionMapQuery.data.region.name}
                  areas={regionMapQuery.data.areas}
                  currentAreaId={undefined}
                  onSelectArea={(areaId) => {
                    travelToAreaMutation.mutate({ characterId, areaId });
                  }}
                  onBack={() => {
                    setScreen("world_map");
                    setNavigationLayer("world");
                  }}
                />
              </div>
            ) : inCombat && combatState ? (
              <CombatPanel
                combatState={combatState}
                player={player}
                onAction={handleCombatAction}
                className="flex-1 min-h-0"
              />
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <TextPanel
                    room={currentRoom}
                    gameLog={gameLog}
                    isLoading={moveMutation.isPending}
                  />
                </div>
                <div className="shrink-0 pt-3 border-t border-terminal-border mt-2">
                  <ExploringActions onAction={handleAction} roomType={currentRoom?.type} />
                </div>
              </>
            )}
          </div>
        </div>
      </TerminalHUD>

      {/* Overlays and modals */}
      {overlayElements}
      {modalElements}

      {/* ── Room Detail Drawer (world characters — shouldn't render for legacy, but kept for safety) ── */}
      {isWorldCharacter && (
        <RoomDetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          room={currentRoom}
          onAction={(action) => {
            handleAction(action);
            if (["talk", "shop"].includes(action)) {
              setDrawerOpen(false);
            }
          }}
        />
      )}
    </div>
    </div>
  );
}
