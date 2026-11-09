import {
  appendTableColumns,
  appendTableRows,
  applyDocumentOperations,
  type DocumentBlock,
  type DocumentOperation,
  documentRows,
  zDocumentOperation,
  zTableCell,
} from "@acme/document";
import { z } from "zod/v4";

const additions =
  "Supply new cells only. Existing cells, formatting, headers, and widths are retained. New cells must have no merged spans.";
// biome-ignore assist/source/useSortedKeys: Select the operation type before generating its payload.
export const zAppendTableRows = z.strictObject({
  type: z.literal("appendTableRows"),
  id: z.string().min(1),
  rows: z
    .array(z.strictObject({ cells: z.array(zTableCell).min(1) }))
    .min(1)
    .describe(
      `${additions} Each new row needs one cell per current column, including columns added earlier in this batch.`,
    ),
});
// biome-ignore assist/source/useSortedKeys: Select the operation type before generating its payload.
export const zAppendTableColumns = z.strictObject({
  type: z.literal("appendTableColumns"),
  columns: z
    .array(
      z.strictObject({
        cells: z.array(zTableCell).min(1),
        width: z.number().nonnegative().optional(),
      }),
    )
    .min(1)
    .describe(
      `${additions} Each column lists one new cell per current row, including header rows and rows added earlier in this batch. The first cell is for the first row.`,
    ),
  id: z.string().min(1),
});
export const zWriterOperation = z.discriminatedUnion("type", [
  ...zDocumentOperation.options,
  zAppendTableRows,
  zAppendTableColumns,
]);
export type WriterOperation = z.infer<typeof zWriterOperation>;

/** Compile compact generated additions into the existing document operation
 * contract. Resolve each table against the original snapshot plus earlier edits. */
export function compileWriterOperations(
  blocks: readonly DocumentBlock[],
  operations: readonly WriterOperation[],
): DocumentOperation[] {
  const result: DocumentOperation[] = [];
  for (const operation of operations) {
    if (
      operation.type !== "appendTableRows" &&
      operation.type !== "appendTableColumns"
    ) {
      result.push(operation);
      continue;
    }
    const current = applyDocumentOperations(blocks, result);
    const block = documentRows(current).blocks.find(
      (block) => block.id === operation.id,
    );
    if (!block) throw new Error(`Block not found: ${operation.id}`);
    if (block.data.type !== "table" || !block.data.content)
      throw new Error(
        "Table additions require an existing table with content.",
      );
    result.push({
      data: {
        type: "table",
        ...(block.data.props !== undefined ? { props: block.data.props } : {}),
        content:
          operation.type === "appendTableRows"
            ? appendTableRows(block.data.content, operation.rows)
            : appendTableColumns(block.data.content, operation.columns),
      },
      id: block.id,
      type: "update",
    });
  }
  return result;
}
