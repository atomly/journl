import { describe, expect, test } from "vitest";
import type { TableContent } from "./schema";
import { appendTableColumns, appendTableRows } from "./table";

const cell = (content: string) => ({ content, type: "tableCell" as const });
const original: TableContent = {
  columnWidths: [140, 220],
  headerCols: 1,
  headerRows: 1,
  rows: [
    {
      cells: [
        {
          ...cell("A"),
          props: { colspan: 1, rowspan: 1, textAlignment: "center" },
        },
        cell("B"),
      ],
    },
    {
      cells: [
        {
          content: [
            {
              content: [{ styles: { bold: true }, text: "Keep", type: "text" }],
              href: "https://example.invalid",
              type: "link",
            },
          ],
          type: "tableCell",
        },
        cell("Value"),
      ],
    },
  ],
  type: "tableContent",
};
describe("compact table additions", () => {
  test("rows preserve every existing cell, span, header and width without mutating input", () => {
    const before = structuredClone(original);
    const result = appendTableRows(original, [
      { cells: [cell("New A"), cell("New B")] },
    ]);
    expect(original).toEqual(before);
    expect(result).toMatchObject({
      ...before,
      rows: [...before.rows, { cells: [cell("New A"), cell("New B")] }],
    });
  });
  test("columns preserve formatting and append widths and a cell to each physical row", () => {
    const before = structuredClone(original);
    const result = appendTableColumns(original, [
      { cells: [cell("Owner"), cell("Alice")], width: 180 },
    ]);
    expect(original).toEqual(before);
    expect(result.columnWidths).toEqual([140, 220, 180]);
    expect(result.headerRows).toBe(1);
    expect(result.headerCols).toBe(1);
    expect(result.rows.map((row) => row.cells.slice(0, 2))).toEqual(
      before.rows.map((row) => row.cells),
    );
    expect(result.rows.map((row) => row.cells.at(-1))).toEqual([
      cell("Owner"),
      cell("Alice"),
    ]);
  });
  test("existing merged cells and rows covered by rowspan retain their layout", () => {
    const table: TableContent = {
      rows: [
        { cells: [{ ...cell("Merged"), props: { colspan: 2, rowspan: 2 } }] },
        { cells: [] },
      ],
      type: "tableContent",
    };
    const rows = appendTableRows(table, [{ cells: [cell("A"), cell("B")] }]);
    expect(rows.rows[0]).toEqual(table.rows[0]);
    expect(rows.rows[1]).toEqual(table.rows[1]);
    const columns = appendTableColumns(table, [
      { cells: [cell("C"), cell("D")] },
    ]);
    expect(columns.rows[0]?.cells[0]).toEqual(table.rows[0]?.cells[0]);
    expect(columns.rows[1]?.cells).toEqual([cell("D")]);
  });
  test("legacy inline cells become equivalent rich cells when adding a rich column", () => {
    const result = appendTableColumns(
      { rows: [{ cells: ["A", "B"] }], type: "tableContent" },
      [{ cells: [cell("C")] }],
    );
    expect(result.rows[0]?.cells).toEqual([cell("A"), cell("B"), cell("C")]);
    expect(result.columnWidths).toBeUndefined();
  });
  test("new widths fill unspecified existing widths without guessing sizes", () => {
    const result = appendTableColumns(
      { rows: [{ cells: ["A", "B"] }], type: "tableContent" },
      [{ cells: [cell("C")], width: 150 }],
    );
    expect(result.columnWidths).toEqual([undefined, undefined, 150]);
  });
  test("invalid cell counts and new merges fail without changing input", () => {
    const before = structuredClone(original);
    expect(() =>
      appendTableRows(original, [{ cells: [cell("short")] }]),
    ).toThrow("one cell per existing table column");
    expect(() =>
      appendTableColumns(original, [{ cells: [cell("short")] }]),
    ).toThrow("one cell per existing table row");
    expect(() =>
      appendTableColumns(original, [
        { cells: [{ ...cell("merged"), props: { rowspan: 2 } }, cell("B")] },
      ]),
    ).toThrow("must not be merged");
    expect(original).toEqual(before);
  });
});

test("inconsistent layout metadata is rejected instead of discarded", () => {
  expect(() =>
    appendTableColumns({ ...original, columnWidths: [120, 180, 200] }, [
      { cells: [cell("C"), cell("D")] },
    ]),
  ).toThrow("widths exceed");
  expect(() =>
    appendTableRows(
      {
        rows: [{ cells: [cell("A"), cell("B")] }, { cells: [cell("C")] }],
        type: "tableContent",
      },
      [{ cells: [cell("D"), cell("E")] }],
    ),
  ).toThrow("rectangular");
});
