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

export type ExploreLayout = {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
  groups: Array<{
    root: ExploreNode;
    count: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  hiddenCount: number;
  cardWidth: number;
};

export function layoutExploreGraph(
  graph: ExploreGraph,
  width: number,
  focusKey?: string,
): ExploreLayout {
  const positions = new Map<string, { x: number; y: number }>();
  const mobile = width < 640;
  if (focusKey) {
    const root = graph.nodes.find((node) => node.key === focusKey);
    const notes = getConnectedNotes(graph, focusKey);
    const limit = mobile ? 6 : 8;
    const visible = notes.slice(0, limit);
    const source = notes.find((node) => node.kind === "external");
    // A compact neighborhood still represents its linked sources when a note
    // has more connections than the visible canvas can comfortably fit.
    if (source && !visible.some((node) => node.kind === "external"))
      visible[visible.length - 1] = source;
    const height = mobile
      ? Math.max(340, 200 + Math.ceil(visible.length / 2) * 120)
      : 560;
    if (root)
      positions.set(root.key, { x: width / 2, y: mobile ? 78 : height / 2 });
    visible.forEach((node, index) => {
      const angle = (index / visible.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(
        node.key,
        mobile
          ? {
              x: width * (index % 2 ? 0.75 : 0.25),
              y: 214 + Math.floor(index / 2) * 120,
            }
          : {
              x: width / 2 + Math.cos(angle) * (width / 2 - 100),
              y: height / 2 + Math.sin(angle) * 190,
            },
      );
    });
    return {
      cardWidth: mobile ? Math.min(152, width / 2 - 20) : 170,
      groups: [],
      height,
      hiddenCount: notes.length - visible.length,
      positions,
      width,
    };
  }
  const { clusters } = getNoteClusters(graph);
  const columns = width >= 760 ? 2 : 1;
  const cellWidth = width / columns;
  const cellHeight = 424;
  const groups: ExploreLayout["groups"] = [];
  clusters.forEach((cluster, index) => {
    const root = cluster[0];
    if (!root) return;
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    groups.push({
      count: cluster.length,
      height: cellHeight - 16,
      root,
      width: cellWidth - 16,
      x: x + 8,
      y: y + 8,
    });
    const points = [
      { x: cellWidth / 2, y: 224 },
      { x: cellWidth * 0.25, y: 124 },
      { x: cellWidth * 0.75, y: 124 },
      { x: cellWidth / 2, y: 340 },
    ];
    cluster.slice(0, 4).forEach((node, i) => {
      const point = points[i];
      if (point) positions.set(node.key, { x: x + point.x, y: y + point.y });
    });
  });
  return {
    cardWidth: Math.min(152, cellWidth / 2 - 22),
    groups,
    height: Math.max(320, Math.ceil(clusters.length / columns) * cellHeight),
    hiddenCount: 0,
    positions,
    width,
  };
}

/** Layout of an already computed server cluster; never recomputes membership. */
export function layoutClusterGraph(
  graph: ExploreGraph,
  width: number,
): ExploreLayout {
  const columns = width >= 800 ? 3 : width >= 480 ? 2 : 1;
  const positions = new Map<string, { x: number; y: number }>();
  const notes = graph.nodes
    .filter((n) => n.kind !== "external")
    .sort((a, b) => a.key.localeCompare(b.key));
  const sources = graph.nodes
    .filter((n) => n.kind === "external")
    .sort((a, b) => a.key.localeCompare(b.key));
  notes.forEach((n, i) => {
    positions.set(n.key, {
      x: (((i % columns) + 0.5) * width) / columns,
      y: 64 + Math.floor(i / columns) * 110,
    });
  });
  const sourceTop = 90 + Math.ceil(notes.length / columns) * 110;
  sources.forEach((n, i) => {
    positions.set(n.key, {
      x: (((i % columns) + 0.5) * width) / columns,
      y: sourceTop + Math.floor(i / columns) * 110,
    });
  });
  return {
    cardWidth: Math.min(190, width / columns - 28),
    groups: [],
    height: Math.max(
      360,
      sourceTop + Math.ceil(sources.length / columns) * 110,
    ),
    hiddenCount: 0,
    positions,
    width,
  };
}
