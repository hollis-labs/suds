# ADR-004: Per-Character World Instances

## Status
Accepted

## Context
Rooms, stores, NPCs could be shared across all players or per-character.

## Decision
Each character has their own world instance. All rooms, stores, NPCs, encounters are scoped to a character_id. The world table uses UNIQUE(character_id, x, y).

## Rationale
- Simplifies MVP: no concurrency issues, no shared state conflicts
- Matches "Single User Dungeon" concept
- Each character can have a different theme/flavor
- Database queries are simple (always filter by character_id)
- MUD mode (P2) can add shared world tables later

## Consequences
- No interaction between characters (even same user's characters)
- Some storage duplication (each character has their own room data)
- Migration to shared worlds later requires schema changes
