import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { invites } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user has a redeemed invite
  const [redeemedInvite] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(eq(invites.usedBy, session.user.id))
    .limit(1);

  // Admin users bypass invite check
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = session.user.email
    ? adminEmails.includes(session.user.email.toLowerCase())
    : false;

  if (!redeemedInvite && !isAdmin) {
    redirect("/invite");
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-green font-mono">
      {children}
    </div>
  );
}
