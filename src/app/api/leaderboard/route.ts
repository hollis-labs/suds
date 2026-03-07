import { db } from "@/server/db";
import { characters } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getLeaderboard() {
  return db
    .select({
      name: characters.name,
      level: characters.level,
      class: characters.class,
      theme: characters.theme,
      gold: characters.gold,
      xp: characters.xp,
    })
    .from(characters)
    .orderBy(desc(characters.level), desc(characters.xp))
    .limit(20);
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data immediately
      const data = await getLeaderboard();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      // Then send updates every 10 seconds
      const interval = setInterval(async () => {
        try {
          const data = await getLeaderboard();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client likely disconnected
          clearInterval(interval);
          controller.close();
        }
      }, 10000);

      // Clean up on abort
      // Note: We can't listen to the request signal directly in start(),
      // but the try/catch on enqueue handles disconnection
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
