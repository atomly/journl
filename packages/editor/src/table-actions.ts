import {
  applyTableEdit,
  canDropTableAxis,
  changeBlockType,
  moveTableAxis,
  selectedBlock,
  selectedTableCell,
  setTableColumnWidth,
  TABLE_MIN_COLUMN_WIDTH,
  type TableAxis,
  tableAxisSelection,
  tableColumnWidth,
} from "@acme/tiptap";
import type { Editor } from "@tiptap/core";
import { type Command, TextSelection } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  isInTable,
  mergeCells,
  splitCell,
} from "@tiptap/pm/tables";

export type TableMenuAction = {
  label: string;
  hint: string;
  disabled?: boolean;
  run: () => void;
};

/** Commands and availability are independent of menu primitives. */
export function tableMenuActions(
  editor: Editor,
  axis?: TableAxis,
): TableMenuAction[] {
  const target = selectedBlock(editor.state);
  const table = target?.node.firstChild;
  if (!target || table?.type.name !== "table") return [];
  if (!table.firstChild?.childCount)
    return [
      {
        hint: "Add editable cells to this empty table",
        label: "Add table cells",
        run() {
          const tr = changeBlockType(editor.state, "table");
          if (tr) applyTableEdit(editor, tr);
          editor.view.focus();
        },
      },
    ];
  const state = isInTable(editor.state)
    ? editor.state
    : editor.state.apply(
        editor.state.tr.setSelection(
          TextSelection.near(editor.state.doc.resolve(target.pos + 5)),
        ),
      );
  const run = (command: Command) => {
    if (state !== editor.state)
      editor.view.dispatch(editor.state.tr.setSelection(state.selection));
    command(editor.state, (tr) => applyTableEdit(editor, tr), editor.view);
    editor.view.focus();
  };
  const commands: [string, string, Command, TableAxis?][] = [
    [
      "Insert row above",
      "Add a row above the selected cell",
      addRowBefore,
      "row",
    ],
    [
      "Insert row below",
      "Add a row below the selected cell",
      addRowAfter,
      "row",
    ],
    [
      "Insert column left",
      "Add a column to the left of the selected cell",
      addColumnBefore,
      "column",
    ],
    [
      "Insert column right",
      "Add a column to the right of the selected cell",
      addColumnAfter,
      "column",
    ],
    [
      "Delete row",
      "Remove the selected rows and their content",
      deleteRow,
      "row",
    ],
    [
      "Delete column",
      "Remove the selected columns and their content",
      deleteColumn,
      "column",
    ],
    ["Merge cells", "Combine the selected rectangular cell range", mergeCells],
    ["Split cell", "Split a merged cell into separate cells", splitCell],
  ];
  const actions: TableMenuAction[] = commands
    .filter(([, , , orientation]) => !axis || orientation === axis)
    .map(([label, hint, command]) => ({
      disabled: !command(state),
      hint,
      label,
      run: () => run(command),
    }));
  const cell = selectedTableCell(state);
  const orientations = (["row", "column"] as const).filter(
    (orientation) => !axis || axis === orientation,
  );
  if (cell) {
    for (const orientation of orientations)
      actions.push({
        hint: `Select every cell in this ${orientation}`,
        label: `Select ${orientation}`,
        run() {
          const selection = tableAxisSelection(
            editor.state,
            cell.id,
            orientation,
            orientation === "row" ? cell.row : cell.column,
          );
          if (selection)
            editor.view.dispatch(editor.state.tr.setSelection(selection));
          editor.view.focus();
        },
      });
    for (const orientation of orientations)
      for (const direction of [-1, 1] as const) {
        const from = orientation === "row" ? cell.row : cell.column;
        const label =
          orientation === "row"
            ? direction < 0
              ? "Move row up"
              : "Move row down"
            : direction < 0
              ? "Move column left"
              : "Move column right";
        actions.push({
          disabled: !canDropTableAxis(
            cell.table,
            orientation,
            from,
            from + direction,
          ),
          hint: `${label} without dragging`,
          label,
          run() {
            const tr = moveTableAxis(
              editor.state,
              cell.id,
              orientation,
              from,
              from + direction,
            );
            if (tr) applyTableEdit(editor, tr);
            editor.view.focus();
          },
        });
      }
    if (axis !== "row")
      for (const delta of [-20, 20] as const) {
        const width = Math.max(
          TABLE_MIN_COLUMN_WIDTH,
          tableColumnWidth(cell.table, cell.column) + delta,
        );
        const label = delta < 0 ? "Narrow column" : "Widen column";
        actions.push({
          disabled:
            delta < 0 &&
            tableColumnWidth(cell.table, cell.column) <= TABLE_MIN_COLUMN_WIDTH,
          hint: `${label} to ${width} pixels without dragging`,
          label,
          run() {
            const tr = setTableColumnWidth(
              editor.state,
              cell.id,
              cell.column,
              width,
            );
            if (tr) applyTableEdit(editor, tr);
            editor.view.focus();
          },
        });
      }
  }
  for (const key of ["headerRows", "headerCols"] as const) {
    if (axis && key !== (axis === "row" ? "headerRows" : "headerCols"))
      continue;
    actions.push({
      hint:
        key === "headerRows"
          ? "Style the first row as a header"
          : "Style the first column as a header",
      label: `${table.attrs[key] ? "Remove" : "Add"} ${key === "headerRows" ? "header row" : "header column"}`,
      run() {
        applyTableEdit(
          editor,
          editor.state.tr.setNodeMarkup(target.pos + 1, undefined, {
            ...table.attrs,
            [key]: table.attrs[key] ? 0 : 1,
          }),
        );
        editor.view.focus();
      },
    });
  }
  return actions;
}
