import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { characterRouter } from "./routers/character";
import { gameRouter } from "./routers/game";

export const appRouter = router({
  auth: authRouter,
  character: characterRouter,
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
