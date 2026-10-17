import {
  type BlockData,
  type DocumentBlock,
  type DocumentBlocks,
  zBlockData,
} from "./schema";

/** Structural inputs allow real DB rows without depending on the ORM. */
export type StoredBlock = {
  id: string;
  parent_id: string | null;
  data: unknown;
  document_id: string;
  user_id: string;
};
export type StoredEdge = {
  from_id: string;
  to_id: string;
  type?: string | null;
  document_id: string;
  user_id: string;
};
export type ContentDiagnostic = { blockId?: string; reason: string };
export class DocumentReadError extends Error {
  constructor(
    public readonly diagnostics: ContentDiagnostic[],
    public readonly original: {
      blocks: readonly StoredBlock[];
      edges: readonly StoredEdge[];
    },
  ) {
    super(
      `Document needs recovery: ${diagnostics.map((d) => d.reason).join("; ")}`,
    );
    this.name = "DocumentReadError";
  }
}

/** Never silently omit unknown blocks, orphaned children, or ambiguous ordering. */
export function documentBlocks(
  blocks: readonly StoredBlock[],
  edges: readonly StoredEdge[],
): DocumentBlocks {
  if (!blocks.length && !edges.length) return undefined;
  const diagnostics: ContentDiagnostic[] = [];
  const nodes = new Map<string, DocumentBlock>();
  const rows = new Map(blocks.map((block) => [block.id, block]));
  const owner = blocks[0];
  for (const row of blocks) {
    if (nodes.has(row.id))
      diagnostics.push({ blockId: row.id, reason: "Duplicate block ID" });
    if (row.document_id !== owner?.document_id || row.user_id !== owner.user_id)
      diagnostics.push({
        blockId: row.id,
        reason: "Block outside document scope",
      });
    const parsed = zBlockData.safeParse(row.data);
    if (!parsed.success) {
      diagnostics.push({
        blockId: row.id,
        reason: `Unsupported block payload (${parsed.error.issues.map((i) => i.path.join(".")).join(", ")})`,
      });
      continue;
    }
    nodes.set(row.id, { ...parsed.data, children: [], id: row.id });
    const ancestors = new Set([row.id]);
    let parent = row.parent_id;
    while (parent !== null) {
      if (ancestors.has(parent)) {
        diagnostics.push({ blockId: row.id, reason: "Parent cycle" });
        break;
      }
      if (ancestors.size >= 128) {
        diagnostics.push({
          blockId: row.id,
          reason: "Nesting exceeds recovery limit",
        });
        break;
      }
      ancestors.add(parent);
      const parentRow = rows.get(parent);
      if (!parentRow) {
        diagnostics.push({ blockId: row.id, reason: "Missing parent" });
        break;
      }
      parent = parentRow.parent_id;
    }
  }
  const next = new Map<string, string>();
  const previous = new Set<string>();
  for (const edge of edges) {
    const from = rows.get(edge.from_id);
    const to = rows.get(edge.to_id);
    if (
      !from ||
      !to ||
      from.parent_id !== to.parent_id ||
      edge.document_id !== owner?.document_id ||
      edge.user_id !== owner?.user_id ||
      (edge.type != null && edge.type !== "sibling")
    ) {
      diagnostics.push({ reason: "Edge outside sibling/document scope" });
      continue;
    }
    if (next.has(edge.from_id) || previous.has(edge.to_id))
      diagnostics.push({ reason: "Ambiguous sibling ordering" });
    next.set(edge.from_id, edge.to_id);
    previous.add(edge.to_id);
  }
  const groups = new Map<string | null, string[]>();
  for (const row of blocks) {
    const group = groups.get(row.parent_id) ?? [];
    group.push(row.id);
    groups.set(row.parent_id, group);
  }
  const ordered = new Map<string | null, string[]>();
  for (const [parent, ids] of groups) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const head of ids.filter((id) => !previous.has(id))) {
      let id: string | undefined = head;
      while (id && !seen.has(id)) {
        seen.add(id);
        result.push(id);
        id = next.get(id);
      }
    }
    if (result.length !== ids.length)
      diagnostics.push({ reason: "Sibling cycle" });
    ordered.set(parent, result);
  }
  if (diagnostics.length)
    throw new DocumentReadError(diagnostics, {
      blocks: structuredClone(blocks),
      edges: structuredClone(edges),
    });
  const getNode = (id: string) => {
    const node = nodes.get(id);
    if (!node) throw new Error("Missing validated node");
    return node;
  };
  for (const [parent, ids] of ordered)
    if (parent !== null) {
      const node = nodes.get(parent);
      if (node) node.children = ids.map(getNode);
    }
  const result = (ordered.get(null) ?? []).map(getNode);
  const [first, ...rest] = result;
  return first ? [first, ...rest] : undefined;
}
export type BlockRow = {
  id: string;
  parent_id: string | null;
  data: BlockData;
};
export type EdgeRow = { from_id: string; to_id: string; type: "sibling" };
export function documentRows(blocks: readonly DocumentBlock[]): {
  blocks: BlockRow[];
  edges: EdgeRow[];
} {
  const rows: BlockRow[] = [];
  const edges: EdgeRow[] = [];
  const seen = new Set<string>();
  function walk(
    items: readonly DocumentBlock[],
    parent: string | null,
    depth: number,
  ) {
    if (depth > 128) throw new Error("Nesting exceeds document limit");
    items.forEach((block, index) => {
      if (seen.has(block.id)) throw new Error("Duplicate block ID");
      seen.add(block.id);
      const { id, children, ...data } = block;
      rows.push({ data: zBlockData.parse(data), id, parent_id: parent });
      const previous = items[index - 1];
      if (previous)
        edges.push({ from_id: previous.id, to_id: id, type: "sibling" });
      walk(children ?? [], id, depth + 1);
    });
  }
  walk(blocks, null, 0);
  return { blocks: rows, edges };
}
