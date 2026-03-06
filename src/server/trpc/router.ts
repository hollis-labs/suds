import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { characterRouter } from "./routers/character";

export const appRouter = router({
  auth: authRouter,
  character: characterRouter,
});

export type AppRouter = typeof appRouter;
