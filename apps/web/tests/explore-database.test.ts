import { randomUUID } from "node:crypto";
import { and, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
  ExploreCluster,
  ExploreClusterLineage,
  ExploreClusterMember,
  ExploreClusterSnapshot,
  ExploreRefreshOutbox,
  ExploreSnapshot,
  ExploreState,
  Page,
  user,
} from "@acme/db/schema";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { markExploreDirty } from "../src/explore/refresh";
import {
  getCluster,
  getClusterMap,
  listClusterMembers,
  listClusterSources,
  listClusters,
  listRecentNotes,
  listSourceContexts,
} from "../src/explore/service";
import { refreshExploreSnapshot } from "../src/explore/snapshots";

vi.mock("../src/explore/dispatch", () => ({
  dispatchExploreRefresh: vi.fn(),
}));
// biome-ignore lint/style/noProcessEnv: explicit opt-in for disposable live database fixtures, never an application feature flag.
const databaseTestsEnabled = process.env.EXPLORE_DB_TESTS === "1";
const integration = test.skipIf(!databaseTestsEnabled);
const owner = `explore-test-${randomUUID()}`;
const other = `explore-test-${randomUUID()}`;
const ids = Array.from({ length: 4 }, () => randomUUID());
const blocks = ids.map(() => randomUUID());
const sourceKey = "external:test-resource";
let clusterId = "";
let originalSnapshot = "";
beforeAll(async () => {
  if (!databaseTestsEnabled) return;
  await db.transaction(async (tx) => {
    await tx.insert(user).values(
      [owner, other].map((id) => ({
        email: `${id}@example.invalid`,
        id,
        name: "Explore integration fixture",
      })),
    );
    await tx.insert(Document).values(ids.map((id) => ({ id, user_id: owner })));
    await tx.insert(Page).values(
      ids.map((id, i) => ({
        document_id: id,
        title: i === 0 ? "Testing threads" : `Fixture note ${i}`,
        user_id: owner,
      })),
    );
    await tx.insert(BlockNode).values(
      blocks.map((id, i) => ({
        data: {
          content: [{ text: "A supporting passage", type: "text" }],
          type: "paragraph",
        },
        document_id: ids[i]!,
        id,
        user_id: owner,
      })),
    );
    await tx.insert(BlockSearchText).values(
      blocks.map((id, i) => ({
        block_id: id,
        document_id: ids[i]!,
        search_text: "A supporting passage",
        user_id: owner,
      })),
    );
    await tx.insert(DocumentReference).values([
      {
        occurrence_path: "/0",
        presentation: "link",
        source_block_id: blocks[0]!,
        source_document_id: ids[0]!,
        target_block_id: blocks[1]!,
        target_document_id: ids[1]!,
        target_key: `document:${ids[1]}#block:${blocks[1]}`,
        target_kind: "document",
        user_id: owner,
      },
      {
        occurrence_path: "/1",
        presentation: "card",
        source_block_id: blocks[0]!,
        source_document_id: ids[0]!,
        target_key: sourceKey,
        target_kind: "external",
        target_url: "https://example.com/resource",
        user_id: owner,
      },
    ]);
    await markExploreDirty(tx, owner);
  });
}, 30000);
afterAll(async () => {
  if (databaseTestsEnabled)
    await db.delete(user).where(sql`${user.id} in (${owner}, ${other})`);
}, 30000);

integration(
  "publishes an atomic snapshot, retries idempotently, and keeps block-reference edges",
  async () => {
    expect(await refreshExploreSnapshot(owner)).toBe("published");
    expect(await refreshExploreSnapshot(owner)).toBe("current");
    const threads = await listClusters(db, owner, { limit: 12 });
    expect(threads.items).toHaveLength(1);
    expect(threads.items[0]?.primaryCount).toBe(2);
    expect(threads.refreshing).toBe(false);
    clusterId = threads.items[0]!.id;
    originalSnapshot = threads.snapshotId!;
    const map = await getClusterMap(db, owner, clusterId);
    expect(
      map.graph.edges.find((edge) => edge.toKey === `document:${ids[1]}`)
        ?.sources[0]?.excerpt,
    ).toBe("A supporting passage");
    const resources = await listClusterSources(db, owner, {
      clusterId,
      limit: 20,
    });
    expect(resources.items[0]?.documentCount).toBe(1);
    const contexts = await listSourceContexts(db, owner, {
      clusterId,
      key: sourceKey,
      limit: 20,
    });
    expect(contexts.items[0]?.href).toContain(`#block=${blocks[0]}`);
  },
  30000,
);
integration(
  "server pagination visits every note exactly once and rejects other owners",
  async () => {
    const first = await listClusterMembers(db, owner, {
      clusterId,
      limit: 1,
      role: "primary",
    });
    expect(first.items[0]?.evidence.length).toBeGreaterThan(0);
    expect(first.items[0]?.evidence[0]?.excerpt).toBe("A supporting passage");
    const second = await listClusterMembers(db, owner, {
      clusterId,
      cursor: first.nextCursor,
      limit: 1,
      role: "primary",
    });
    expect(
      new Set([...first.items, ...second.items].map((n) => n.id)).size,
    ).toBe(2);
    expect(second.nextCursor).toBeUndefined();
    await expect(
      listClusterMembers(db, other, {
        clusterId,
        cursor: first.nextCursor,
        limit: 1,
        role: "primary",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(getCluster(db, other, clusterId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await getClusterMap(db, other, clusterId)).graph.nodes).toEqual([]);
    const unlinked = await listRecentNotes(db, owner, {
      limit: 1,
      sort: "latest",
      unlinkedOnly: true,
    });
    expect(unlinked.total).toBe(2);
    expect(unlinked.nextCursor).toBeDefined();
  },
  30000,
);
integration(
  "ownership and one-primary-membership constraints reject corrupt writes",
  async () => {
    await expect(
      db.insert(ExploreClusterMember).values({
        cluster_id: clusterId,
        document_id: ids[2]!,
        role: "primary",
        snapshot_id: originalSnapshot,
        user_id: other,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(ExploreClusterMember).values({
        cluster_id: clusterId,
        document_id: ids[0]!,
        role: "primary",
        snapshot_id: originalSnapshot,
        user_id: owner,
      }),
    ).rejects.toThrow();
  },
  30000,
);
integration(
  "rollback cannot enqueue a refresh or advance the revision",
  async () => {
    const [before] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    await expect(
      db.transaction(async (tx) => {
        await markExploreDirty(tx, owner);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    const [after] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    expect(after?.source_revision).toBe(before?.source_revision);
    expect(
      await db
        .select()
        .from(ExploreRefreshOutbox)
        .where(eq(ExploreRefreshOutbox.user_id, owner)),
    ).toEqual([]);
  },
  30000,
);
integration(
  "leased owners reject duplicate workers and expired leases recover",
  async () => {
    await db.transaction(async (tx) => {
      await markExploreDirty(tx, owner);
      await tx
        .update(ExploreState)
        .set({
          lease_token: randomUUID(),
          lease_until: sql`now() + interval '1 minute'`,
        })
        .where(eq(ExploreState.user_id, owner));
    });
    expect(await refreshExploreSnapshot(owner)).toBe("busy");
    await db
      .update(ExploreState)
      .set({ lease_until: sql`now() - interval '1 second'` })
      .where(eq(ExploreState.user_id, owner));
    expect(await refreshExploreSnapshot(owner)).toBe("published");
    const summary = await getCluster(db, owner, clusterId);
    expect(summary.summary?.id).toBe(clusterId);
  },
  30000,
);
integration(
  "manual names survive refresh and expired cursors request a restart",
  async () => {
    await db
      .update(ExploreCluster)
      .set({ manual_name: "My chosen name" })
      .where(
        and(
          eq(ExploreCluster.id, clusterId),
          eq(ExploreCluster.user_id, owner),
        ),
      );
    const oldPage = await listClusterMembers(db, owner, {
      clusterId,
      limit: 1,
      role: "primary",
    });
    await db.transaction(async (tx) => {
      await markExploreDirty(tx, owner);
    });
    await refreshExploreSnapshot(owner);
    expect((await getCluster(db, owner, clusterId)).summary?.name).toBe(
      "My chosen name",
    );
    await db
      .delete(ExploreSnapshot)
      .where(
        and(
          eq(ExploreSnapshot.user_id, owner),
          eq(ExploreSnapshot.id, oldPage.snapshotId!),
        ),
      );
    const expired = await listClusterMembers(db, owner, {
      clusterId,
      cursor: oldPage.nextCursor,
      limit: 1,
      role: "primary",
    });
    expect(expired.restartRequired).toBe(true);
    expect(expired.items).toEqual([]);
  },
  30000,
);
integration(
  "retired identities resolve through multiple generations without crossing owners",
  async () => {
    const ancestor = randomUUID();
    const intermediate = randomUUID();
    await db.insert(ExploreCluster).values([
      { id: ancestor, retired_at: new Date().toISOString(), user_id: owner },
      {
        id: intermediate,
        retired_at: new Date().toISOString(),
        user_id: owner,
      },
    ]);
    await db.insert(ExploreClusterLineage).values([
      { from_id: ancestor, to_id: intermediate, user_id: owner },
      { from_id: intermediate, to_id: clusterId, user_id: owner },
      { from_id: intermediate, to_id: ancestor, user_id: owner },
    ]);
    expect((await getCluster(db, owner, ancestor)).successors).toEqual([
      { id: clusterId, name: "My chosen name" },
    ]);
    await expect(getCluster(db, other, ancestor)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  },
  30000,
);
integration(
  "retired threads paginate every successor with exact counts",
  async () => {
    const ancestor = randomUUID();
    const successors = Array.from({ length: 26 }, () => randomUUID());
    const [state] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    await db
      .insert(ExploreCluster)
      .values([ancestor, ...successors].map((id) => ({ id, user_id: owner })));
    await db.insert(ExploreClusterSnapshot).values(
      successors.map((id, i) => ({
        cluster_id: id,
        generated_name: `Successor ${i}`,
        primary_count: 0,
        related_count: 0,
        representatives: [],
        snapshot_id: state!.active_snapshot_id!,
        source_count: 0,
        user_id: owner,
      })),
    );
    await db.insert(ExploreClusterLineage).values(
      successors.map((id) => ({
        from_id: ancestor,
        kind: "split" as const,
        to_id: id,
        user_id: owner,
      })),
    );
    const first = await getCluster(db, owner, ancestor);
    expect(first.successorTotal).toBe(26);
    expect(first.successors).toHaveLength(24);
    expect(first.nextSuccessorCursor).toBeTruthy();
    // Future seed and recursive transitions must not alter a cursor's snapshot.
    await db.insert(ExploreClusterLineage).values([
      {
        from_id: ancestor,
        kind: "merge",
        source_revision: first.revision + 1,
        to_id: clusterId,
        user_id: owner,
      },
      {
        from_id: successors[0]!,
        kind: "merge",
        source_revision: first.revision + 1,
        to_id: clusterId,
        user_id: owner,
      },
    ]);
    const second = await getCluster(
      db,
      owner,
      ancestor,
      first.nextSuccessorCursor,
    );
    expect(second.successorTotal).toBe(26);
    expect(second.successors).toHaveLength(2);
    expect(second.nextSuccessorCursor).toBeUndefined();
    expect(
      new Set([...first.successors, ...second.successors].map((s) => s.id))
        .size,
    ).toBe(26);
  },
  30000,
);
integration(
  "document deletion clears memberships and authored evidence on refresh",
  async () => {
    await db.transaction(async (tx) => {
      await tx
        .delete(Document)
        .where(and(eq(Document.user_id, owner), eq(Document.id, ids[1]!)));
      await markExploreDirty(tx, owner);
    });
    await refreshExploreSnapshot(owner);
    const threads = await listClusters(db, owner, { limit: 12 });
    expect(threads.items).toEqual([]);
    expect((await getCluster(db, owner, clusterId)).summary).toBeNull();
    expect(
      await db
        .select()
        .from(ExploreClusterSnapshot)
        .where(
          and(
            eq(ExploreClusterSnapshot.user_id, owner),
            eq(ExploreClusterSnapshot.snapshot_id, threads.snapshotId!),
          ),
        ),
    ).toEqual([]);
  },
  30000,
);
