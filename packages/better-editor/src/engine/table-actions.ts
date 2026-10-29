import { closeHistory } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import {
  type EditorState,
  Selection,
  type Transaction,
} from "@tiptap/pm/state";
import {
  addColumnAfter,
  addRowAfter,
  CellSelection,
  cellAround,
  deleteColumn,
  deleteRow,
  moveTableColumn,
  moveTableRow,
  TableMap,
} from "@tiptap/pm/tables";
import { selectedBlock } from "./commands";
import { blockAt } from "./identity";
import { TABLE_DEFAULT_COLUMN_WIDTH, TABLE_MIN_COLUMN_WIDTH } from "./tables";

export type TableAxis = "row" | "column";

/** Positions and table maps stay in the frontend adapter, never in storage. */
export function tableContext(
  state: Pick<EditorState, "doc" | "selection">,
  id?: string,
) {
  let block: { node: Node; pos: number } | null;
  try {
    block = id ? blockAt(state.doc, id) : selectedBlock(state);
  } catch {
    return null;
  }
  const table = block?.node.firstChild;
  if (!block || table?.type.name !== "table" || !table.firstChild?.childCount)
    return null;
  return {
    id: block.node.attrs.id as string,
    map: TableMap.get(table),
    start: block.pos + 2,
    table,
  };
}

export function selectedTableCell(state: EditorState) {
  const context = tableContext(state);
  if (!context) return null;
  const cell =
    state.selection instanceof CellSelection
      ? state.selection.$anchorCell
      : cellAround(state.selection.$from);
  if (!cell) return null;
  const rect = context.map.findCell(cell.pos - context.start);
  return { ...context, column: rect.left, row: rect.top };
}

export function tableColumnWidth(table: Node, index: number) {
  const map = TableMap.get(table);
  for (const pos of axisCells(map, "column", index)) {
    const width =
      table.nodeAt(pos)?.attrs.colwidth?.[index - map.findCell(pos).left];
    if (typeof width === "number" && width > 0) return width;
  }
  return TABLE_DEFAULT_COLUMN_WIDTH;
}

/** Match the native resize plugin's colwidth attributes across a logical column,
 * including a column inside a merged cell. No editor data reaches storage. */
export function setTableColumnWidth(
  state: EditorState,
  id: string,
  index: number,
  width: number,
) {
  const context = tableContext(state, id);
  if (
    !context ||
    index < 0 ||
    index >= context.map.width ||
    !Number.isFinite(width) ||
    width < TABLE_MIN_COLUMN_WIDTH
  )
    return null;
  const tr = state.tr;
  for (const pos of axisCells(context.map, "column", index)) {
    const cell = context.table.nodeAt(pos);
    if (!cell) continue;
    const offset = index - context.map.findCell(pos).left;
    const colwidth: number[] =
      cell.attrs.colwidth?.slice() ?? Array(cell.attrs.colspan).fill(0);
    colwidth[offset] = Math.round(width);
    tr.setNodeMarkup(context.start + pos, undefined, {
      ...cell.attrs,
      colwidth,
    });
  }
  return tr.docChanged ? tr : null;
}

export function tableAxisSelection(
  state: EditorState,
  id: string,
  axis: TableAxis,
  index: number,
) {
  const context = tableContext(state, id);
  if (!context) return null;
  const { map, start } = context;
  if (index < 0 || index >= (axis === "row" ? map.height : map.width))
    return null;
  const first = map.map[axis === "row" ? index * map.width : index];
  const last =
    map.map[
      axis === "row"
        ? (index + 1) * map.width - 1
        : (map.height - 1) * map.width + index
    ];
  if (first === undefined || last === undefined) return null;
  const a = state.doc.resolve(start + first);
  const b = state.doc.resolve(start + last);
  return axis === "row"
    ? CellSelection.rowSelection(a, b)
    : CellSelection.colSelection(a, b);
}

export function canMoveTableAxis(table: Node, axis: TableAxis, index: number) {
  const map = TableMap.get(table);
  if (index < 0 || index >= (axis === "row" ? map.height : map.width))
    return false;
  return axisCells(map, axis, index).every(
    (pos) =>
      table.nodeAt(pos)?.attrs[axis === "row" ? "rowspan" : "colspan"] === 1,
  );
}

/** A single axis may land at a merged region's outer edge, never inside it. */
export function canDropTableAxis(
  table: Node,
  axis: TableAxis,
  from: number,
  to: number,
) {
  const map = TableMap.get(table);
  if (
    !canMoveTableAxis(table, axis, from) ||
    to < 0 ||
    to >= (axis === "row" ? map.height : map.width)
  )
    return false;
  return axisCells(map, axis, to).every((pos) => {
    const rect = map.findCell(pos);
    return axis === "row"
      ? (from < to ? rect.bottom - 1 : rect.top) === to
      : (from < to ? rect.right - 1 : rect.left) === to;
  });
}

function axisCells(map: TableMap, axis: TableAxis, index: number) {
  return [
    ...new Set(
      Array.from(
        { length: axis === "row" ? map.width : map.height },
        (_, i) =>
          map.map[
            axis === "row" ? index * map.width + i : i * map.width + index
          ],
      ),
    ),
  ].filter((pos): pos is number => pos !== undefined);
}

export function moveTableAxis(
  state: EditorState,
  id: string,
  axis: TableAxis,
  from: number,
  to: number,
): Transaction | null {
  const context = tableContext(state, id);
  if (
    !context ||
    from === to ||
    !canDropTableAxis(context.table, axis, from, to)
  )
    return null;
  const command = axis === "row" ? moveTableRow : moveTableColumn;
  let result: Transaction | null = null;
  command({ from, pos: context.start, to })(state, (tr) => {
    result = tr;
  });
  return result;
}

function emptyAxis(table: Node, map: TableMap, axis: TableAxis, index: number) {
  return axisCells(map, axis, index).every((pos) => {
    const cell = table.nodeAt(pos);
    return (
      cell?.attrs[axis === "row" ? "rowspan" : "colspan"] === 1 &&
      cell.childCount === 1 &&
      cell.firstChild?.content.size === 0
    );
  });
}

/** Extension rails can remove only empty trailing rows/columns. References,
 * whitespace, merged cells and authored content all stop shrinking. */
export function minimumTableSize(table: Node, axis: TableAxis) {
  const map = TableMap.get(table);
  let size = axis === "row" ? map.height : map.width;
  while (size > 1 && emptyAxis(table, map, axis, size - 1)) size--;
  return size;
}

/** Batch the library's own commands into one view update and one undo event. */
export function resizeTableAxis(
  state: EditorState,
  id: string,
  axis: TableAxis,
  count: number,
) {
  const context = tableContext(state, id);
  if (!context || !Number.isInteger(count) || count < 1) return null;
  const original = axis === "row" ? context.map.height : context.map.width;
  if (
    count === original ||
    (count < original && count < minimumTableSize(context.table, axis))
  )
    return null;
  const tr = state.tr;
  let working = state;
  for (
    let size = original;
    size !== count;
    size += Math.sign(count - original)
  ) {
    const selection = tableAxisSelection(working, id, axis, size - 1);
    if (!selection) return null;
    const selected = working.apply(working.tr.setSelection(selection));
    const command =
      axis === "row"
        ? count > original
          ? addRowAfter
          : deleteRow
        : count > original
          ? addColumnAfter
          : deleteColumn;
    let edited = false;
    command(selected, (change) => {
      for (const step of change.steps) tr.step(step);
      tr.setSelection(Selection.fromJSON(tr.doc, change.selection.toJSON()));
      working = selected.apply(change);
      edited = true;
    });
    if (!edited) return null;
  }
  return tr;
}

/** One table menu/drag action is one undo event, separate from later typing. */
export function applyTableEdit(
  editor: import("@tiptap/core").Editor,
  tr: Transaction,
) {
  if (
    editor.isDestroyed ||
    !editor.isEditable ||
    tr.before !== editor.state.doc
  )
    return;
  editor.view.dispatch(closeHistory(tr));
  editor.view.dispatch(closeHistory(editor.state.tr));
}
