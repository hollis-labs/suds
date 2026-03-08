"use client";

import { ContextDrawer } from "@/components/pixel/ContextDrawer";
import { PixelButton } from "@/components/pixel/PixelButton";
import { SpriteIcon } from "@/components/pixel/SpriteIcon";
import type { Room } from "@/lib/types";
import type { SpriteId } from "@/lib/sprites";

interface RoomDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
  onAction: (action: string) => void;
}

const ROOM_TYPE_ICON: Record<string, SpriteId> = {
  corridor: "terrain_stone",
  chamber: "terrain_dirt",
  shrine: "building_temple",
  trap_room: "terrain_lava",
  store: "building_shop",
  npc_room: "marker_npc",
  boss_room: "ui_skull",
  safe_room: "marker_campfire",
};

const ROOM_TYPE_LABEL: Record<string, string> = {
  corridor: "Corridor",
  chamber: "Chamber",
  shrine: "Shrine",
  trap_room: "Trapped Room",
  store: "Merchant's Shop",
  npc_room: "NPC Room",
  boss_room: "Boss Chamber",
  safe_room: "Safe Room",
};

const RESTABLE_ROOMS = ["safe_room", "shrine", "npc_room"];

export function RoomDetailDrawer({ open, onClose, room, onAction }: RoomDetailDrawerProps) {
  if (!room) return null;

  const features = room.roomFeatures ?? {};
  const roomIcon = ROOM_TYPE_ICON[room.type] ?? "terrain_stone";
  const roomLabel = ROOM_TYPE_LABEL[room.type] ?? room.type;
  const canRest = RESTABLE_ROOMS.includes(room.type);
  const hasShrine = room.type === "shrine";
  const hasNPC = room.type === "npc_room";
  const hasStore = room.type === "store";
  const hasLoot = room.hasLoot && room.lootData;
  const searched = !!features.searched;

  return (
    <ContextDrawer open={open} onClose={onClose} title={room.name}>
      <div className="space-y-4">
        {/* Room type indicator */}
        <div className="flex items-center gap-2">
          <SpriteIcon spriteId={roomIcon} size={24} />
          <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">
            {roomLabel}
          </span>
        </div>

        {/* Description */}
        <p className="font-mono text-sm text-gray-300 leading-relaxed">
          {room.description}
        </p>

        {/* Room features */}
        {Object.keys(features).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {!!features.campfire && (
              <span className="font-mono text-[10px] text-amber-400 border border-amber-700 px-2 py-0.5 rounded">
                Campfire
              </span>
            )}
            {!!features.altar && (
              <span className="font-mono text-[10px] text-blue-400 border border-blue-700 px-2 py-0.5 rounded">
                Altar
              </span>
            )}
            {!!features.trap && !features.trap_resolved && (
              <span className="font-mono text-[10px] text-red-400 border border-red-700 px-2 py-0.5 rounded">
                Trap Detected
              </span>
            )}
            {!!features.chest && !features.chest_opened && (
              <span className="font-mono text-[10px] text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded">
                Chest
              </span>
            )}
          </div>
        )}

        {/* Encounter warning */}
        {room.hasEncounter && room.encounterData && (
          <div className="font-mono text-xs text-red-400 border border-red-800 bg-red-950/30 p-2 rounded">
            Enemies lurk here!
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
          {!searched && (
            <PixelButton variant="action" size="sm" onClick={() => onAction("search")}>
              Search
            </PixelButton>
          )}
          {canRest && (
            <PixelButton variant="action" size="sm" onClick={() => onAction("rest")}>
              Rest
            </PixelButton>
          )}
          {hasShrine && (
            <PixelButton variant="info" size="sm" onClick={() => onAction("interact_shrine")}>
              Pray
            </PixelButton>
          )}
          {hasNPC && (
            <PixelButton variant="nav" size="sm" onClick={() => onAction("talk")}>
              Talk
            </PixelButton>
          )}
          {hasStore && (
            <PixelButton variant="nav" size="sm" onClick={() => onAction("shop")}>
              Shop
            </PixelButton>
          )}
          {hasLoot && !!features.chest && !features.chest_opened && (
            <PixelButton variant="action" size="sm" onClick={() => onAction("interact_chest")}>
              Open Chest
            </PixelButton>
          )}
        </div>
      </div>
    </ContextDrawer>
  );
}
