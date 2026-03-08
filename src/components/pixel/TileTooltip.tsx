"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { TileData } from "@/lib/tile-types";
import { getSprite } from "@/lib/sprites";

interface TileTooltipProps {
  tile: TileData;
  children: React.ReactNode;
}

const LONG_PRESS_MS = 500;

export function TileTooltip({ tile, children }: TileTooltipProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop hover
  const handleMouseEnter = useCallback(() => setShow(true), []);
  const handleMouseLeave = useCallback(() => {
    setShow(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Mobile long-press
  const handleTouchStart = useCallback(() => {
    timerRef.current = setTimeout(() => setShow(true), LONG_PRESS_MS);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Dismiss after a short delay so user can read it
    if (show) {
      setTimeout(() => setShow(false), 1500);
    }
  }, [show]);

  if (tile.visibility === "hidden") {
    return <>{children}</>;
  }

  const sprite = getSprite(tile.spriteId);
  const markerList =
    tile.markers.length > 0 ? tile.markers.join(", ") : null;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setShow((s) => !s);
      }}
    >
      {children}
      {show && (
        <div
          className={cn(
            "absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1",
            "px-2 py-1 bg-gray-800 border border-gray-600 rounded",
            "font-mono text-[10px] text-gray-200 whitespace-nowrap",
            "pointer-events-none shadow-lg"
          )}
        >
          <div className="font-bold">{sprite.label}</div>
          <div className="text-gray-400">
            ({tile.x}, {tile.y})
            {!tile.walkable && <span className="text-red-400 ml-1">impassable</span>}
          </div>
          {markerList && (
            <div className="text-amber-400">{markerList}</div>
          )}
        </div>
      )}
    </div>
  );
}
