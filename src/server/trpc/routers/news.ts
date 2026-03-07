import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { newsPosts } from "@/server/db/schema";

// ─── Admin Guard (mirrors admin.ts) ─────────────────────────────────

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const email = ctx.session.user?.email;
  if (!isAdmin(email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// ─── Router ─────────────────────────────────────────────────────────

export const newsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.db
      .select()
      .from(newsPosts)
      .where(eq(newsPosts.published, true))
      .orderBy(desc(newsPosts.createdAt))
      .limit(20);

    return posts;
  }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        category: z.enum(["update", "event", "bugfix", "announcement"]).default("update"),
        published: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const [post] = await ctx.db
        .insert(newsPosts)
        .values({
          title: input.title,
          body: input.body,
          category: input.category,
          published: input.published,
          authorId: userId,
        })
        .returning();

      return post;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        body: z.string().min(1).optional(),
        category: z.enum(["update", "event", "bugfix", "announcement"]).optional(),
        published: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [post] = await ctx.db
        .update(newsPosts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(newsPosts.id, id))
        .returning();

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      return post;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(newsPosts)
        .where(eq(newsPosts.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      return { success: true };
    }),
});
