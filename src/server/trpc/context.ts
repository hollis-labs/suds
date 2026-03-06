import { db } from "@/server/db";
import { auth } from "@/lib/auth";

export async function createContext() {
  const session = await auth();
  return { db, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
