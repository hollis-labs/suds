# ADR-003: All Game Logic Server-Side

## Status
Accepted

## Context
Game logic could live on client, server, or split between both.

## Decision
ALL game logic (combat, loot, world generation, stat calculation, store pricing) runs server-side in src/server/game/. The React client is purely presentational.

## Rationale
- Prevents cheating (can't manipulate client-side game state)
- Single source of truth for all game state
- Mirrors v1's architecture (TUI = pure UI)
- tRPC provides type-safe boundary between client and server
- Game state is authoritative in PostgreSQL

## Consequences
- Every game action requires a server round-trip
- Need loading states for all interactions
- Cannot play offline
- Server must handle all computation (but game math is lightweight)
