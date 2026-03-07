// ─── Game Event Logger ──────────────────────────────────────────────────────
//
// Fire-and-forget event logging for admin activity monitoring.
// Never blocks game flow — all inserts are async with silent catch.

import { db } from "@/server/db";
import { gameEvents } from "@/server/db/schema";

export type GameEventType =
  | "move"
  | "combat_start"
  | "combat_victory"
  | "combat_defeat"
  | "combat_flee"
  | "level_up"
  | "item_loot"
  | "item_buy"
  | "item_sell"
  | "search"
  | "rest"
  | "shrine"
  | "npc_talk"
  | "death"
  | "respawn";

interface LogEventParams {
  characterId: string;
  characterName: string;
  userId: string;
  type: GameEventType;
  detail?: string;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget game event log. Never throws. */
export function logGameEvent(params: LogEventParams): void {
  db.insert(gameEvents)
    .values({
      characterId: params.characterId,
      characterName: params.characterName,
      userId: params.userId,
      type: params.type,
      detail: params.detail ?? null,
      metadata: params.metadata ?? {},
    })
    .catch(() => {}); // silent — never block gameplay
}
