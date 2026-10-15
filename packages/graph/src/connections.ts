import createGraph from "ngraph.graph";

export type ConnectionNode = { key: string; kind: string; title: string };
export type ConnectionGraph<Node extends ConnectionNode> = {
  nodes: Node[];
  edges: { fromKey: string; toKey: string }[];
};

function isNote(node: ConnectionNode) {
  return node.kind === "page" || node.kind === "journal";
}

/** Index only accessible payload nodes; dangling edges cannot manufacture neighbors. */
function indexConnections<Node extends ConnectionNode>(
  input: ConnectionGraph<Node>,
) {
  const graph = createGraph<Node>();
  for (const node of input.nodes)
    if (isNote(node) || node.kind === "external") graph.addNode(node.key, node);
  for (const edge of input.edges)
    if (
      edge.fromKey !== edge.toKey &&
      graph.getNode(edge.fromKey) &&
      graph.getNode(edge.toKey)
    )
      graph.addLink(edge.fromKey, edge.toKey);
  return graph;
}

export function getConnectedNotes<Node extends ConnectionNode>(
  graph: ConnectionGraph<Node>,
  key: string,
) {
  const index = indexConnections(graph);
  const adjacent = new Set<string>();
  index.forEachLinkedNode(key, (node) => {
    adjacent.add(String(node.id));
  });
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
export function getNoteClusters<Node extends ConnectionNode>(
  graph: ConnectionGraph<Node>,
) {
  const notes = graph.nodes
    .filter((node) => isNote(node) || node.kind === "external")
    .sort(
      (a, b) => a.title.localeCompare(b.title) || a.key.localeCompare(b.key),
    );
  const index = indexConnections(graph);
  const byKey = new Map(notes.map((node) => [node.key, node]));
  const neighbors = (key: string) => {
    const ids = new Set<string>();
    index.forEachLinkedNode(key, (node) => {
      ids.add(String(node.id));
    });
    return ids;
  };
  const visited = new Set<string>();
  const clusters: Node[][] = [];
  const unlinked: Node[] = [];
  for (const note of notes) {
    if (visited.has(note.key)) continue;
    if (!neighbors(note.key).size) {
      if (isNote(note)) unlinked.push(note);
      visited.add(note.key);
      continue;
    }
    const component: Node[] = [];
    const queue = [note.key];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const key = queue[cursor];
      if (!key || visited.has(key)) continue;
      visited.add(key);
      const node = byKey.get(key);
      if (node) component.push(node);
      queue.push(...neighbors(key));
    }
    const degrees = new Map(
      component.map((node) => [node.key, neighbors(node.key).size]),
    );
    const root = [...component].sort(
      (a, b) =>
        Number(isNote(b)) - Number(isNote(a)) ||
        degrees.get(b.key)! - degrees.get(a.key)! ||
        a.title.localeCompare(b.title),
    )[0];
    if (!root) continue;
    // A breadth-first preview keeps visible paths intact when a cluster is large.
    const ordered: Node[] = [];
    const seen = new Set<string>();
    const next = [root.key];
    for (let cursor = 0; cursor < next.length; cursor++) {
      const key = next[cursor];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const node = byKey.get(key);
      if (node) ordered.push(node);
      const adjacent = [...neighbors(key)].sort(
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
