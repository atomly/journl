import dagre from "@dagrejs/dagre";
import {
  type ExploreGraph,
  getConnectedNotes,
  getNoteClusters,
} from "./explore-graph";

/** View-only layout: membership and query bounds remain with the server. */
export function layoutMap(
  nodes: { id: string; width: number; height: number }[],
  edges: { source: string; target: string }[],
  direction: "TB" | "LR",
) {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ nodesep: 32, rankdir: direction, ranksep: 64 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id)))
    graph.setNode(node.id, { height: node.height, width: node.width });
  for (const edge of [...edges].sort(
    (a, b) =>
      a.source.localeCompare(b.source) || a.target.localeCompare(b.target),
  )) {
    if (
      edge.source !== edge.target &&
      graph.hasNode(edge.source) &&
      graph.hasNode(edge.target)
    )
      graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);
  return new Map(
    nodes.map((node) => {
      const point = graph.node(node.id);
      return [
        node.id,
        { x: point.x - node.width / 2, y: point.y - node.height / 2 },
      ];
    }),
  );
}

export function layoutExploreGraph(
  graph: ExploreGraph,
  width: number,
  focusKey?: string,
  cluster = false,
) {
  const mobile = width < 640;
  let nodes = graph.nodes;
  let hiddenCount = 0;
  if (focusKey) {
    const neighbors = getConnectedNotes(graph, focusKey);
    const visible = neighbors.slice(0, mobile ? 6 : 8);
    const source = neighbors.find((node) => node.kind === "external");
    if (source && !visible.some((node) => node.kind === "external"))
      visible[visible.length - 1] = source;
    nodes = [
      ...graph.nodes.filter((node) => node.key === focusKey),
      ...visible,
    ];
    hiddenCount = neighbors.length - visible.length;
  } else if (!cluster) {
    nodes = getNoteClusters(graph).clusters.flatMap((group) =>
      group.slice(0, 4),
    );
  }
  const cardWidth = mobile ? 152 : 190;
  const positions = layoutMap(
    nodes.map((node) => ({ height: 68, id: node.key, width: cardWidth })),
    graph.edges.map((edge) => ({ source: edge.fromKey, target: edge.toKey })),
    mobile ? "TB" : "LR",
  );
  return { cardWidth, hiddenCount, positions };
}
