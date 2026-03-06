import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { characterRouter } from "./routers/character";
import { gameRouter } from "./routers/game";
import { combatRouter } from "./routers/combat";
import { storeRouter } from "./routers/store";
import { npcRouter } from "./routers/npc";
import { inventoryRouter } from "./routers/inventory";

export const appRouter = router({
  auth: authRouter,
  character: characterRouter,
  game: gameRouter,
  combat: combatRouter,
  store: storeRouter,
  npc: npcRouter,
  inventory: inventoryRouter,
});

export type AppRouter = typeof appRouter;
