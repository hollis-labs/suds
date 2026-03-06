import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { invites, users } from "./schema";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function seed() {
  console.log("Seeding invite codes...\n");

  // Get or create a system user for invite creation
  let [systemUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "system@suds.game"))
    .limit(1);

  if (!systemUser) {
    [systemUser] = await db
      .insert(users)
      .values({
        name: "System",
        email: "system@suds.game",
      })
      .returning();
    console.log("Created system user for invite ownership.\n");
  }

  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(generateCode());
  }

  // Set expiry 30 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const values = codes.map((code) => ({
    code,
    createdBy: systemUser!.id,
    expiresAt,
  }));

  await db.insert(invites).values(values);

  console.log("Generated invite codes:");
  console.log("========================");
  for (const code of codes) {
    console.log(`  ${code}`);
  }
  console.log("========================");
  console.log(`\n${codes.length} codes created (expire: ${expiresAt.toISOString()})`);

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
