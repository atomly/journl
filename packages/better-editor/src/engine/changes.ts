import {
  applyDocumentOperations,
  type DocumentBlock,
  type DocumentOperation,
  documentRows,
  parseBlock,
} from "@acme/document";
import type { Node } from "@tiptap/pm/model";
import { fromTiptapDocument } from "../serialization/tiptap";

type BlockLocation = {
  block: DocumentBlock;
  parentId: string | null;
  afterId: string | null;
};
function locations(blocks: readonly DocumentBlock[]) {
  const result = new Map<string, BlockLocation>();
  const walk = (items: readonly DocumentBlock[], parentId: string | null) => {
    items.forEach((block, index) => {
      result.set(block.id, {
        afterId: items[index - 1]?.id ?? null,
        block,
        parentId,
      });
      walk(block.children ?? [], block.id);
    });
  };
  walk(blocks, null);
  return result;
}
const data = ({ id: _id, children: _children, ...value }: DocumentBlock) =>
  value;

/** Translate a committed editor snapshot into domain edits, never PM positions. */
export function documentChanges(
  before: readonly DocumentBlock[],
  doc: Node,
): DocumentOperation[] {
  const after = fromTiptapDocument(doc);
  const validated = before.map(parseBlock);
  documentRows(validated);
  return diffDocumentSnapshots(validated, after);
}

/** Both snapshots must be immutable and already validated by the document reader. */
export function diffDocumentSnapshots(
  before: readonly DocumentBlock[],
  after: readonly DocumentBlock[],
): DocumentOperation[] {
  const updates: DocumentOperation[] = [];
  // Unchanged immutable blocks skip their entire subtree. Ordinary typing builds
  // no document-wide ID maps and serializes only the affected block's payload.
  const sameStructure = (
    previous: readonly DocumentBlock[],
    next: readonly DocumentBlock[],
  ): boolean => {
    if (previous.length !== next.length) return false;
    for (let i = 0; i < next.length; i++) {
      const a = previous[i];
      const b = next[i];
      if (!a || !b || a.id !== b.id) return false;
      if (a === b) continue;
      if (JSON.stringify(data(a)) !== JSON.stringify(data(b)))
        updates.push({ data: data(b), id: b.id, type: "update" });
      if (!sameStructure(a.children ?? [], b.children ?? [])) return false;
    }
    return true;
  };
  if (sameStructure(before, after)) return updates;
  let current: readonly DocumentBlock[] = before;
  const desired = locations(after);
  const operations: DocumentOperation[] = [];
  let index = locations(current);
  const apply = (operation: DocumentOperation) => {
    current = applyDocumentOperations(current, [operation]);
    index = locations(current);
    operations.push(operation);
  };
  // Parents and preceding siblings are placed before their descendants.
  for (const [id, target] of desired) {
    const existing = index.get(id);
    if (!existing)
      apply({
        afterId: target.afterId,
        block: { ...data(target.block), id },
        parentId: target.parentId,
        type: "insert",
      });
    else {
      if (
        existing.parentId !== target.parentId ||
        existing.afterId !== target.afterId
      )
        apply({
          afterId: target.afterId,
          id,
          parentId: target.parentId,
          type: "move",
        });
      if (
        existing.block !== target.block &&
        JSON.stringify(data(existing.block)) !==
          JSON.stringify(data(target.block))
      )
        apply({ data: data(target.block), id, type: "update" });
    }
  }
  // Move surviving descendants out before deleting their former ancestors.
  for (const [id] of index) {
    if (!desired.has(id) && index.has(id)) apply({ id, type: "remove" });
  }
  return operations;
}
