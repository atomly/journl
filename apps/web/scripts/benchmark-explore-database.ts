/**
 * Run in an isolated process: pnpm with-env jiti scripts/benchmark-explore-database.ts --run-disposable-fixture
 * Optional --queries=cluster-summary,source-contexts measures a subset against the same full fixture.
 */

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
  Page,
  user,
} from "@acme/db/schema";
import { createJiti } from "jiti";
import { markExploreDirty } from "../src/explore/refresh";
import { refreshExploreSnapshot } from "../src/explore/snapshots";

if (!process.argv.includes("--run-disposable-fixture")) {
  throw new Error(
    "Explicit --run-disposable-fixture required: creates and removes 10,000 notes and 100,000 references for one test owner.",
  );
}
const selectedQueriesArgument = process.argv.find((value) =>
  value.startsWith("--queries="),
);
const selectedQueries = selectedQueriesArgument
  ? new Set(selectedQueriesArgument.slice("--queries=".length).split(","))
  : undefined;
const supportedQueries = new Set([
  "database-roundtrip",
  "overview-first",
  "overview-next",
  "overview-search",
  "cluster-members",
  "cluster-sources",
  "thread-connections",
  "cluster-summary",
  "source-contexts",
  "cluster-map",
  "recent-notes",
  "unlinked-notes",
]);
if (
  selectedQueries &&
  [...selectedQueries].some((query) => !supportedQueries.has(query))
)
  throw new Error("Unknown benchmark query selection");
const loader = createJiti(import.meta.url, {
  alias: { "~": fileURLToPath(new URL("../src", import.meta.url)) },
});
const {
  getCluster,
  getClusterMap,
  listClusterMembers,
  listClusters,
  listClusterSources,
  listRecentNotes,
  listSourceContexts,
  listThreadConnections,
} = await loader.import<typeof import("../src/explore/service")>(
  "../src/explore/service",
);
const owner = `explore-performance-${randomUUID()}`;
const documents = Array.from({ length: 10000 }, () => randomUUID());
const blocks = documents.map(() => randomUUID());
const budgets = {
  peakRssMiB: 768,
  queryP95Milliseconds: 3000,
  responseBytes: 131072,
  workerMilliseconds: 120000,
};
const violations: string[] = [];
const latencySpikes: {
  query: string;
  sample: number;
  milliseconds: number;
  immediateRoundtripMilliseconds: number;
}[] = [];
const samplesPerQuery = 20;
const metrics: {
  query: string;
  firstCallMilliseconds: number;
  maxMilliseconds: number;
  p50Milliseconds: number;
  p95Milliseconds: number;
  maxResponseBytes: number;
}[] = [];
async function measure(query: string, run: () => Promise<unknown>) {
  if (
    selectedQueries &&
    !selectedQueries.has(query) &&
    query !== "database-roundtrip"
  )
    return;
  const milliseconds: number[] = [];
  let maxResponseBytes = 0;
  for (let i = 0; i < samplesPerQuery; i++) {
    const started = performance.now();
    const result = await run();
    const elapsed = performance.now() - started;
    milliseconds.push(elapsed);
    if (elapsed > budgets.queryP95Milliseconds) {
      const pingStarted = performance.now();
      await db.execute(sql`select 1 as health`);
      latencySpikes.push({
        immediateRoundtripMilliseconds: Math.round(
          performance.now() - pingStarted,
        ),
        milliseconds: Math.round(elapsed),
        query,
        sample: i,
      });
    }
    maxResponseBytes = Math.max(
      maxResponseBytes,
      Buffer.byteLength(JSON.stringify(result)),
    );
  }
  const firstCallMilliseconds = Math.round(milliseconds[0]!);
  milliseconds.sort((a, b) => a - b);
  const p95Milliseconds = Math.round(
    milliseconds[Math.ceil(samplesPerQuery * 0.95) - 1]!,
  );
  metrics.push({
    firstCallMilliseconds,
    maxMilliseconds: Math.round(milliseconds.at(-1)!),
    maxResponseBytes,
    p50Milliseconds: Math.round(
      milliseconds[Math.ceil(samplesPerQuery * 0.5) - 1]!,
    ),
    p95Milliseconds,
    query,
  });
  if (
    p95Milliseconds > budgets.queryP95Milliseconds ||
    maxResponseBytes > budgets.responseBytes
  )
    violations.push(
      `Budget exceeded for ${query}: ${p95Milliseconds} ms, ${maxResponseBytes} bytes`,
    );
}
let report: object | undefined;
let workerMilliseconds = 0;
let failure: unknown;
try {
  await db.insert(user).values({
    email: `${owner}@example.invalid`,
    id: owner,
    name: "Disposable performance fixture",
  });
  for (let offset = 0; offset < documents.length; offset += 2000) {
    await db.transaction(async (tx) => {
      const batch = documents.slice(offset, offset + 2000);
      await tx
        .insert(Document)
        .values(batch.map((id) => ({ id, user_id: owner })));
      await tx.insert(Page).values(
        batch.map((id, i) => ({
          document_id: id,
          title: `Project ${Math.floor((offset + i) / 20)}`,
          user_id: owner,
        })),
      );
      await tx.insert(BlockNode).values(
        batch.map((id, i) => ({
          data: { type: "paragraph" },
          document_id: id,
          id: blocks[offset + i]!,
          user_id: owner,
        })),
      );
      await tx.insert(BlockSearchText).values(
        batch.map((id, i) => ({
          block_id: blocks[offset + i]!,
          document_id: id,
          search_text:
            "A supporting project decision and its implementation context. ".repeat(
              8,
            ),
          user_id: owner,
        })),
      );
    });
  }
  const references: (typeof DocumentReference.$inferInsert)[] = [];
  for (let i = 0; i < documents.length; i++) {
    references.push({
      occurrence_path: "/popular",
      presentation: "link",
      source_block_id: blocks[i]!,
      source_document_id: documents[i]!,
      target_key: "external:popular-fixture",
      target_kind: "external",
      target_url: "https://example.invalid/common",
      user_id: owner,
    });
  }
  for (let start = 0; start < documents.length; start += 20) {
    let count = 0;
    for (let i = start; i < start + 20; i++)
      for (let j = i + 1; j < start + 20; j++) {
        if (count++ < 180 && !(i === start && j === start + 1))
          references.push({
            occurrence_path: `/note-${j}`,
            presentation: "link",
            source_block_id: blocks[i]!,
            source_document_id: documents[i]!,
            target_document_id: documents[j]!,
            target_key: `document:${documents[j]}`,
            target_kind: "document",
            user_id: owner,
          });
      }
  }
  for (let start = 0; start < documents.length; start += 20) {
    const target = documents[(start + 20) % documents.length]!;
    references.push({
      occurrence_path: "/bridge",
      presentation: "link",
      source_block_id: blocks[start]!,
      source_document_id: documents[start]!,
      target_document_id: target,
      target_key: `document:${target}`,
      target_kind: "document",
      user_id: owner,
    });
  }
  for (let offset = 0; offset < references.length; offset += 2000)
    await db
      .insert(DocumentReference)
      .values(references.slice(offset, offset + 2000));
  await db.transaction((tx) => markExploreDirty(tx, owner));
  const workerStarted = performance.now();
  const result = await refreshExploreSnapshot(owner);
  workerMilliseconds = Math.round(performance.now() - workerStarted);
  if (result !== "published" || workerMilliseconds > budgets.workerMilliseconds)
    throw new Error(
      `Worker result ${result}, runtime ${workerMilliseconds} ms`,
    );
  await measure("database-roundtrip", () =>
    db.execute(sql`select 1 as health`),
  );
  const plan = await db.execute(sql`explain (analyze, format json)
    select d.id, p.id, p.title, j.date from document d
    left join page p on p.document_id = d.id and p.user_id = ${owner}
    left join journal_entry j on j.document_id = d.id and j.user_id = ${owner}
    where d.user_id = ${owner} and d.id in (${sql.join(
      documents.slice(0, 36).map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`);
  type PlanNode = {
    "Node Type": string;
    "Relation Name"?: string;
    "Index Name"?: string;
    "Actual Rows"?: number;
    "Actual Loops"?: number;
    Plans?: PlanNode[];
  };
  const queryPlan = (
    plan[0]?.["QUERY PLAN"] as
      | { Plan: PlanNode; "Execution Time": number }[]
      | undefined
  )?.[0];
  const planNodes: object[] = [];
  const inspectPlan = (node: PlanNode) => {
    planNodes.push({
      index: node["Index Name"],
      loops: node["Actual Loops"],
      node: node["Node Type"],
      relation: node["Relation Name"],
      rows: node["Actual Rows"],
    });
    for (const child of node.Plans ?? []) inspectPlan(child);
  };
  if (queryPlan) inspectPlan(queryPlan.Plan);
  console.log(
    JSON.stringify({
      boundedNoteLoadPlan: planNodes,
      executionMilliseconds: queryPlan?.["Execution Time"],
    }),
  );
  const overview = await listClusters(db, owner, { limit: 12 });
  if (
    overview.total !== 500 ||
    overview.items.length !== 12 ||
    !overview.nextCursor
  )
    throw new Error(
      "Large fixture cluster counts or bounded overview incorrect",
    );
  const clusterId = overview.items[0]!.id;
  const map = await getClusterMap(db, owner, clusterId);
  if (map.graph.nodes.length > 30) throw new Error("Map exceeded node bound");
  await measure("overview-first", () => listClusters(db, owner, { limit: 12 }));
  await measure("overview-next", () =>
    listClusters(db, owner, { cursor: overview.nextCursor, limit: 12 }),
  );
  await measure("overview-search", () =>
    listClusters(db, owner, { limit: 12, search: "Project 2" }),
  );
  await measure("cluster-members", () =>
    listClusterMembers(db, owner, { clusterId, limit: 20, role: "primary" }),
  );
  await measure("cluster-sources", () =>
    listClusterSources(db, owner, { clusterId, limit: 20 }),
  );
  let capturedConnectionQuery: Parameters<typeof db.execute>[0] | undefined;
  const originalExecute = db.execute.bind(db);
  db.execute = ((query: Parameters<typeof db.execute>[0]) => {
    capturedConnectionQuery ??= query;
    return originalExecute(query);
  }) as typeof db.execute;
  const connections = await listThreadConnections(db, owner, {
    clusterId,
    limit: 1,
  });
  db.execute = originalExecute;
  if (capturedConnectionQuery) {
    const connectionExplain = await db.execute(
      sql`explain (analyze, format json) ${capturedConnectionQuery}`,
    );
    const root = (
      connectionExplain[0]?.["QUERY PLAN"] as
        | { Plan: PlanNode; "Execution Time": number; JIT?: unknown }[]
        | undefined
    )?.[0];
    planNodes.length = 0;
    if (root) inspectPlan(root.Plan);
    console.log(
      JSON.stringify({
        connectionPlan: planNodes,
        executionMilliseconds: root?.["Execution Time"],
        jit: root?.JIT,
      }),
    );
    if (root && root["Execution Time"] > 150)
      violations.push(
        `Connection server execution exceeded150ms: ${root["Execution Time"]}`,
      );
  }
  if (
    connections.total !== 2 ||
    connections.items.length !== 1 ||
    !connections.nextCursor
  )
    throw new Error("Authored thread bridge counts or pagination incorrect");
  await measure("thread-connections", () =>
    listThreadConnections(db, owner, { clusterId, limit: 20 }),
  );
  await measure("cluster-summary", () => getCluster(db, owner, clusterId));
  await measure("source-contexts", () =>
    listSourceContexts(db, owner, {
      clusterId,
      key: "external:popular-fixture",
      limit: 20,
    }),
  );
  await measure("cluster-map", () => getClusterMap(db, owner, clusterId));
  await measure("recent-notes", () =>
    listRecentNotes(db, owner, {
      limit: 20,
      sort: "latest",
      unlinkedOnly: false,
    }),
  );
  await measure("unlinked-notes", () =>
    listRecentNotes(db, owner, {
      limit: 20,
      sort: "latest",
      unlinkedOnly: true,
    }),
  );
  const peakRssMiB = Math.round(process.resourceUsage().maxRSS / 1024);
  if (peakRssMiB > budgets.peakRssMiB)
    throw new Error(`Peak RSS ${peakRssMiB} MiB exceeds budget`);
  if (violations.length) throw new Error(violations.join("; "));
  report = {
    budgets,
    clusters: overview.total,
    latencySpikes,
    metrics,
    notes: documents.length,
    peakRssMiB,
    references: references.length,
    samplesPerQuery,
    selectedQueries: selectedQueries ? [...selectedQueries] : undefined,
    violations,
    workerMilliseconds,
  };
} catch (error) {
  failure = error;
  report = {
    budgets,
    latencySpikes,
    metrics,
    notes: documents.length,
    peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    references: 100000,
    samplesPerQuery,
    selectedQueries: selectedQueries ? [...selectedQueries] : undefined,
    status: "failed",
    violations,
    workerMilliseconds,
  };
} finally {
  await db.delete(user).where(eq(user.id, owner));
}
if (report)
  console.log(JSON.stringify({ ...report, disposableOwnerRemoved: true }));
if (failure) throw failure;
process.exit(0);
