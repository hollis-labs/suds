import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { characterRouter } from "./routers/character";
import { gameRouter } from "./routers/game";
import { combatRouter } from "./routers/combat";

export const appRouter = router({
  auth: authRouter,
  character: characterRouter,
  game: gameRouter,
  combat: combatRouter,
});

export type AppRouter = typeof appRouter;
