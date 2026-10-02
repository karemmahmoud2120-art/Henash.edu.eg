import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { platformUsers } from "../src/db/schema";

const usernamePattern = /^[a-zA-Z][a-zA-Z0-9._-]{2,23}$/;

async function createInitialAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase() ?? "";
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "مدير المنصة";
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!usernamePattern.test(username)) {
    throw new Error("ADMIN_USERNAME must start with a letter and be 3–24 characters.");
  }
  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error("ADMIN_DISPLAY_NAME must be between 2 and 80 characters.");
  }
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("ADMIN_PASSWORD must be 12–72 bytes. Generate a unique, random password.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(842620251)`);

    const [existingAdmin] = await transaction
      .select({ id: platformUsers.id })
      .from(platformUsers)
      .where(eq(platformUsers.role, "admin"))
      .limit(1);

    if (existingAdmin) throw new Error("An administrator already exists. Refusing to replace admin credentials.");

    const [existingUsername] = await transaction
      .select({ id: platformUsers.id })
      .from(platformUsers)
      .where(eq(platformUsers.username, username))
      .limit(1);

    if (existingUsername) throw new Error("That username already exists. Choose a different ADMIN_USERNAME.");

    const [created] = await transaction
      .insert(platformUsers)
      .values({ username, displayName, passwordHash, grade: "إدارة المنصة", role: "admin" })
      .returning({ id: platformUsers.id, username: platformUsers.username });

    return created;
  });

  console.info(`Initial administrator created: @${admin.username}. Keep the username and password in a password manager.`);
}

createInitialAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to create initial admin account.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
