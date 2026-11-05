import {
  DocumentReadError,
  documentBlocks,
  type StoredBlock,
  type StoredEdge,
} from "@acme/document";

/** A failed document read must not prevent reading the rest of a journal page. */
export function readJournalContent<
  T extends {
    block_nodes: readonly StoredBlock[];
    block_edges: readonly StoredEdge[];
  },
>({ block_nodes, block_edges, ...entry }: T) {
  try {
    return {
      ...entry,
      blocks: documentBlocks(block_nodes, block_edges),
    };
  } catch (error) {
    if (!(error instanceof DocumentReadError)) throw error;
    // Keep the saved rows intact. Do not return partial blocks or raw content
    // from a scope mismatch, and never mount an editor for this result.
    return { ...entry, contentReadError: true as const };
  }
}
