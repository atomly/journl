import { applyDocumentOperations, parseBlock } from "@acme/document";
import { expect, test } from "vitest";
import {
  compileWriterOperations,
  type WriterOperation,
} from "./document-writer-operations";
import { decodeWriterOutput } from "./document-writer-schema";

const cell = (content: string) => ({ content, type: "tableCell" as const });
const table = parseBlock({
  children: [{ content: "Preserve", id: "child", type: "paragraph" }],
  content: {
    columnWidths: [120, 180],
    headerRows: 1,
    rows: [
      { cells: [cell("Name"), cell("Status")] },
      { cells: [cell("Alice"), cell("Ready")] },
    ],
    type: "tableContent",
  },
  id: "table",
  props: {},
  type: "table",
});

test("sequential additions resolve the current table while retaining identities and unrelated content", () => {
  const untouched = parseBlock({
    content: "Keep",
    id: "untouched",
    type: "paragraph",
  });
  const source = [table, untouched];
  const before = structuredClone(source);
  const operations = compileWriterOperations(source, [
    {
      columns: [{ cells: [cell("Owner"), cell("Bob")], width: 150 }],
      id: "table",
      type: "appendTableColumns",
    },
    {
      id: "table",
      rows: [{ cells: [cell("Carol"), cell("New"), cell("Dave")] }],
      type: "appendTableRows",
    },
  ]);
  const result = applyDocumentOperations(source, operations);
  expect(source).toEqual(before);
  expect(result[1]).toEqual(untouched);
  expect(result[0]).toMatchObject({
    children: table.children,
    content: {
      columnWidths: [120, 180, 150],
      headerRows: 1,
      rows: [
        { cells: [cell("Name"), cell("Status"), cell("Owner")] },
        { cells: [cell("Alice"), cell("Ready"), cell("Bob")] },
        { cells: [cell("Carol"), cell("New"), cell("Dave")] },
      ],
    },
    id: table.id,
    props: table.props,
  });
  expect(operations.map((operation) => operation.type)).toEqual([
    "update",
    "update",
  ]);
});

test("additions can target a table inserted earlier in the batch with a temporary ID", () => {
  const { children: _, ...newTable } = table;
  const operations = compileWriterOperations(
    [],
    [
      { afterId: null, block: newTable, parentId: null, type: "insert" },
      {
        id: "table",
        rows: [{ cells: [cell("New"), cell("Row")] }],
        type: "appendTableRows",
      },
      {
        columns: [{ cells: [cell("Third"), cell("Cell"), cell("Added")] }],
        id: "table",
        type: "appendTableColumns",
      },
    ],
  );
  expect(applyDocumentOperations([], operations)[0]).toMatchObject({
    content: {
      rows: [
        { cells: [cell("Name"), cell("Status"), cell("Third")] },
        { cells: [cell("Alice"), cell("Ready"), cell("Cell")] },
        { cells: [cell("New"), cell("Row"), cell("Added")] },
      ],
    },
  });
});

test("missing, removed and non-table targets are rejected without expanding the editable scope", () => {
  const addition: WriterOperation = {
    id: "table",
    rows: [{ cells: [cell("A"), cell("B")] }],
    type: "appendTableRows",
  };
  expect(() => compileWriterOperations([], [addition])).toThrow(
    "Block not found",
  );
  expect(() =>
    compileWriterOperations(
      [table],
      [{ id: "table", type: "remove" }, addition],
    ),
  ).toThrow("Block not found");
  expect(() =>
    compileWriterOperations(table.children ?? [], [
      { ...addition, id: "child" },
    ]),
  ).toThrow("existing table");
});

test("strict nullable model output decodes compact cells and optional widths", async () => {
  const output = await decodeWriterOutput({
    operations: [
      {
        columns: [
          {
            cells: [
              { ...cell("Owner"), props: null },
              { ...cell("Bob"), props: null },
            ],
            width: null,
          },
        ],
        id: "table",
        type: "appendTableColumns",
      },
    ],
  });
  expect(
    applyDocumentOperations(
      [table],
      compileWriterOperations([table], output.operations),
    )[0],
  ).toMatchObject({
    content: { columnWidths: [120, 180, undefined] },
  });
});

test("a new row in a large table generates only its new cells", () => {
  const large = parseBlock({
    content: {
      headerRows: 1,
      rows: Array.from({ length: 41 }, (_, row) => ({
        cells: Array.from({ length: 6 }, (_, col) =>
          cell(`Row ${row} column ${col}: unchanged content`),
        ),
      })),
      type: "tableContent",
    },
    id: "large",
    type: "table",
  });
  const compact: WriterOperation[] = [
    {
      id: "large",
      rows: [
        { cells: Array.from({ length: 6 }, (_, col) => cell(`New ${col}`)) },
      ],
      type: "appendTableRows",
    },
  ];
  const compiled = compileWriterOperations([large], compact);
  expect(JSON.stringify(compact).length).toBeLessThan(
    JSON.stringify(compiled).length / 20,
  );
  expect(applyDocumentOperations([large], compiled)[0]).toMatchObject({
    content: { rows: expect.any(Array) },
  });
});
