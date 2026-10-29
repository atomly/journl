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
  const validated = before.map(parseBlock);
  documentRows(validated);
  return diffDocumentSnapshots(validated, after);
}

/** Both snapshots must already have passed the document reader's validation. */
export function diffDocumentSnapshots(
  before: readonly DocumentBlock[],
  after: readonly DocumentBlock[],
): DocumentOperation[] {
  let current = [...before];
  const desired = locations(after);
  const operations: DocumentOperation[] = [];
  let index = locations(current);
  // Most keystrokes change data, not block structure. Diff those in linear time
  // without repeatedly cloning and validating the entire document per operation.
  if (
    index.size === desired.size &&
    [...desired].every(([id, target]) => {
      const existing = index.get(id);
      return (
        existing?.parentId === target.parentId &&
        existing?.afterId === target.afterId
      );
    })
  ) {
    for (const [id, target] of desired) {
      const existing = index.get(id);
      if (
        existing &&
        existing.block !== target.block &&
        JSON.stringify(data(existing.block)) !==
          JSON.stringify(data(target.block))
      )
        operations.push({ data: data(target.block), id, type: "update" });
    }
    return operations;
  }
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
