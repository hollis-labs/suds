# ADR-005: Combat Extra State for Buffs

## Status
Accepted

## Context
Combat abilities like Ice Shield, Bless, Divine Shield need to track temporary effects across turns. The base CombatState type (shared with client) doesn't include buff tracking.

## Decision
Introduced CombatExtra type alongside CombatState. CombatExtra tracks playerBuffs and monsterBuffs with round-based duration. Serialized into the turnOrder JSONB column for DB storage (Map serialized as Object).

## Rationale
- Keeps CombatState type clean for client consumption
- Buffs are a server-only concern
- JSONB storage handles arbitrary buff data without schema changes
- Map to Object serialization is straightforward

## Consequences
- Extra deserialization step when loading combat state
- Buff system is combat-engine internal, not visible to UI (UI shows effects)
