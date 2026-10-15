export { getConnectedNotes, getNoteClusters } from "@acme/graph/connections";

import type { RouterOutputs } from "~/trpc";

type GraphPage = RouterOutputs["references"]["getGraph"];
export type ExploreNode = GraphPage["nodes"][number];
export type ExploreEdge = GraphPage["edges"][number];
export type ExploreGraph = { nodes: ExploreNode[]; edges: ExploreEdge[] };

/** Each occurrence has one identity even when pages or queries overlap. */
export function mergeGraphPages(pages: GraphPage[]): ExploreGraph {
  const nodes = new Map<string, ExploreNode>();
  const edges = new Map<string, ExploreEdge>();
  for (const page of pages) {
    for (const node of page.nodes)
      nodes.set(node.key, { ...node, title: getExploreTitle(node) });
    for (const edge of page.edges) {
      const key = `${edge.fromKey}|${edge.toKey}`;
      const previous = edges.get(key);
      if (!previous) {
        edges.set(key, { ...edge });
        continue;
      }
      const occurrenceIds = [
        ...new Set([...previous.occurrenceIds, ...edge.occurrenceIds]),
      ];
      edges.set(key, {
        ...edge,
        occurrenceCount: occurrenceIds.length,
        occurrenceIds,
        presentations: [
          ...new Set([...previous.presentations, ...edge.presentations]),
        ],
        sourceBlocks: [
          ...new Set([...previous.sourceBlocks, ...edge.sourceBlocks]),
        ].slice(0, 3),
        sources: [
          ...new Map(
            [...previous.sources, ...edge.sources].map((source) => [
              source.blockId,
              source,
            ]),
          ).values(),
        ].slice(0, 3),
      });
    }
  }
  return { edges: [...edges.values()], nodes: [...nodes.values()] };
}

export function isNote(node: ExploreNode) {
  return node.kind === "page" || node.kind === "journal";
}

export function getExploreTitle(node: Pick<ExploreNode, "kind" | "title">) {
  if (node.kind !== "journal" || !/^\d{4}-\d{2}-\d{2}$/.test(node.title))
    return node.title;
  const date = new Date(`${node.title}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? node.title
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}
