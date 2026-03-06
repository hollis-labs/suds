import { z } from "zod";
import { eq, and, isNull, gt } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { invites } from "@/server/db/schema";

export const authRouter = router({
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  validateInvite: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invite] = await ctx.db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.code, input.code),
            isNull(invites.usedBy)
          )
        )
        .limit(1);

      if (!invite) {
        return { valid: false, reason: "Invite not found or already used" } as const;
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return { valid: false, reason: "Invite has expired" } as const;
      }

      return { valid: true, invite } as const;
    }),
});
