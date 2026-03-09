Backend Agent (Combat Fixes + Encounter Title Card):

  You are working sprint SPR-20260308-uat-iteration-1 (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint fixes combat bugs and adds a "pending combat" state so encounters show a title card before combat begins.

  ## Tasks in order:

  1. TASK-20260308-180 — Fix party members not participating in combat

     **Symptom**: When a companion joins, they don't appear to fight alongside the player.

     **What the code shows**: Companions ARE implemented in the combat engine (`src/server/game/combat.ts`, lines 810-845 for initiative, 1440-1490 for turn resolution). They roll initiative, attack the lowest-HP monster, can be targeted (30% chance), and can die.

     **Likely causes to investigate**:
     - The `combat.start` mutation in `src/server/trpc/routers/combat.ts` (line 476) — does it correctly include the companion in the turn order when initializing?
     - Check if `character.companion` data is being passed correctly from the DB into combat initialization
     - Check the auto-resolution loop (line 835-845 of combat.ts) — companion turns should auto-resolve between player turns. Is the companion turn type being matched correctly in the loop condition?
     - Check the client side — does `CombatPanel` display companion actions in the combat log? Search for companion references in `src/components/game/CombatPanel.tsx`
     - Verify that when `combat.action` returns updated state, companion damage/actions appear in the log entries

     **Files**: `src/server/game/combat.ts`, `src/server/trpc/routers/combat.ts`, `src/server/trpc/routers/game.ts`, `src/components/game/CombatPanel.tsx`

     **Acceptance criteria**: Party members take combat turns, deal damage to monsters, and their actions appear in the combat log.

  2. TASK-20260308-181 — Fix monster health/initiative resetting mid-combat

     **Symptom**: Sometimes during a fight, the monster's health and initiative reset while the player's HP stays reduced. Makes combat unfairly lethal.

     **What the code shows**: Monster state is stored in the `combatState` DB table. Once combat starts, monsters should never be re-generated — they're updated in-place each turn. However:

     **Key suspect — room re-entry trigger** (`src/server/trpc/routers/game.ts`, lines 434-439):
     ```typescript
     if (room.hasEncounter && room.encounterData) {
       const encounter = generateEncounter(character.level, targetDepth, theme);
       // Persists fresh encounter to room
     }
     ```
     This regenerates the encounter every time a player enters a room with `hasEncounter=true`. This is intentional for flee/re-entry, BUT:
     - Check if ANY client-side action (SSE reconnect, page refocus, query refetch) causes a re-entry to trigger
     - Check if `combatStartMutation` can be called multiple times (e.g., if the client calls it on mount + on data change)
     - Check the client side for duplicate `combatStartMutation.mutate()` calls — look in the play page for where `enterCombat` is detected and combat start is triggered. Is there a useEffect that re-fires?
     - Check if SSE events or query invalidation during combat cause the room data to reload, which then triggers another encounter detection

     **Possible fixes**:
     - Add a guard: if `combatState` already exists for this character, do NOT regenerate the encounter or re-start combat
     - In `combat.start` mutation: if combat state already exists, return the existing state instead of creating new
     - On client: guard `combatStartMutation.mutate()` with a check that combat isn't already active

     **Files**: `src/server/trpc/routers/game.ts`, `src/server/trpc/routers/combat.ts`, `src/server/game/combat.ts`, `src/app/(game)/play/[characterId]/page.tsx`, `src/stores/gameStore.ts`

     **Acceptance criteria**: Monster HP and initiative persist throughout the entire combat encounter. No mid-fight resets. `combat.start` is idempotent — calling it when combat exists returns existing state.

  3. TASK-20260308-183 — Add combat encounter title card modal (pending combat state)

     **Current behavior**: Combat auto-starts when entering a room with `hasEncounter=true`. The server generates the encounter, the client detects `enterCombat=true`, and immediately calls `combatStartMutation.mutate()`.

     **New behavior**: Add a "pending combat" state between encounter detection and combat start:

     **Server changes**:
     - In `src/server/trpc/routers/game.ts` move mutation: when a room has an encounter, still generate the encounter data, but do NOT auto-start combat. Instead return `{ pendingEncounter: encounterData }` alongside the room data.
     - Add a new flag or modify the response shape so the client knows there's a pending encounter but combat hasn't started yet.

     **Client changes** (`src/app/(game)/play/[characterId]/page.tsx`):
     - Add state: `const [pendingEncounter, setPendingEncounter] = useState<EncounterData | null>(null)`
     - When `data.pendingEncounter` is detected from a move, set it to state instead of calling `combatStartMutation`
     - Show a **title card modal** (using PixelModal or a new component):
       - Header: "ENCOUNTER!" in bold with red glow
       - Left side: Player name(s) — show player name, and companion name if present
       - Center: "VS" in dramatic styling
       - Right side: Monster name(s) from the encounter data — list each monster with name and level
       - Monster info section: brief description, type, any special traits
       - Big button: "Roll Initiative" (or "FIGHT!") — clicking this calls `combatStartMutation.mutate()` which starts actual combat
       - Use the green terminal palette: bg=#0a0f0a, borders=#1a3a1a, text=#c8e6c8, red=#ff4444 for danger, amber=#ffaa00 for the VS
     - Once the player clicks Roll Initiative, clear `pendingEncounter` and combat proceeds as normal

     **Important**: The encounter data must include monster names, levels, and descriptions. Check what `generateEncounter()` in `src/server/game/encounters.ts` returns and ensure the title card has enough info to display.

     **Files**: `src/server/trpc/routers/game.ts`, `src/app/(game)/play/[characterId]/page.tsx`, possibly new component `src/components/game/EncounterModal.tsx`, `src/server/game/encounters.ts`

     **Acceptance criteria**: Encounter modal appears on room entry with encounter. Shows player(s) vs monster(s) with actual names. Shows monster info. Player must click to start combat. Uses green terminal palette.

  ## Critical Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, do NOT close the sprint (other tasks remain for a frontend agent).
  - Do NOT modify legacy character layout (the `!isWorldCharacter` branch) unless necessary for the combat fix.
  - Do NOT break existing combat flow — changes should be additive/protective.
  - All hooks must remain above early returns in the play page (hooks ordering rule).
  - The title card modal should use the green terminal palette, NOT blue/gray.
  - Test both scenarios: fresh encounter on room entry, and flee + re-enter (should still show title card on re-entry).
