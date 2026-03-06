"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TerminalText } from "@/components/terminal";
import type { Room } from "@/lib/types";

interface TextPanelProps {
  room: Room | null;
  gameLog: string[];
  className?: string;
}

function exitLabel(exit: string): string {
  const first = exit.charAt(0).toUpperCase();
  const rest = exit.slice(1);
  return `[${first}]${rest}`;
}

function RoomTypeBadge({ type }: { type: string }) {
  const label = type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <span className="text-terminal-border-bright text-[10px] uppercase tracking-wider ml-2">
      {label}
    </span>
  );
}

export function TextPanel({ room, gameLog, className }: TextPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);

  // Track room changes for typing animation
  const isNewRoom = room !== null && room.id !== lastRoomId;

  useEffect(() => {
    if (room) {
      setLastRoomId(room.id);
    }
  }, [room]);

  // Auto-scroll game log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameLog.length]);

  return (
    <div className={cn("flex flex-col h-full font-mono", className)}>
      {/* Room info section */}
      <div className="shrink-0 space-y-2 pb-3">
        {room ? (
          <>
            {/* Room name + type badge */}
            <div className="flex items-baseline">
              <h2 className="text-terminal-green terminal-glow text-sm font-bold">
                {room.name}
              </h2>
              <RoomTypeBadge type={room.type} />
            </div>

            {/* Description with typing effect on room change */}
            <div className="text-terminal-green-dim text-xs leading-relaxed">
              {isNewRoom ? (
                <TerminalText
                  text={room.description}
                  speed={20}
                  animate={true}
                />
              ) : (
                <span className="whitespace-pre-wrap">{room.description}</span>
              )}
            </div>

            {/* Exits */}
            {room.exits.length > 0 && (
              <div className="text-xs">
                <span className="text-terminal-green-dim">Exits: </span>
                {room.exits.map((exit, i) => (
                  <span key={exit}>
                    <span className="text-terminal-green">
                      {exitLabel(exit)}
                    </span>
                    {i < room.exits.length - 1 && (
                      <span className="text-terminal-border"> </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Loot indicator */}
            {room.hasLoot && room.lootData && room.lootData.length > 0 && (
              <div className="text-xs text-terminal-amber">
                You notice something on the ground...
              </div>
            )}
          </>
        ) : (
          <div className="text-terminal-green-dim text-xs">
            No room data available.
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="shrink-0 border-t border-terminal-border my-1" />

      {/* Game log section */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-0.5 text-[11px]">
          {gameLog.length === 0 ? (
            <p className="text-terminal-border-bright italic">
              Awaiting adventure...
            </p>
          ) : (
            gameLog.map((entry, i) => (
              <p
                key={i}
                className={cn(
                  "text-terminal-green-dim",
                  i === gameLog.length - 1 && "text-terminal-green"
                )}
              >
                <span className="text-terminal-border mr-1">&gt;</span>
                {entry}
              </p>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
