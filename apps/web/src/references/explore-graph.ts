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

export function getConnectedNotes(graph: ExploreGraph, key: string) {
  const adjacent = new Set(
    graph.edges.flatMap((edge) =>
      edge.fromKey === key
        ? [edge.toKey]
        : edge.toKey === key
          ? [edge.fromKey]
          : [],
    ),
  );
  return graph.nodes
    .filter(
      (node) =>
        (isNote(node) || node.kind === "external") &&
        node.key !== key &&
        adjacent.has(node.key),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Clusters describe authored note links, never proximity or inferred similarity. */
export function getNoteClusters(graph: ExploreGraph) {
  const notes = graph.nodes
    .filter((node) => isNote(node) || node.kind === "external")
    .sort(
      (a, b) => a.title.localeCompare(b.title) || a.key.localeCompare(b.key),
    );
  const byKey = new Map(notes.map((node) => [node.key, node]));
  const neighbors = new Map(notes.map((node) => [node.key, new Set<string>()]));
  for (const edge of graph.edges) {
    if (
      !byKey.has(edge.fromKey) ||
      !byKey.has(edge.toKey) ||
      edge.fromKey === edge.toKey
    )
      continue;
    neighbors.get(edge.fromKey)?.add(edge.toKey);
    neighbors.get(edge.toKey)?.add(edge.fromKey);
  }
  const visited = new Set<string>();
  const clusters: ExploreNode[][] = [];
  const unlinked: ExploreNode[] = [];
  for (const note of notes) {
    if (visited.has(note.key)) continue;
    if (!neighbors.get(note.key)?.size) {
      if (isNote(note)) unlinked.push(note);
      visited.add(note.key);
      continue;
    }
    const component: ExploreNode[] = [];
    const queue = [note.key];
    while (queue.length) {
      const key = queue.shift();
      if (!key || visited.has(key)) continue;
      visited.add(key);
      const node = byKey.get(key);
      if (node) component.push(node);
      queue.push(...(neighbors.get(key) ?? []));
    }
    const root = [...component].sort(
      (a, b) =>
        Number(isNote(b)) - Number(isNote(a)) ||
        (neighbors.get(b.key)?.size ?? 0) - (neighbors.get(a.key)?.size ?? 0) ||
        a.title.localeCompare(b.title),
    )[0];
    if (!root) continue;
    // A breadth-first preview keeps visible paths intact when a cluster is large.
    const ordered: ExploreNode[] = [];
    const seen = new Set<string>();
    const next = [root.key];
    while (next.length) {
      const key = next.shift();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const node = byKey.get(key);
      if (node) ordered.push(node);
      const adjacent = [...(neighbors.get(key) ?? [])].sort(
        (a, b) =>
          Number(byKey.get(b)?.kind === "external") -
            Number(byKey.get(a)?.kind === "external") || a.localeCompare(b),
      );
      next.push(...adjacent);
    }
    clusters.push(ordered);
  }
  return {
    clusters: clusters.sort(
      (a, b) =>
        b.length - a.length ||
        (a[0]?.title ?? "").localeCompare(b[0]?.title ?? ""),
    ),
    unlinked,
  };
}
