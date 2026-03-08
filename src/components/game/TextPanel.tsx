"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TerminalText } from "@/components/terminal";
import type { Room } from "@/lib/types";

interface TextPanelProps {
  room: Room | null;
  gameLog: string[];
  isLoading?: boolean;
  isPixelMode?: boolean;
  className?: string;
}

// Flavor text shown while waiting for room data
const TRANSITION_TEXTS = [
  "You push through the creaky doorway...",
  "Footsteps echo in the darkness...",
  "The air grows thick with anticipation...",
  "Shadows dance on the walls ahead...",
  "You carefully step forward...",
  "Something stirs in the distance...",
  "A draft carries an unfamiliar scent...",
  "The passage narrows before opening up...",
  "Dust motes swirl in a faint light...",
  "You hear the drip of water somewhere close...",
];

function exitLabel(exit: string): string {
  const first = exit.charAt(0).toUpperCase();
  const rest = exit.slice(1);
  return `[${first}]${rest}`;
}

function RoomTypeBadge({ type, pixel }: { type: string; pixel?: boolean }) {
  const label = type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <span className={cn("text-[10px] uppercase tracking-wider ml-2", pixel ? "text-gray-500" : "text-terminal-border-bright")}>
      {label}
    </span>
  );
}

export function TextPanel({ room, gameLog, isLoading, isPixelMode: px, className }: TextPanelProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);
  const [prevLogLength, setPrevLogLength] = useState(0);

  // Track room changes for typing animation
  const isNewRoom = room !== null && room.id !== lastRoomId;

  useEffect(() => {
    if (room) {
      setLastRoomId(room.id);
    }
  }, [room]);

  // Track which entries are "new" for pulse animation
  const newEntryStart = prevLogLength;
  useEffect(() => {
    if (gameLog.length > prevLogLength) {
      // Delay updating so the pulse animation has time to play
      const timer = setTimeout(() => setPrevLogLength(gameLog.length), 1500);
      return () => clearTimeout(timer);
    }
  }, [gameLog.length, prevLogLength]);

  // Auto-scroll game log — scroll the container directly to avoid jumping outer elements
  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [gameLog.length]);

  // Loading transition text
  const transitionText = useMemo(
    () => TRANSITION_TEXTS[Math.floor(Math.random() * TRANSITION_TEXTS.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading]
  );

  // Determine alert icon for log entries
  function logIcon(entry: string): string {
    if (entry.startsWith("Cannot move") || entry.includes("no exit") || entry.includes("No exit")) return "\u26A0";
    if (entry.includes("damage") || entry.includes("defeated") || entry.includes("slain")) return "\u2694";
    if (entry.includes("found") || entry.includes("discover")) return "\u2728";
    if (entry.includes("search")) return "\uD83D\uDD0D";
    if (entry.includes("flee") || entry.includes("Flee")) return "\uD83C\uDFC3";
    if (entry.includes("restore") || entry.includes("heal")) return "\u2764";
    if (entry.includes("enter") || entry.includes("move")) return "\u27A1";
    return "\u203A";
  }

  return (
    <div className={cn("flex flex-col h-full font-mono", className)}>
      {/* Room info section */}
      <div className="shrink-0 space-y-2 pb-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className={cn("text-xs italic animate-pulse", px ? "text-gray-400" : "text-terminal-green-dim")}>
              {transitionText}
            </div>
            <div className={cn("flex items-center gap-2 text-[10px]", px ? "text-gray-500" : "text-terminal-border-bright")}>
              <span className={cn("inline-block w-3 h-3 border rounded-full animate-spin", px ? "border-gray-600 border-t-gray-300" : "border-terminal-green/50 border-t-terminal-green")} />
              <span>Exploring...</span>
            </div>
          </div>
        ) : room ? (
          <>
            {/* Room name + type badge */}
            <div className="flex items-baseline">
              <h2 className={cn("text-sm font-bold", px ? "text-gray-200" : "text-terminal-green terminal-glow")}>
                {room.name}
              </h2>
              <RoomTypeBadge type={room.type} pixel={px} />
            </div>

            {/* Description */}
            <div className={cn("text-xs leading-relaxed", px ? "text-gray-400" : "text-terminal-green-dim")}>
              {isNewRoom && !px ? (
                <TerminalText text={room.description} speed={10} animate={true} />
              ) : (
                <span className="whitespace-pre-wrap">{room.description}</span>
              )}
            </div>

            {/* Exits */}
            {room.exits.length > 0 && (
              <div className="text-xs">
                <span className={px ? "text-gray-500" : "text-terminal-green-dim"}>Exits: </span>
                {room.exits.map((exit, i) => (
                  <span key={exit}>
                    <span className={px ? "text-gray-300" : "text-terminal-green"}>
                      {exitLabel(exit)}
                    </span>
                    {i < room.exits.length - 1 && <span> </span>}
                  </span>
                ))}
              </div>
            )}

            {/* Rest indicator */}
            {["safe_room", "shrine", "npc_room"].includes(room.type) && (
              <div className={cn("text-xs", px ? "text-gray-500" : "text-terminal-green-dim")}>
                This area is safe to rest.
                {(room.roomFeatures as Record<string, unknown>)?.campfire === true && (
                  <span className={px ? "text-amber-400" : "text-terminal-amber"}> A campfire crackles warmly nearby.</span>
                )}
              </div>
            )}

            {/* Shrine indicator */}
            {room.roomFeatures && (room.roomFeatures as Record<string, unknown>).shrine && (() => {
              const shrine = (room.roomFeatures as Record<string, unknown>).shrine as {
                shrineType: string;
                usesRemaining: number;
                maxUses: number;
              };
              if (shrine.usesRemaining > 0) {
                const typeLabel =
                  shrine.shrineType === "healing" ? "Healing Shrine" :
                  shrine.shrineType === "shield" ? "Shield Shrine" :
                  "Blessing Shrine";
                return (
                  <div className={cn("text-xs", px ? "text-blue-400" : "text-terminal-blue")}>
                    A {typeLabel} glows softly before you. ({shrine.usesRemaining}/{shrine.maxUses} uses)
                  </div>
                );
              }
              return (
                <div className={cn("text-xs", px ? "text-gray-600" : "text-terminal-border-bright")}>
                  A shrine stands here, its light extinguished.
                </div>
              );
            })()}

            {/* Loot indicator */}
            {room.hasLoot && room.lootData && room.lootData.length > 0 && (
              <div className={cn("text-xs", px ? "text-amber-400" : "text-terminal-amber")}>
                You notice something on the ground...
              </div>
            )}
          </>
        ) : (
          <div className={cn("text-xs", px ? "text-gray-500" : "text-terminal-green-dim")}>
            No room data available.
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={cn("shrink-0 border-t my-1", px ? "border-gray-700" : "border-terminal-border")} />

      {/* Game log section */}
      <div ref={logContainerRef} className={cn("flex-1 overflow-y-auto min-h-0", !px && "terminal-scrollbar")}>
        <div className="space-y-0.5 text-[11px]">
          {gameLog.length === 0 ? (
            <p className={cn("italic", px ? "text-gray-600" : "text-terminal-border-bright")}>
              Awaiting adventure...
            </p>
          ) : (
            gameLog.map((entry, i) => {
              const isNew = i >= newEntryStart;
              const isLatest = i === gameLog.length - 1;
              return (
                <p
                  key={i}
                  className={cn(
                    "transition-all",
                    px
                      ? cn("text-gray-500", isLatest && "text-gray-300")
                      : cn("text-terminal-green-dim", isLatest && "text-terminal-green"),
                    isNew && "animate-alert-pulse"
                  )}
                >
                  <span className={cn(
                    "mr-1",
                    px
                      ? (isLatest ? "text-amber-400" : "text-gray-600")
                      : (isLatest ? "text-terminal-amber" : "text-terminal-border")
                  )}>
                    {logIcon(entry)}
                  </span>
                  {entry}
                </p>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
