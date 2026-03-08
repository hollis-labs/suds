"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Room, Direction } from "@/lib/types";

// ── Color palette ──────────────────────────────────────────────────────
const C = {
  bg: "#0a0f0a",
  bgAlt: "#0d140d",
  green: "#33ff33",
  greenDim: "#1a8c1a",
  greenMuted: "#145214",
  border: "#1a3a1a",
  borderBright: "#2a5a2a",
  amber: "#ffaa00",
  red: "#ff4444",
  blue: "#44aaff",
  purple: "#aa66ff",
  gold: "#ffd700",
  white: "#c8e6c8",
} as const;

const EXIT_KEYS: Record<string, string> = {
  north: "W",
  south: "S",
  east: "D",
  west: "A",
};

const FEATURE_COLORS: Record<string, string> = {
  campfire: C.amber,
  altar: C.blue,
  trap: C.red,
  chest: C.gold,
  shrine: C.purple,
};

interface RoomInfoPanelProps {
  room: Room | null;
  gameLog: string[];
  onMove: (direction: Direction) => void;
  onAction: (action: string) => void;
  className?: string;
}

export function RoomInfoPanel({
  room,
  gameLog,
  onMove,
  onAction,
  className,
}: RoomInfoPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [gameLog.length]);

  if (!room) {
    return (
      <div className={cn("font-mono text-xs p-3", className)} style={{ color: C.greenDim }}>
        No room data.
      </div>
    );
  }

  const features = room.roomFeatures as Record<string, unknown>;
  const featureKeys = features
    ? Object.keys(features).filter((k) => features[k] && k !== "searched" && k in FEATURE_COLORS)
    : [];

  return (
    <div className={cn("flex flex-col h-full font-mono overflow-hidden", className)}>
      {/* Room header */}
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-1.5">
        {/* Room name */}
        <h3
          className="text-sm font-bold"
          style={{ color: C.white, textShadow: "0 0 8px rgba(51, 255, 51, 0.4)" }}
        >
          {room.name}
        </h3>

        {/* Room type */}
        <div
          className="text-[10px] uppercase tracking-wider"
          style={{ color: C.greenDim }}
        >
          {room.type.replace(/_/g, " ")}
        </div>

        {/* Description */}
        <p
          className="text-xs leading-relaxed"
          style={{ color: C.greenDim }}
        >
          {room.description}
        </p>

        {/* Exits as clickable chips */}
        {room.exits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {room.exits.map((exit) => {
              const key = EXIT_KEYS[exit] ?? exit[0]?.toUpperCase();
              return (
                <button
                  key={exit}
                  onClick={(e) => {
                    onMove(exit as Direction);
                    e.currentTarget.blur();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors cursor-pointer"
                  style={{
                    border: `1px solid ${C.border}`,
                    color: C.green,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.green;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold"
                    style={{ backgroundColor: C.border, color: C.green }}
                  >
                    {key}
                  </span>
                  {exit.charAt(0).toUpperCase() + exit.slice(1)}
                </button>
              );
            })}
          </div>
        )}

        {/* Room features as badges */}
        {featureKeys.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {featureKeys.map((key) => (
              <span
                key={key}
                className="text-[10px] px-1.5 py-0.5 rounded-sm font-bold uppercase"
                style={{
                  color: FEATURE_COLORS[key] ?? C.greenDim,
                  border: `1px solid ${FEATURE_COLORS[key] ?? C.border}`,
                  backgroundColor: `${FEATURE_COLORS[key] ?? C.border}15`,
                }}
              >
                {key}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="shrink-0 mx-3" style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Recent game log */}
      <div
        ref={logRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5"
      >
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.greenMuted }}>
          Log
        </div>
        {gameLog.length === 0 ? (
          <p className="text-[11px] italic" style={{ color: C.greenMuted }}>
            Awaiting adventure...
          </p>
        ) : (
          gameLog.slice(-10).map((entry, i) => {
            const isLatest = i === Math.min(gameLog.length, 10) - 1;
            return (
              <p
                key={gameLog.length - 10 + i}
                className="text-[11px]"
                style={{ color: isLatest ? C.white : C.greenDim }}
              >
                <span style={{ color: isLatest ? C.amber : C.greenMuted }} className="mr-1">›</span>
                {entry}
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}
