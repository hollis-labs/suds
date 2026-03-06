import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const characterRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // TODO: Implement character listing
    return [];
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // TODO: Implement character fetching
      return null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(32),
        class: z.string(),
        theme: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement character creation
      return { id: "stub", ...input };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement character deletion
      return { success: true };
    }),
});
