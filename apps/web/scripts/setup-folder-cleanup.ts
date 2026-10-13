import { readFile } from "node:fs/promises";
import { sql } from "@acme/db";
import { db } from "@acme/db/client";

await db.transaction(async (tx) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('journl:folder-cleanup:schema:v1'))`,
  );
  await tx.execute(
    sql.raw(
      await readFile(
        new URL(
          "../../../packages/db/sql/20261013_folder_deletion_outbox.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
});
process.stdout.write("Folder cleanup outbox schema ready\n");
process.exit(0);
