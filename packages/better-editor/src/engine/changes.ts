import {
  applyDocumentOperations,
  type DocumentBlock,
  type DocumentOperation,
  documentRows,
  parseBlock,
} from "@acme/document";
import type { Node } from "@tiptap/pm/model";
import { fromTiptapDocument } from "../serialization/tiptap";

function locations(blocks: readonly DocumentBlock[]) {
  const result = new Map<
    string,
    { block: DocumentBlock; parentId: string | null; afterId: string | null }
  >();
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
  let current = before.map(parseBlock);
  documentRows(current);
  const desired = locations(after);
  const operations: DocumentOperation[] = [];
  const apply = (operation: DocumentOperation) => {
    current = applyDocumentOperations(current, [operation]);
    operations.push(operation);
  };
  // Parents and preceding siblings are placed before their descendants.
  for (const [id, target] of desired) {
    const existing = locations(current).get(id);
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
        JSON.stringify(data(existing.block)) !==
        JSON.stringify(data(target.block))
      )
        apply({ data: data(target.block), id, type: "update" });
    }
  }
  // Move surviving descendants out before deleting their former ancestors.
  for (const [id] of locations(current)) {
    if (!desired.has(id) && locations(current).has(id))
      apply({ id, type: "remove" });
  }
  return operations;
}
