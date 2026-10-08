import { and, eq, lt, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ExploreRefreshOutbox } from "@acme/db/schema";
import { start } from "workflow/api";
import { runExploreRefresh } from "~/workflows/explore-refresh";

/** Outbox survives enqueue failures. Reads and cron both recover abandoned requests. */
export async function dispatchExploreRefresh(userId: string) {
  const [request] = await db
    .update(ExploreRefreshOutbox)
    .set({ dispatched_at: sql`now()` })
    .where(
      and(
        eq(ExploreRefreshOutbox.user_id, userId),
        or(
          sql`${ExploreRefreshOutbox.dispatched_at} is null`,
          lt(
            ExploreRefreshOutbox.dispatched_at,
            sql`now() - interval '2 minutes'`,
          ),
        ),
      ),
    )
    .returning();
  if (!request) return;
  try {
    await start(runExploreRefresh, [userId]);
  } catch (error) {
    await db
      .update(ExploreRefreshOutbox)
      .set({ dispatched_at: null })
      .where(
        and(
          eq(ExploreRefreshOutbox.user_id, userId),
          eq(ExploreRefreshOutbox.revision, request.revision),
        ),
      );
    console.error("Could not enqueue Explore refresh", { error });
  }
}

export async function recoverExploreOutbox() {
  const requests = await db
    .select({ userId: ExploreRefreshOutbox.user_id })
    .from(ExploreRefreshOutbox)
    .where(
      or(
        sql`${ExploreRefreshOutbox.dispatched_at} is null`,
        lt(
          ExploreRefreshOutbox.dispatched_at,
          sql`now() - interval '2 minutes'`,
        ),
      ),
    )
    .orderBy(ExploreRefreshOutbox.requested_at)
    .limit(100);
  for (const request of requests) await dispatchExploreRefresh(request.userId);
}
