import { randomUUID } from "node:crypto";
import { eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
  ExploreCluster,
  ExploreClusterLineage,
  ExploreRefreshOutbox,
  ExploreSnapshot,
  ExploreState,
  Page,
  user,
} from "@acme/db/schema";
import { afterEach, expect, test, vi } from "vitest";
import { lockExploreOwner, markExploreDirty } from "../src/explore/refresh";
import { listClusterMembers, listClusters } from "../src/explore/service";
import { refreshExploreSnapshot } from "../src/explore/snapshots";

vi.mock("../src/explore/dispatch", () => ({ dispatchExploreRefresh: vi.fn() }));
// biome-ignore lint/style/noProcessEnv: disposable database fixtures are explicitly opt-in.
const integration = test.skipIf(process.env.EXPLORE_DB_TESTS !== "1");
const owners: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const id of owners.splice(0))
    await db.delete(user).where(eq(user.id, id));
}, 30000);
async function fixture() {
  const owner = `explore-race-${randomUUID()}`;
  owners.push(owner);
  const documents = [randomUUID(), randomUUID()];
  const block = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      email: `${owner}@example.invalid`,
      id: owner,
      name: "Concurrency fixture",
    });
    await tx
      .insert(Document)
      .values(documents.map((id) => ({ id, user_id: owner })));
    await tx.insert(Page).values(
      documents.map((id, i) => ({
        document_id: id,
        title: `Race note ${i}`,
        user_id: owner,
      })),
    );
    await tx.insert(BlockNode).values({
      data: { type: "paragraph" },
      document_id: documents[0]!,
      id: block,
      user_id: owner,
    });
    await tx.insert(BlockSearchText).values({
      block_id: block,
      document_id: documents[0]!,
      search_text: "Supporting race passage",
      user_id: owner,
    });
    await tx.insert(DocumentReference).values({
      occurrence_path: "/0",
      presentation: "link",
      source_block_id: block,
      source_document_id: documents[0]!,
      target_document_id: documents[1]!,
      target_key: `document:${documents[1]}`,
      target_kind: "document",
      user_id: owner,
    });
    await markExploreDirty(tx, owner);
  });
  return { documents, owner };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
/** Pauses after an actual consistent DB read; the worker's production fencing logic remains unchanged. */
function pauseFirstInput() {
  const read = deferred();
  const resume = deferred();
  const original = db.transaction.bind(db);
  let paused = false;
  vi.spyOn(db, "transaction").mockImplementation((async (callback, config) => {
    const result = await original(callback, config);
    if (config?.isolationLevel === "repeatable read" && !paused) {
      paused = true;
      read.resolve();
      await resume.promise;
    }
    return result;
  }) as typeof db.transaction);
  return { read: read.promise, resume: resume.resolve };
}
integration(
  "an edit committed during calculation keeps the last snapshot and retries the newest revision",
  async () => {
    const { owner } = await fixture();
    await refreshExploreSnapshot(owner);
    await db.transaction((tx) => markExploreDirty(tx, owner));
    const gate = pauseFirstInput();
    const worker = refreshExploreSnapshot(owner);
    await gate.read;
    const [before] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    expect((await listClusters(db, owner, { limit: 12 })).items).toHaveLength(
      1,
    );
    await db.transaction(async (tx) => {
      await lockExploreOwner(tx, owner);
      await tx
        .delete(DocumentReference)
        .where(eq(DocumentReference.user_id, owner));
      await markExploreDirty(tx, owner);
    });
    gate.resume();
    expect(await worker).toBe("dirty");
    const [after] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    expect(after?.active_snapshot_id).toBe(before?.active_snapshot_id);
    expect(after?.source_revision).toBe(3);
    expect(await refreshExploreSnapshot(owner)).toBe("published");
    expect((await listClusters(db, owner, { limit: 12 })).total).toBe(0);
  },
  30000,
);
integration(
  "a paused expired worker cannot overwrite its successor or clear the successor lease",
  async () => {
    const { owner } = await fixture();
    const gate = pauseFirstInput();
    const stale = refreshExploreSnapshot(owner);
    await gate.read;
    expect(await refreshExploreSnapshot(owner)).toBe("busy");
    await db
      .update(ExploreState)
      .set({ lease_until: sql`now() - interval '1 second'` })
      .where(eq(ExploreState.user_id, owner));
    expect(await refreshExploreSnapshot(owner)).toBe("published");
    const [published] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    const successorToken = randomUUID();
    await db
      .update(ExploreState)
      .set({
        lease_token: successorToken,
        lease_until: sql`now() + interval '1 minute'`,
      })
      .where(eq(ExploreState.user_id, owner));
    gate.resume();
    expect(await stale).toBe("superseded");
    const [final] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    expect(final?.active_snapshot_id).toBe(published?.active_snapshot_id);
    expect(final?.lease_token).toBe(successorToken);
    expect(
      await db
        .select()
        .from(ExploreSnapshot)
        .where(eq(ExploreSnapshot.user_id, owner)),
    ).toHaveLength(1);
  },
  30000,
);
integration(
  "concurrent transactions serialize revisions and competing retries publish once",
  async () => {
    const { owner } = await fixture();
    await Promise.all(
      Array.from({ length: 4 }, () =>
        db.transaction(async (tx) => {
          await lockExploreOwner(tx, owner);
          await markExploreDirty(tx, owner);
        }),
      ),
    );
    const [state] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    expect(state?.source_revision).toBe(5);
    const results = await Promise.all([
      refreshExploreSnapshot(owner),
      refreshExploreSnapshot(owner),
      refreshExploreSnapshot(owner),
    ]);
    expect(results.filter((r) => r === "published")).toHaveLength(1);
    expect(await refreshExploreSnapshot(owner)).toBe("current");
    expect(
      await db
        .select()
        .from(ExploreSnapshot)
        .where(eq(ExploreSnapshot.user_id, owner)),
    ).toHaveLength(1);
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
  "a failed publication rolls back all rows and preserves the view and retry request",
  async () => {
    const { owner } = await fixture();
    await refreshExploreSnapshot(owner);
    await db.transaction((tx) => markExploreDirty(tx, owner));
    const [before] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    const original = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementation((async (callback, config) =>
      original(async (tx) => {
        const result = await callback(tx);
        if (result === "published")
          throw new Error("injected failure before commit");
        return result;
      }, config)) as typeof db.transaction);
    await expect(refreshExploreSnapshot(owner)).rejects.toThrow(
      "injected failure",
    );
    vi.restoreAllMocks();
    const [failed] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    expect(failed?.active_snapshot_id).toBe(before?.active_snapshot_id);
    expect(failed?.lease_token).toBeNull();
    expect(
      await db
        .select()
        .from(ExploreSnapshot)
        .where(eq(ExploreSnapshot.user_id, owner)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(ExploreRefreshOutbox)
        .where(eq(ExploreRefreshOutbox.user_id, owner)),
    ).toHaveLength(1);
    expect(await refreshExploreSnapshot(owner)).toBe("published");
  },
  30000,
);
integration(
  "removed references disappear from retained snapshot evidence immediately",
  async () => {
    const { owner } = await fixture();
    await refreshExploreSnapshot(owner);
    const clusters = await listClusters(db, owner, { limit: 12 });
    const clusterId = clusters.items[0]!.id;
    const first = await listClusterMembers(db, owner, {
      clusterId,
      limit: 1,
      role: "primary",
    });
    expect(first.items[0]?.evidence).toHaveLength(1);
    await db.transaction(async (tx) => {
      await lockExploreOwner(tx, owner);
      await tx
        .delete(DocumentReference)
        .where(eq(DocumentReference.user_id, owner));
      await markExploreDirty(tx, owner);
    });
    const retained = await listClusterMembers(db, owner, {
      clusterId,
      limit: 1,
      role: "primary",
    });
    expect(retained.total).toBe(2);
    expect(retained.items[0]?.evidence).toEqual([]);
    await refreshExploreSnapshot(owner);
    expect((await listClusters(db, owner, { limit: 12 })).total).toBe(0);
  },
  30000,
);
integration(
  "real split and merge publications retain identity, manual names, and typed lineage",
  async () => {
    const { owner, documents } = await fixture();
    const added = Array.from({ length: 4 }, () => randomUUID());
    const all = [...documents, ...added];
    const blockIds = all.map(() => randomUUID());
    await db.transaction(async (tx) => {
      await lockExploreOwner(tx, owner);
      await tx
        .insert(Document)
        .values(added.map((id) => ({ id, user_id: owner })));
      await tx.insert(Page).values(
        added.map((id) => ({
          document_id: id,
          title: "Lineage fixture",
          user_id: owner,
        })),
      );
      await tx.insert(BlockNode).values(
        all.map((id, i) => ({
          data: { type: "paragraph" },
          document_id: id,
          id: blockIds[i]!,
          user_id: owner,
        })),
      );
      await tx
        .delete(DocumentReference)
        .where(eq(DocumentReference.user_id, owner));
      await markExploreDirty(tx, owner);
    });
    async function replaceReferences(split: boolean) {
      await db.transaction(async (tx) => {
        await lockExploreOwner(tx, owner);
        await tx
          .delete(DocumentReference)
          .where(eq(DocumentReference.user_id, owner));
        const rows: (typeof DocumentReference.$inferInsert)[] = [];
        for (let i = 0; i < all.length; i++)
          for (let j = i + 1; j < all.length; j++) {
            if (split && Math.floor(i / 3) !== Math.floor(j / 3)) continue;
            rows.push({
              occurrence_path: `/target-${j}`,
              presentation: "link",
              source_block_id: blockIds[i]!,
              source_document_id: all[i]!,
              target_document_id: all[j]!,
              target_key: `document:${all[j]}`,
              target_kind: "document",
              user_id: owner,
            });
          }
        await tx.insert(DocumentReference).values(rows);
        await markExploreDirty(tx, owner);
      });
      expect(await refreshExploreSnapshot(owner)).toBe("published");
    }
    await replaceReferences(false);
    const original = (await listClusters(db, owner, { limit: 12 })).items[0]!
      .id;
    await db
      .update(ExploreCluster)
      .set({ manual_name: "Protected user name" })
      .where(eq(ExploreCluster.id, original));
    await replaceReferences(true);
    const split = await listClusters(db, owner, { limit: 12 });
    expect(split.total).toBe(2);
    expect(split.items.find((c) => c.id === original)?.name).toBe(
      "Protected user name",
    );
    const child = split.items.find((c) => c.id !== original)!.id;
    const splitHistory = await db
      .select()
      .from(ExploreClusterLineage)
      .where(eq(ExploreClusterLineage.user_id, owner));
    expect(splitHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from_id: original,
          kind: "split",
          to_id: child,
        }),
      ]),
    );
    await replaceReferences(false);
    const merged = await listClusters(db, owner, { limit: 12 });
    expect(merged.total).toBe(1);
    const survivor = merged.items[0]!.id;
    const retired = survivor === original ? child : original;
    const history = await db
      .select()
      .from(ExploreClusterLineage)
      .where(eq(ExploreClusterLineage.user_id, owner));
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from_id: retired,
          kind: "merge",
          to_id: survivor,
        }),
      ]),
    );
    expect(history.every((row) => row.source_revision > 0)).toBe(true);
    const protectedIdentity = await db
      .select()
      .from(ExploreCluster)
      .where(eq(ExploreCluster.id, original));
    expect(protectedIdentity[0]?.manual_name).toBe("Protected user name");
  },
  60000,
);

integration(
  "a current worker consumes a satisfied request recreated after publication",
  async () => {
    const { owner } = await fixture();
    expect(await refreshExploreSnapshot(owner)).toBe("published");
    const [state] = await db
      .select()
      .from(ExploreState)
      .where(eq(ExploreState.user_id, owner));
    await db
      .insert(ExploreRefreshOutbox)
      .values({ revision: state!.published_revision, user_id: owner });
    expect(await refreshExploreSnapshot(owner)).toBe("current");
    expect(
      await db
        .select()
        .from(ExploreRefreshOutbox)
        .where(eq(ExploreRefreshOutbox.user_id, owner)),
    ).toHaveLength(0);
    await db.transaction((tx) => markExploreDirty(tx, owner));
    const [pending] = await db
      .select()
      .from(ExploreRefreshOutbox)
      .where(eq(ExploreRefreshOutbox.user_id, owner));
    expect(pending!.revision).toBe(state!.published_revision + 1);
    expect(await refreshExploreSnapshot(owner)).toBe("published");
  },
  30000,
);
