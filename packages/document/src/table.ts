import { z } from "zod/v4";
import { type TableContent, zTableCell, zTableContent } from "./schema";

type Cell = z.infer<typeof zTableCell>;
export type TableColumn = { cells: Cell[]; width?: number };
const richCell = (cell: TableContent["rows"][number]["cells"][number]): Cell =>
  typeof cell === "string" || Array.isArray(cell)
    ? { content: cell, type: "tableCell" }
    : cell;

/** Resolve logical width, including cells covered by earlier row spans. */
function tableWidth(content: TableContent) {
  const occupied: number[] = [];
  let width = 0;
  for (const [rowIndex, row] of content.rows.entries()) {
    let column = 0;
    for (const value of row.cells) {
      while ((occupied[column] ?? 0) > rowIndex) column++;
      const cell = richCell(value);
      const colspan = cell.props?.colspan ?? 1;
      const rowspan = cell.props?.rowspan ?? 1;
      if (rowIndex + rowspan > content.rows.length)
        throw new Error("Table row spans exceed the existing rows.");
      for (let offset = 0; offset < colspan; offset++) {
        if ((occupied[column + offset] ?? 0) > rowIndex)
          throw new Error("Table cells overlap.");
        occupied[column + offset] = rowIndex + rowspan;
      }
      column += colspan;
    }
    while ((occupied[column] ?? 0) > rowIndex) column++;
    if (rowIndex === 0) width = column;
    if (!width || column !== width)
      throw new Error("Table additions require a rectangular table.");
  }
  if (!width) throw new Error("Table additions require a nonempty table.");
  if (content.columnWidths && content.columnWidths.length > width)
    throw new Error(
      "Table widths exceed the existing columns. Use a table update to repair the layout.",
    );
  return width;
}

function addedCell(value: Cell) {
  const cell = zTableCell.parse(value);
  if ((cell.props?.colspan ?? 1) !== 1 || (cell.props?.rowspan ?? 1) !== 1)
    throw new Error(
      "New table cells must not be merged. Use a table update for merged additions.",
    );
  return cell;
}

/** Append only new cells; existing headers, widths, spans and content survive. */
export function appendTableRows(
  input: TableContent,
  rows: { cells: Cell[] }[],
): TableContent {
  const content = zTableContent.parse(input);
  const width = tableWidth(content);
  if (!rows.length)
    throw new Error("Table additions require new rows or columns.");
  const additions = rows.map((row) => {
    if (row.cells.length !== width)
      throw new Error(
        "New rows must contain one cell per existing table column.",
      );
    return { cells: row.cells.map(addedCell) };
  });
  return { ...content, rows: [...content.rows, ...additions] };
}

export function appendTableColumns(
  input: TableContent,
  columns: TableColumn[],
): TableContent {
  const content = zTableContent.parse(input);
  const width = tableWidth(content);
  if (!columns.length)
    throw new Error("Table additions require new rows or columns.");
  const additions = columns.map((column) => {
    if (column.cells.length !== content.rows.length)
      throw new Error(
        "New columns must contain one cell per existing table row, including headers.",
      );
    return {
      cells: column.cells.map(addedCell),
      width: z.number().nonnegative().optional().parse(column.width),
    };
  });
  const widths =
    content.columnWidths ||
    additions.some((column) => column.width !== undefined)
      ? Array.from(
          { length: width },
          (_, index) => content.columnWidths?.[index],
        )
      : undefined;
  return {
    ...content,
    ...(widths
      ? {
          columnWidths: [...widths, ...additions.map((column) => column.width)],
        }
      : {}),
    rows: content.rows.map((row, index) => ({
      cells: [
        ...row.cells.map(richCell),
        ...additions.map((column) => column.cells[index] as Cell),
      ],
    })),
  };
}
