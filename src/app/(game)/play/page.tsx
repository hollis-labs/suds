"use client";

import { useCallback } from "react";
import { TerminalHUD } from "@/components/terminal";
import { StatusBar, ActionBar, Map, TextPanel } from "@/components/game";
import { useGameStore } from "@/stores/gameStore";
import {
  mockPlayer,
  mockRoom,
  mockMapViewport,
  mockGameLog,
} from "@/lib/mockData";

// TODO: Wire up tRPC calls when ready
// import { trpc } from "@/lib/trpc";

export default function PlayPage() {
  const {
    player,
    currentRoom,
    mapViewport,
    gameLog,
    screen,
    addToGameLog,
    setScreen,
  } = useGameStore();

  // Use mock data until tRPC is wired up
  const activePlayer = player ?? mockPlayer;
  const activeRoom = currentRoom ?? mockRoom;
  const activeMap = mapViewport ?? mockMapViewport;
  const activeLog = gameLog.length > 0 ? gameLog : mockGameLog;

  // TODO: Replace with actual tRPC mutations
  // const moveMutation = trpc.game.move.useMutation();
  // const getMapQuery = trpc.game.getMap.useQuery();

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
          addToGameLog(
            "WASD/Arrows: Move | X: Search | I: Inventory | C: Character"
          );
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
        {/* Main content: Map (left) | TextPanel (right) */}
        <div className="flex h-full gap-4">
          {/* Map panel — ~35% width */}
          <div className="w-[35%] shrink-0 flex flex-col items-center justify-center border-r border-terminal-border pr-4">
            <div className="text-terminal-green-dim text-[10px] uppercase tracking-wider mb-2">
              Dungeon Map
            </div>
            <Map viewport={activeMap} />
          </div>

          {/* Text panel — ~65% width */}
          <div className="flex-1 min-w-0">
            <TextPanel room={activeRoom} gameLog={activeLog} />
          </div>
        </div>
      </TerminalHUD>
    </div>
  );
}
