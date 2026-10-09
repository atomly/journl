import { expect, test } from "vitest";
import {
  buildClusters,
  type ClusterNote,
  type ClusterReference,
  clusterLineage,
  matchClusterIdentities,
} from "../src/explore/clustering";

const note = (id: string): ClusterNote => ({
  href: `/pages/${id}`,
  id,
  kind: "page",
  title: id,
  updatedAt: "2026-10-08T00:00:00Z",
});
const direct = (source: string, target: string): ClusterReference => ({
  id: `${source}:${target}`,
  source,
  target,
});
const source = (from: string, key: string): ClusterReference => ({
  id: `${from}:${key}`,
  source: from,
  sourceKey: key,
  url: `https://example.com/${key}`,
});
const groups = (references: ClusterReference[], ids = ["a", "b", "c", "d"]) =>
  buildClusters(ids.map(note), references);

test("independent projects sharing one generic source remain separate", () => {
  const result = groups([
    direct("a", "b"),
    direct("c", "d"),
    ...["a", "b", "c", "d"].map((id) => source(id, "docs")),
  ]);
  expect(result.map((c) => c.primaryDocumentIds)).toEqual([
    ["a", "b"],
    ["c", "d"],
  ]);
  expect(result.map((c) => c.sources[0]?.documentCount)).toEqual([2, 2]);
});
test("one shared source is insufficient, two specific shared sources can group notes", () => {
  expect(groups([source("a", "one"), source("b", "one")])).toEqual([]);
  expect(
    groups([
      source("a", "one"),
      source("b", "one"),
      source("a", "two"),
      source("b", "two"),
    ]).map((c) => c.primaryDocumentIds),
  ).toEqual([["a", "b"]]);
});
test("repeated URLs and references do not change membership, sources count distinct notes", () => {
  const refs = [direct("a", "b"), source("a", "one"), source("b", "one")];
  expect(groups([...refs, ...refs, ...refs])).toEqual(groups(refs));
});
test("self links and inaccessible targets cannot produce clusters", () => {
  expect(groups([direct("a", "a"), direct("a", "not-owned")])).toEqual([]);
});
test("input order does not alter deterministic membership", () => {
  const refs = [direct("a", "b"), direct("c", "d"), direct("b", "c")];
  expect(groups([...refs].reverse(), ["d", "c", "b", "a"])).toEqual(
    groups(refs),
  );
});
test("bridge deletion splits a thread and strongest overlap preserves identity", () => {
  const previous = [
    { id: "old", members: ["a", "b", "c", "d"], name: "My project" },
  ];
  const result = groups([direct("a", "b"), direct("c", "d")]);
  const matched = matchClusterIdentities(result, previous);
  expect([...matched.assigned.values()].map((c) => c.id)).toEqual(["old"]);
  expect(matched.overlaps).toHaveLength(2);
});
test("unrelated additions preserve cluster identities", () => {
  const before = groups([direct("a", "b")]);
  const after = groups([direct("a", "b"), direct("c", "d")]);
  expect(
    matchClusterIdentities(after, [
      {
        id: "saved",
        members: before[0]!.primaryDocumentIds,
        name: "saved name",
      },
    ]).assigned.get(0)?.id,
  ).toBe("saved");
});
test("large popular sources do not connect unrelated notes", () => {
  const ids = Array.from(
    { length: 10000 },
    (_, i) => `note-${String(i).padStart(5, "0")}`,
  );
  const result = groups(
    ids.map((id) => source(id, "popular")),
    ids,
  );
  expect(result).toEqual([]);
});
test("journal-only groups use an honest date name", () => {
  const notes = [note("a"), note("b")].map((n) => ({
    ...n,
    kind: "journal" as const,
    title: "2026-10-08",
  }));
  expect(buildClusters(notes, [direct("a", "b")])[0]?.generatedName).toBe(
    "Notes around October 2026",
  );
});
test("related membership requires multiple distinct members and retains authored evidence", () => {
  // Dense groups keep the bridge note in its primary project while exposing another thread.
  const first = ["a", "b", "c", "d", "e"];
  const second = ["v", "w", "x", "y", "z"];
  const refs: ClusterReference[] = [];
  for (const ids of [first, second])
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        refs.push(direct(ids[i]!, ids[j]!));
  refs.push(direct("a", "v"), direct("a", "w"));
  const result = groups(refs, [...first, ...second]);
  const other = result.find((c) => c.primaryDocumentIds.includes("v"));
  expect(other?.primaryDocumentIds).not.toContain("a");
  expect(other?.related).toContainEqual({
    documentId: "a",
    evidenceIds: ["a:v", "a:w"],
  });
});

test("lineage records a surviving parent's split branch and both sides of a merge", () => {
  expect(
    clusterLineage(
      [
        { next: 0, old: 0, score: 0.5 },
        { next: 1, old: 0, score: 0.5 },
      ],
      ["old"],
      ["old", "child"],
    ),
  ).toEqual([{ from_id: "old", kind: "split", to_id: "child" }]);
  expect(
    clusterLineage(
      [
        { next: 0, old: 0, score: 0.5 },
        { next: 0, old: 1, score: 0.5 },
      ],
      ["old", "other"],
      ["old"],
    ),
  ).toEqual([{ from_id: "other", kind: "merge", to_id: "old" }]);
});

test("related evidence retains witnesses for distinct members even with repeated occurrences", () => {
  const first = ["a", "b", "c", "d", "e"];
  const second = ["v", "w", "x", "y", "z"];
  const refs: ClusterReference[] = [];
  for (const ids of [first, second])
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        refs.push(direct(ids[i]!, ids[j]!));
  refs.push(
    ...Array.from({ length: 20 }, (_, i) => ({
      ...direct("a", "v"),
      id: `00-${i}`,
    })),
    { ...direct("a", "w"), id: "99-w" },
  );
  const group = buildClusters([...first, ...second].map(note), refs).find((c) =>
    c.primaryDocumentIds.includes("v"),
  );
  const evidence = group?.related.find(
    (r) => r.documentId === "a",
  )?.evidenceIds;
  expect(evidence).toContain("99-w");
  expect(evidence).toHaveLength(2);
});
