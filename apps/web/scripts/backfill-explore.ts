import { asc, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { Document } from "@acme/db/schema";
import { ensureExploreState } from "../src/explore/refresh";
import { refreshExploreSnapshot } from "../src/explore/snapshots";

// Same worker as runtime. Resume with --after=<owner-id>; does not print note contents.
let after = process.argv
  .find((value) => value.startsWith("--after="))
  ?.slice(8);
let owners = 0;
while (true) {
  const page = await db
    .selectDistinct({ userId: Document.user_id })
    .from(Document)
    .where(after ? gt(Document.user_id, after) : undefined)
    .orderBy(asc(Document.user_id))
    .limit(50);
  if (!page.length) break;
  for (const row of page) {
    await ensureExploreState(db, row.userId);
    const status = await refreshExploreSnapshot(row.userId);
    if (status === "dirty" || status === "busy")
      throw new Error(
        "Owner changed during backfill; retry the idempotent command",
      );
    owners++;
  }
  after = page.at(-1)?.userId;
}
console.log(JSON.stringify({ owners, status: "completed" }));
process.exit(0);
