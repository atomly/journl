import {
  applyDocumentOperations,
  type DocumentBlock,
  type DocumentOperation,
  documentRows,
} from "@acme/document";
import type { BlockTransaction } from "~/trpc";

/** Existing database API deltas; editor positions and JSON never cross this seam. */
export function documentSaveTransactions(
  before: readonly DocumentBlock[],
  after: readonly DocumentBlock[],
): BlockTransaction[] {
  const previous = documentRows(before);
  const next = documentRows(after);
  const previousNodes = new Map(previous.blocks.map((row) => [row.id, row]));
  const nextNodes = new Set(next.blocks.map((row) => row.id));
  const edgeKey = (edge: { from_id: string; to_id: string }) =>
    `${edge.from_id}:${edge.to_id}`;
  const previousEdges = new Set(previous.edges.map(edgeKey));
  const nextEdges = new Set(next.edges.map(edgeKey));
  return [
    ...previous.edges
      .filter((edge) => !nextEdges.has(edgeKey(edge)))
      .map(
        ({ from_id, to_id }): BlockTransaction => ({
          args: { from_id, to_id },
          type: "edge_remove",
        }),
      ),
    // Parent-first upserts move survivors out before removed ancestors cascade.
    ...next.blocks
      .filter(
        (row) =>
          JSON.stringify(previousNodes.get(row.id)) !== JSON.stringify(row),
      )
      .map((row): BlockTransaction => ({ args: row, type: "block_upsert" })),
    ...previous.blocks
      .filter((row) => !nextNodes.has(row.id))
      .map(
        ({ id }): BlockTransaction => ({ args: { id }, type: "block_remove" }),
      ),
    ...next.edges
      .filter((edge) => !previousEdges.has(edgeKey(edge)))
      .map((edge): BlockTransaction => ({ args: edge, type: "edge_insert" })),
  ];
}

/** Revalidate a committed proposal against the current domain draft atomically. */
export function acceptedDocumentChange(
  before: readonly DocumentBlock[],
  blocks: readonly DocumentBlock[],
  operations: readonly DocumentOperation[],
) {
  const next = applyDocumentOperations(before, operations);
  if (
    JSON.stringify(documentRows(next)) !== JSON.stringify(documentRows(blocks))
  )
    throw new Error("Committed editor operations do not match their document");
  return { blocks: next, transactions: documentSaveTransactions(before, next) };
}
