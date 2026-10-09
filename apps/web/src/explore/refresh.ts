import { and, eq, sql } from "@acme/db";
import {
  ExploreRefreshOutbox,
  ExploreSnapshot,
  ExploreState,
} from "@acme/db/schema";
import type { TRPCContext } from "~/trpc/trpc";
import { ALGORITHM_VERSION } from "./config";

/** Must run in the same transaction as the authored change. */
export async function markExploreDirty(tx: TRPCContext["db"], userId: string) {
  const [state] = await tx
    .insert(ExploreState)
    .values({ source_revision: 1, user_id: userId })
    .onConflictDoUpdate({
      set: {
        dirty_at: sql`now()`,
        source_revision: sql`${ExploreState.source_revision} + 1`,
      },
      target: ExploreState.user_id,
    })
    .returning({ revision: ExploreState.source_revision });
  await tx
    .insert(ExploreRefreshOutbox)
    .values({ revision: state!.revision, user_id: userId })
    .onConflictDoUpdate({
      set: {
        requested_at: sql`now()`,
        revision: state!.revision,
      },
      target: ExploreRefreshOutbox.user_id,
    });
}

export async function ensureExploreState(
  database: TRPCContext["db"],
  userId: string,
) {
  let [state] = await database
    .select()
    .from(ExploreState)
    .where(eq(ExploreState.user_id, userId));
  if (!state) {
    await database
      .insert(ExploreState)
      .values({ user_id: userId })
      .onConflictDoNothing();
    [state] = await database
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, userId));
  }
  if (!state) throw new Error("Explore owner no longer exists");
  if (
    state.active_snapshot_id &&
    state.source_revision === state.published_revision
  ) {
    const [snapshot] = await database
      .select({ version: ExploreSnapshot.algorithm_version })
      .from(ExploreSnapshot)
      .where(
        and(
          eq(ExploreSnapshot.user_id, userId),
          eq(ExploreSnapshot.id, state.active_snapshot_id),
        ),
      );
    if (snapshot && snapshot.version !== ALGORITHM_VERSION) {
      const previous = state;
      const updated = await database.transaction(async (tx) => {
        const [next] = await tx
          .update(ExploreState)
          .set({
            dirty_at: sql`now()`,
            source_revision: sql`${ExploreState.source_revision} + 1`,
          })
          .where(
            and(
              eq(ExploreState.user_id, userId),
              eq(ExploreState.source_revision, previous.source_revision),
              eq(ExploreState.active_snapshot_id, previous.active_snapshot_id!),
            ),
          )
          .returning();
        if (next)
          await tx
            .insert(ExploreRefreshOutbox)
            .values({ revision: next.source_revision, user_id: userId })
            .onConflictDoUpdate({
              set: {
                dispatched_at: null,
                requested_at: sql`now()`,
                revision: next.source_revision,
              },
              target: ExploreRefreshOutbox.user_id,
            });
        return next;
      });
      if (updated) state = updated;
      else
        [state] = await database
          .select()
          .from(ExploreState)
          .where(eq(ExploreState.user_id, userId));
    }
  }
  if (!state) throw new Error("Explore owner no longer exists");
  return state;
}

/** Always acquire before locking documents: publication takes the same owner lock. */
export async function lockExploreOwner(tx: TRPCContext["db"], userId: string) {
  await tx
    .insert(ExploreState)
    .values({ user_id: userId })
    .onConflictDoNothing();
  await tx
    .select({ id: ExploreState.user_id })
    .from(ExploreState)
    .where(eq(ExploreState.user_id, userId))
    .for("update");
}
