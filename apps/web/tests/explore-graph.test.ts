import { expect, test } from "vitest";
import {
  type ExploreEdge,
  type ExploreNode,
  getNoteClusters,
  layoutExploreGraph,
  mergeGraphPages,
} from "../src/references/explore-graph";

const note = (id: string): ExploreNode => ({
  key: id,
  kind: "page",
  target: { documentId: id, kind: "document" },
  title: id,
});
const edge = (
  fromKey: string,
  toKey: string,
  ids = [`${fromKey}-${toKey}`],
): ExploreEdge => ({
  fromKey,
  occurrenceCount: ids.length,
  occurrenceIds: ids,
  presentations: ["link"],
  sourceBlocks: [`block-${fromKey}`],
  sources: [
    {
      blockId: `block-${fromKey}`,
      excerpt: `Context from ${fromKey}`,
      href: `/pages/${fromKey}#block=block-${fromKey}`,
    },
  ],
  toKey,
});

test("overlapping graph pages merge each relationship without inflating its reference count", () => {
  const merged = mergeGraphPages([
    {
      edges: [edge("a", "b", ["1", "2"])],
      nextCursor: "next",
      nodes: [note("a"), note("b")],
      truncated: true,
    },
    {
      edges: [edge("a", "b", ["2", "3"]), edge("b", "c")],
      nextCursor: null,
      nodes: [note("b"), note("c")],
      truncated: false,
    },
  ]);
  expect(merged.nodes).toHaveLength(3);
  expect(merged.edges).toHaveLength(2);
  expect(merged.edges[0]?.occurrenceCount).toBe(3);
  expect(merged.edges[0]?.sources).toHaveLength(1);
});

test("clusters include authored source URLs and keep independent and self-linked notes separate", () => {
  const external: ExploreNode = {
    key: "url",
    kind: "external",
    title: "External source",
  };
  const graph = {
    edges: [edge("a", "b"), edge("c", "d"), edge("e", "url"), edge("f", "f")],
    nodes: [
      note("a"),
      note("b"),
      note("c"),
      note("d"),
      note("e"),
      note("f"),
      external,
    ],
  };
  const grouped = getNoteClusters(graph);
  expect(
    grouped.clusters.map((cluster) => cluster.map((node) => node.key).sort()),
  ).toEqual([
    ["a", "b"],
    ["c", "d"],
    ["e", "url"],
  ]);
  expect(grouped.unlinked.map((node) => node.key)).toEqual(["f"]);
  const layout = layoutExploreGraph(graph, 900);
  expect(layout.groups).toHaveLength(3);
  expect(layout.positions.has("e")).toBe(true);
  expect(layout.positions.has("url")).toBe(true);
  const first = layout.groups[0];
  const second = layout.groups[1];
  expect((first?.x ?? 0) + (first?.width ?? 0)).toBeLessThan(second?.x ?? 0);
});

test("a focused note has readable mobile cards and only its immediate neighbors on the canvas", () => {
  const graph = {
    edges: [edge("a", "b"), edge("b", "c")],
    nodes: [note("a"), note("b"), note("c"), note("unrelated")],
  };
  const layout = layoutExploreGraph(graph, 340, "a");
  expect([...layout.positions.keys()]).toEqual(["a", "b"]);
  expect(layout.cardWidth).toBeGreaterThan(120);
  expect(layout.positions.get("a")).toEqual({ x: 170, y: 78 });
  for (const point of layout.positions.values()) {
    expect(point.x - layout.cardWidth / 2).toBeGreaterThanOrEqual(0);
    expect(point.x + layout.cardWidth / 2).toBeLessThanOrEqual(340);
  }
});

test("one shared external URL joins its actual source notes and focused view includes that source", () => {
  const external: ExploreNode = {
    href: "https://example.com/article",
    key: "url",
    kind: "external",
    target: { kind: "external", url: "https://example.com/article" },
    title: "Article",
  };
  const graph = {
    edges: [edge("a", "url"), edge("b", "url")],
    nodes: [note("a"), note("b"), external, note("unlinked")],
  };
  const clusters = getNoteClusters(graph);
  expect(clusters.clusters).toHaveLength(1);
  expect(clusters.clusters[0]?.[0]?.kind).toBe("page");
  expect(clusters.clusters[0]?.map((node) => node.key).sort()).toEqual([
    "a",
    "b",
    "url",
  ]);
  expect([...layoutExploreGraph(graph, 340, "a").positions.keys()]).toEqual([
    "a",
    "url",
  ]);
});

test("linked sources remain visible in compact previews when many note connections precede them", () => {
  const external: ExploreNode = {
    key: "z-source",
    kind: "external",
    title: "Source",
  };
  const notes = Array.from({ length: 10 }, (_, index) => note(`note-${index}`));
  const graph = {
    edges: [
      ...notes.map((node) => edge("root", node.key)),
      edge("root", external.key),
    ],
    nodes: [note("root"), ...notes, external],
  };
  expect(layoutExploreGraph(graph, 900).positions.has(external.key)).toBe(true);
  expect(
    layoutExploreGraph(graph, 340, "root").positions.has(external.key),
  ).toBe(true);
  expect(
    layoutExploreGraph(graph, 900, "root").positions.has(external.key),
  ).toBe(true);
});
