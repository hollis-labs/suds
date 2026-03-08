"use client";

import { useMemo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import { cn } from "@/lib/utils";
import type { MapViewport, MapCell, Room } from "@/lib/types";

// ── Color palette ──────────────────────────────────────────────────────
const COLORS = {
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

// ── Layout constants ───────────────────────────────────────────────────
const ROOM_W = 150;
const ROOM_H = 100;
const GAP_X = 40;
const GAP_Y = 40;
const CELL_W = ROOM_W + GAP_X;
const CELL_H = ROOM_H + GAP_Y;
const CORRIDOR_THICKNESS = 4;
const DOOR_SIZE = 8;

// ── Types ──────────────────────────────────────────────────────────────
export interface DungeonMapProps {
  viewport: MapViewport;
  playerPosition: { x: number; y: number };
  onRoomClick: (x: number, y: number, room: Room) => void;
  onMoveToRoom: (x: number, y: number) => void;
  className?: string;
}

export interface DungeonMapHandle {
  scrollToRoom: (x: number, y: number) => void;
}

// ── Icon components (pure SVG, no sprites/emoji) ───────────────────────

function PlayerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" fill={COLORS.green} />
      <path d="M3 14c0-3 2-5 5-5s5 2 5 5" fill={COLORS.green} />
    </svg>
  );
}

function NPCIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="6" r="3" stroke={COLORS.blue} strokeWidth="1.5" fill="none" />
      <path d="M4 14c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" stroke={COLORS.blue} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function EncounterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill={COLORS.red} />
    </svg>
  );
}

function StoreIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1" stroke={COLORS.gold} strokeWidth="1.5" fill="none" />
      <path d="M3 7l2-4h6l2 4" stroke={COLORS.gold} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ShrineIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10l-4 2.5 1.5-4.5L2 5.5h4.5z" fill={COLORS.purple} />
    </svg>
  );
}

function FeatureIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill={COLORS.amber} />
      <circle cx="8" cy="8" r="5" stroke={COLORS.amber} strokeWidth="1" opacity="0.4" fill="none" />
    </svg>
  );
}

function FogIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <text x="8" y="12" textAnchor="middle" fill={COLORS.border} fontSize="14" fontFamily="monospace">?</text>
    </svg>
  );
}

// ── Helper: get room border color based on state ───────────────────────
function getRoomBorderColor(room: Room, isCurrent: boolean): string {
  if (isCurrent) return COLORS.amber;
  if (room.hasEncounter) return COLORS.red;
  if (room.type === "store") return COLORS.gold;
  if (room.type === "npc_room") return COLORS.blue;
  if (room.type === "shrine") return COLORS.purple;
  if (room.visited) return COLORS.border;
  return COLORS.border;
}

// ── Helper: get room entity icons ──────────────────────────────────────
function getRoomIcons(room: Room, isCurrent: boolean): React.ReactNode[] {
  const icons: React.ReactNode[] = [];
  if (isCurrent) {
    icons.push(<PlayerIcon key="player" size={18} />);
  }
  if (room.type === "npc_room") {
    icons.push(<NPCIcon key="npc" />);
  }
  if (room.type === "store") {
    icons.push(<StoreIcon key="store" />);
  }
  if (room.hasEncounter && !isCurrent) {
    icons.push(<EncounterIcon key="encounter" />);
  }
  if (room.type === "shrine") {
    icons.push(<ShrineIcon key="shrine" />);
  }
  const features = room.roomFeatures;
  if (features && (features.campfire || features.altar || features.chest)) {
    icons.push(<FeatureIcon key="feature" />);
  }
  return icons;
}

// ── Helper: check adjacency ────────────────────────────────────────────
function isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
  return (Math.abs(ax - bx) === 1 && ay === by) || (ax === bx && Math.abs(ay - by) === 1);
}

// ── RoomRect (memoized) ────────────────────────────────────────────────
const RoomRect = memo(function RoomRect({
  cell,
  isCurrent,
  isAdj,
  onClick,
}: {
  cell: MapCell;
  isCurrent: boolean;
  isAdj: boolean;
  onClick: () => void;
}) {
  const room = cell.room!;
  const isVisible = isCurrent || (room.visited);
  const isFog = !isVisible;

  const borderColor = isFog ? COLORS.border : getRoomBorderColor(room, isCurrent);
  const bgColor = isCurrent ? "#111a11" : COLORS.bgAlt;
  const icons = isVisible ? getRoomIcons(room, isCurrent) : [<FogIcon key="fog" />];

  const clickable = isCurrent || (isAdj && room.visited);

  return (
    <div
      className={cn(
        "absolute font-mono flex flex-col items-center justify-center gap-1 transition-all duration-150",
        clickable ? "cursor-pointer" : "cursor-default",
        isCurrent && "z-10",
      )}
      style={{
        left: cell.x * CELL_W,
        top: cell.y * CELL_H,
        width: ROOM_W,
        height: ROOM_H,
        backgroundColor: isFog ? "transparent" : bgColor,
        border: `2px solid ${borderColor}`,
        opacity: isFog ? 0.3 : 1,
        boxShadow: isCurrent ? `0 0 12px ${COLORS.amber}40, inset 0 0 8px ${COLORS.amber}15` : undefined,
      }}
      onClick={onClick}
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-label={isVisible ? `${room.name} (${room.type})` : "Undiscovered room"}
    >
      {/* Entity icons */}
      <div className="flex items-center gap-1.5">
        {icons}
      </div>
      {/* Room name */}
      {isVisible && (
        <span
          className="text-[9px] leading-tight text-center px-1 truncate max-w-full"
          style={{ color: isCurrent ? COLORS.white : COLORS.greenDim }}
        >
          {room.name}
        </span>
      )}
    </div>
  );
});

// ── DungeonMap Component ───────────────────────────────────────────────
export const DungeonMap = forwardRef<DungeonMapHandle, DungeonMapProps>(function DungeonMap({
  viewport,
  playerPosition,
  onRoomClick,
  onMoveToRoom,
  className,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Collect all rooms from the viewport cells
  const rooms = useMemo(() => {
    const result: { cell: MapCell; room: Room }[] = [];
    for (const row of viewport.cells) {
      for (const cell of row) {
        if (cell.room) {
          result.push({ cell, room: cell.room });
        }
      }
    }
    return result;
  }, [viewport]);

  // Compute corridors between rooms
  const corridors = useMemo(() => {
    // Build a lookup: "x,y" → MapCell
    const lookup = new Map<string, MapCell>();
    for (const { cell } of rooms) {
      lookup.set(`${cell.x},${cell.y}`, cell);
    }

    const result: { x1: number; y1: number; x2: number; y2: number; dir: "h" | "v" }[] = [];
    const seen = new Set<string>();

    for (const { cell, room } of rooms) {
      for (const exit of room.exits) {
        let nx = cell.x, ny = cell.y;
        let dir: "h" | "v" = "h";
        if (exit === "east") { nx += 1; dir = "h"; }
        else if (exit === "west") { nx -= 1; dir = "h"; }
        else if (exit === "south") { ny += 1; dir = "v"; }
        else if (exit === "north") { ny -= 1; dir = "v"; }
        else continue;

        const neighbor = lookup.get(`${nx},${ny}`);
        if (!neighbor || !neighbor.room) continue;

        const key = [Math.min(cell.x, nx), Math.min(cell.y, ny), dir].join(",");
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          x1: cell.x, y1: cell.y,
          x2: nx, y2: ny,
          dir,
        });
      }
    }
    return result;
  }, [rooms]);

  // Compute canvas bounds
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { cell } of rooms) {
      if (cell.x < minX) minX = cell.x;
      if (cell.y < minY) minY = cell.y;
      if (cell.x > maxX) maxX = cell.x;
      if (cell.y > maxY) maxY = cell.y;
    }
    if (rooms.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
    return {
      minX,
      minY,
      width: (maxX - minX + 1) * CELL_W,
      height: (maxY - minY + 1) * CELL_H,
    };
  }, [rooms]);

  // Scroll helper: center a world-coordinate room in the viewport
  const scrollToWorldRoom = useCallback(
    (wx: number, wy: number, smooth = true) => {
      const el = containerRef.current;
      if (!el) return;
      const px = (wx - bounds.minX) * CELL_W + ROOM_W / 2 + 10; // +10 for padding
      const py = (wy - bounds.minY) * CELL_H + ROOM_H / 2 + 10;
      el.scrollTo({
        left: px - el.clientWidth / 2,
        top: py - el.clientHeight / 2,
        behavior: smooth ? "smooth" : "instant",
      });
    },
    [bounds.minX, bounds.minY],
  );

  // Expose scrollToRoom for external callers (e.g. MiniMap click)
  useImperativeHandle(ref, () => ({
    scrollToRoom: (x: number, y: number) => scrollToWorldRoom(x, y, true),
  }), [scrollToWorldRoom]);

  // Dead-zone scrolling: only scroll when player is within 1 room of viewport edge
  const prevPlayerRef = useRef({ x: playerPosition.x, y: playerPosition.y });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isFirst = prevPlayerRef.current.x === playerPosition.x && prevPlayerRef.current.y === playerPosition.y;
    prevPlayerRef.current = { x: playerPosition.x, y: playerPosition.y };

    const px = (playerPosition.x - bounds.minX) * CELL_W + ROOM_W / 2 + 10;
    const py = (playerPosition.y - bounds.minY) * CELL_H + ROOM_H / 2 + 10;

    // Check if player is near the edge of the visible viewport
    const marginX = CELL_W; // 1 room distance
    const marginY = CELL_H;
    const visLeft = el.scrollLeft + marginX;
    const visRight = el.scrollLeft + el.clientWidth - marginX;
    const visTop = el.scrollTop + marginY;
    const visBottom = el.scrollTop + el.clientHeight - marginY;

    const needsScroll = isFirst || px < visLeft || px > visRight || py < visTop || py > visBottom;

    if (needsScroll) {
      el.scrollTo({
        left: px - el.clientWidth / 2,
        top: py - el.clientHeight / 2,
        behavior: isFirst ? "instant" : "smooth",
      });
    }
  }, [playerPosition.x, playerPosition.y, bounds.minX, bounds.minY]);

  const handleRoomClick = useCallback(
    (cell: MapCell) => {
      if (!cell.room) return;
      if (cell.isCurrent) {
        onRoomClick(cell.x, cell.y, cell.room);
        return;
      }
      if (cell.room.visited && isAdjacent(cell.x, cell.y, playerPosition.x, playerPosition.y)) {
        onMoveToRoom(cell.x, cell.y);
      }
    },
    [playerPosition.x, playerPosition.y, onRoomClick, onMoveToRoom],
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto w-full h-full", className)}
      style={{
        backgroundColor: COLORS.bg,
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 39px, ${COLORS.bgAlt} 39px, ${COLORS.bgAlt} 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, ${COLORS.bgAlt} 39px, ${COLORS.bgAlt} 40px)
        `,
      }}
    >
      {/* Inner canvas sized to hold all rooms */}
      <div
        className="relative"
        style={{
          width: bounds.width + 20,
          height: bounds.height + 20,
          padding: 10,
        }}
      >
        {/* ── Corridors (SVG layer) ── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={bounds.width + 20}
          height={bounds.height + 20}
          style={{ zIndex: 0 }}
        >
          {corridors.map((c) => {
            const ox = 10; // padding offset
            const oy = 10;
            if (c.dir === "h") {
              // Horizontal corridor
              const leftX = Math.min(c.x1, c.x2);
              const startX = ox + (leftX - bounds.minX) * CELL_W + ROOM_W;
              const endX = ox + (leftX - bounds.minX + 1) * CELL_W;
              const cy = oy + (c.y1 - bounds.minY) * CELL_H + ROOM_H / 2;
              return (
                <g key={`c-${c.x1},${c.y1}-${c.x2},${c.y2}`}>
                  <line
                    x1={startX} y1={cy}
                    x2={endX} y2={cy}
                    stroke={COLORS.border}
                    strokeWidth={CORRIDOR_THICKNESS}
                  />
                  {/* Door markers */}
                  <rect x={startX - DOOR_SIZE / 2} y={cy - DOOR_SIZE / 2} width={DOOR_SIZE} height={DOOR_SIZE} fill={COLORS.amber} opacity={0.6} />
                  <rect x={endX - DOOR_SIZE / 2} y={cy - DOOR_SIZE / 2} width={DOOR_SIZE} height={DOOR_SIZE} fill={COLORS.amber} opacity={0.6} />
                </g>
              );
            } else {
              // Vertical corridor
              const topY = Math.min(c.y1, c.y2);
              const cx = ox + (c.x1 - bounds.minX) * CELL_W + ROOM_W / 2;
              const startY = oy + (topY - bounds.minY) * CELL_H + ROOM_H;
              const endY = oy + (topY - bounds.minY + 1) * CELL_H;
              return (
                <g key={`c-${c.x1},${c.y1}-${c.x2},${c.y2}`}>
                  <line
                    x1={cx} y1={startY}
                    x2={cx} y2={endY}
                    stroke={COLORS.border}
                    strokeWidth={CORRIDOR_THICKNESS}
                  />
                  {/* Door markers */}
                  <rect x={cx - DOOR_SIZE / 2} y={startY - DOOR_SIZE / 2} width={DOOR_SIZE} height={DOOR_SIZE} fill={COLORS.amber} opacity={0.6} />
                  <rect x={cx - DOOR_SIZE / 2} y={endY - DOOR_SIZE / 2} width={DOOR_SIZE} height={DOOR_SIZE} fill={COLORS.amber} opacity={0.6} />
                </g>
              );
            }
          })}
        </svg>

        {/* ── Room rectangles ── */}
        <div
          className="relative"
          style={{ zIndex: 1, marginLeft: 10, marginTop: 10 }}
        >
          {rooms.map(({ cell }) => {
            const room = cell.room!;
            const isCurrent = cell.isCurrent;
            const isAdj = isAdjacent(cell.x, cell.y, playerPosition.x, playerPosition.y);
            return (
              <RoomRect
                key={`r-${cell.x},${cell.y}`}
                cell={{
                  ...cell,
                  x: cell.x - bounds.minX,
                  y: cell.y - bounds.minY,
                }}
                isCurrent={isCurrent}
                isAdj={isAdj}
                onClick={() => handleRoomClick(cell)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
