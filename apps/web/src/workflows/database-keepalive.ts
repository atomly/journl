import { sql } from "@acme/db";
import { db } from "@acme/db/client";

export async function runDatabaseKeepalive() {
  "use workflow";

  await pingDatabase();
}

async function pingDatabase() {
  "use step";

  // Execute a real, read-only query without accessing any journal data.
  await db.execute(sql`select 1`);
}
pingDatabase.maxRetries = 3;
