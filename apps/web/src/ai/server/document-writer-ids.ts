import { randomUUID } from "node:crypto";
import {
  type DocumentBlock,
  type DocumentOperation,
  documentRows,
} from "@acme/document";

/** Model IDs are temporary labels. Only the application allocates stored IDs.
 * One map per request keeps streamed and final block identities identical. */
export function createWriterIdentityMap(
  blocks: readonly DocumentBlock[],
  createId: () => string = randomUUID,
) {
  const existing = new Set(
    documentRows(blocks).blocks.map((block) => block.id),
  );
  const assigned = new Map<string, string>();
  return (operations: readonly DocumentOperation[]): DocumentOperation[] => {
    const labels = new Set<string>();
    const visit = (block: DocumentBlock) => {
      if (existing.has(block.id) || labels.has(block.id))
        throw new Error(
          "Inserted block IDs must be unique and must not replace existing identities.",
        );
      labels.add(block.id);
      block.children?.forEach(visit);
    };
    for (const operation of operations)
      if (operation.type === "insert") visit(operation.block);
    for (const label of labels)
      if (!assigned.has(label)) assigned.set(label, createId());
    const id = (value: string) => assigned.get(value) ?? value;
    const optionalId = (value: string | null) =>
      value === null ? null : id(value);
    const block = (value: DocumentBlock): DocumentBlock => ({
      ...value,
      id: id(value.id),
      ...(value.children ? { children: value.children.map(block) } : {}),
    });
    return operations.map((operation) => {
      if (operation.type === "insert")
        return {
          ...operation,
          afterId: optionalId(operation.afterId),
          block: block(operation.block),
          parentId: optionalId(operation.parentId),
        };
      if (operation.type === "move")
        return {
          ...operation,
          afterId: optionalId(operation.afterId),
          id: id(operation.id),
          parentId: optionalId(operation.parentId),
        };
      return { ...operation, id: id(operation.id) };
    });
  };
}
