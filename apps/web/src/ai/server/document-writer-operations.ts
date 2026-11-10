import {
  appendTableColumns,
  appendTableRows,
  applyDocumentOperations,
  type DocumentBlock,
  type DocumentOperation,
  DocumentOperationError,
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

/** Compile against a retained snapshot. Failed appends do not advance it. */
export function createWriterOperationCompiler(
  blocks: readonly DocumentBlock[],
) {
  let current = blocks;
  let compiled: DocumentOperation[] = [];
  let count = 0;
  return {
    append(operations: readonly WriterOperation[]): DocumentOperation[] {
      let next = current;
      const result = [...compiled];
      for (const [index, operation] of operations.entries()) {
        const compact =
          operation.type === "appendTableRows" ||
          operation.type === "appendTableColumns";
        let normalized: DocumentOperation;
        try {
          if (!compact) {
            if (
              operation.type === "update" &&
              operation.data.type === "table" &&
              ((operation.data.content?.rows.length ?? 0) !== 1 ||
                !operation.data.content?.rows[0]?.cells.length)
            ) {
              const existing = documentRows(next).blocks.find(
                (block) => block.id === operation.id,
              );
              if (existing && existing.data.type !== "table")
                throw new Error(
                  "New tables must start with one row. Append each later row with its own operation.",
                );
            }
            normalized = operation;
          } else {
            const block = documentRows(next).blocks.find(
              (block) => block.id === operation.id,
            );
            if (!block) throw new Error(`Block not found: ${operation.id}`);
            if (block.data.type !== "table" || !block.data.content)
              throw new Error(
                "Table additions require an existing table with content.",
              );
            normalized = {
              data: {
                type: "table",
                ...(block.data.props !== undefined
                  ? { props: block.data.props }
                  : {}),
                content:
                  operation.type === "appendTableRows"
                    ? appendTableRows(block.data.content, operation.rows)
                    : appendTableColumns(block.data.content, operation.columns),
              },
              id: block.id,
              type: "update",
            };
          }
          next = applyDocumentOperations(next, [normalized]);
        } catch (error) {
          throw new DocumentOperationError(
            count + index,
            compact ? "update" : operation.type,
            error instanceof DocumentOperationError ? error.cause : error,
          );
        }
        // Fold adjacent table additions so previews and final commits do not
        // replay every earlier row as another complete table replacement.
        const previous = result.at(-1);
        if (
          compact &&
          normalized.type === "update" &&
          previous?.type === "update" &&
          previous.id === normalized.id
        )
          result[result.length - 1] = normalized;
        else if (
          compact &&
          normalized.type === "update" &&
          normalized.data.type === "table" &&
          previous?.type === "insert" &&
          previous.block.type === "table" &&
          previous.block.id === normalized.id
        )
          result[result.length - 1] = {
            ...previous,
            block: { ...previous.block, ...normalized.data },
          };
        else result.push(normalized);
      }
      current = next;
      compiled = result;
      count += operations.length;
      return result;
    },
  };
}

export function compileWriterOperations(
  blocks: readonly DocumentBlock[],
  operations: readonly WriterOperation[],
): DocumentOperation[] {
  return createWriterOperationCompiler(blocks).append(operations);
}
