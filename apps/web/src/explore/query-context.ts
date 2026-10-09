import { and, eq, inArray } from "@acme/db";
import {
  Document,
  ExploreRefreshOutbox,
  ExploreSnapshot,
  JournalEntry,
  Page,
} from "@acme/db/schema";
import { TRPCError } from "@trpc/server";
import { dispatchExploreRefresh } from "~/explore/dispatch";
import type { TRPCContext } from "~/trpc/trpc";
import { decodeExploreCursor } from "./cursor";
import { ensureExploreState } from "./refresh";

export type Database = TRPCContext["db"];
export type ExploreInput = { cursor?: string; limit: number };

export async function exploreContext(
  database: Database,
  userId: string,
  cursor: string | undefined,
  scope: string,
  requestedSnapshot?: string,
) {
  const state = await ensureExploreState(database, userId);
  if (state.published_revision < state.source_revision) {
    await database
      .insert(ExploreRefreshOutbox)
      .values({ revision: state.source_revision, user_id: userId })
      .onConflictDoNothing();
    await dispatchExploreRefresh(userId);
  }
  let decoded: ReturnType<typeof decodeExploreCursor>;
  try {
    decoded = decodeExploreCursor(cursor, userId, scope);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid exploration cursor",
    });
  }
  if (decoded && requestedSnapshot && decoded.snapshot !== requestedSnapshot)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Snapshot cursor mismatch",
    });
  const snapshotId = decoded
    ? decoded.snapshot
    : (requestedSnapshot ?? state.active_snapshot_id);
  if (snapshotId) {
    const [snapshot] = await database
      .select()
      .from(ExploreSnapshot)
      .where(
        and(
          eq(ExploreSnapshot.id, snapshotId),
          eq(ExploreSnapshot.user_id, userId),
        ),
      )
      .limit(1);
    if (!snapshot)
      return {
        decoded,
        restartRequired: true,
        revision: state.published_revision,
        snapshotId: null,
        state,
      };
    return {
      decoded,
      restartRequired: false,
      revision: snapshot.source_revision,
      snapshotId,
      state,
    };
  }
  return {
    decoded,
    restartRequired: false,
    revision: state.published_revision,
    snapshotId,
    state,
  };
}
export function metadata(context: Awaited<ReturnType<typeof exploreContext>>) {
  return {
    refreshing:
      context.state.source_revision > context.state.published_revision,
    restartRequired: context.restartRequired,
    revision: context.revision,
    snapshotId: context.snapshotId,
  };
}

export async function loadNotes(
  database: Database,
  userId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = await database
    .select({
      date: JournalEntry.date,
      id: Document.id,
      pageId: Page.id,
      pageTitle: Page.title,
      updatedAt: Document.updated_at,
    })
    .from(Document)
    .leftJoin(
      Page,
      and(eq(Page.document_id, Document.id), eq(Page.user_id, userId)),
    )
    .leftJoin(
      JournalEntry,
      and(
        eq(JournalEntry.document_id, Document.id),
        eq(JournalEntry.user_id, userId),
      ),
    )
    .where(and(eq(Document.user_id, userId), inArray(Document.id, ids)));
  return rows
    .filter((r) => r.pageId || r.date)
    .map((r) => ({
      href: r.pageId ? `/pages/${r.pageId}` : `/journal/${r.date}`,
      id: r.id,
      kind: r.pageId ? ("page" as const) : ("journal" as const),
      title: r.pageTitle ?? r.date!,
      updatedAt: r.updatedAt,
    }));
}
