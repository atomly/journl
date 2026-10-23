"use client";

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
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { EditorMenuItem } from "./tiptap-controls";

export function TableMenuItems({
  editor,
  axis,
}: {
  editor: Editor;
  axis?: TableAxis;
}) {
  const target = selectedBlock(editor.state);
  const table = target?.node.firstChild;
  if (!target || table?.type.name !== "table") return null;
  if (!table.firstChild?.childCount)
    return (
      <EditorMenuItem
        hint="Add editable cells to this empty table"
        onClick={() => {
          const tr = changeBlockType(editor.state, "table");
          if (tr) applyTableEdit(editor, tr);
          editor.view.focus();
        }}
      >
        Add table cells
      </EditorMenuItem>
    );
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
  const cell = selectedTableCell(state);
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
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Table</DropdownMenuLabel>
      {commands
        .filter(([, , , orientation]) => !axis || orientation === axis)
        .map(([label, hint, command]) => (
          <EditorMenuItem
            key={label}
            hint={hint}
            disabled={!command(state)}
            onClick={() => run(command)}
          >
            {label}
          </EditorMenuItem>
        ))}
      {cell &&
        (["row", "column"] as const)
          .filter((orientation) => !axis || axis === orientation)
          .map((orientation) => (
            <EditorMenuItem
              key={`select-${orientation}`}
              hint={`Select every cell in this ${orientation}`}
              onClick={() => {
                const selection = tableAxisSelection(
                  editor.state,
                  cell.id,
                  orientation,
                  orientation === "row" ? cell.row : cell.column,
                );
                if (selection)
                  editor.view.dispatch(editor.state.tr.setSelection(selection));
                editor.view.focus();
              }}
            >
              Select {orientation}
            </EditorMenuItem>
          ))}
      {cell &&
        (["row", "column"] as const)
          .filter((orientation) => !axis || axis === orientation)
          .flatMap((orientation) =>
            ([-1, 1] as const).map((direction) => {
              const from = orientation === "row" ? cell.row : cell.column;
              const label =
                orientation === "row"
                  ? direction < 0
                    ? "Move row up"
                    : "Move row down"
                  : direction < 0
                    ? "Move column left"
                    : "Move column right";
              return (
                <EditorMenuItem
                  key={label}
                  hint={`${label} without dragging`}
                  disabled={
                    !canDropTableAxis(
                      cell.table,
                      orientation,
                      from,
                      from + direction,
                    )
                  }
                  onClick={() => {
                    const tr = moveTableAxis(
                      editor.state,
                      cell.id,
                      orientation,
                      from,
                      from + direction,
                    );
                    if (tr) applyTableEdit(editor, tr);
                    editor.view.focus();
                  }}
                >
                  {label}
                </EditorMenuItem>
              );
            }),
          )}
      {cell &&
        axis !== "row" &&
        ([-20, 20] as const).map((delta) => {
          const width = Math.max(
            35,
            tableColumnWidth(cell.table, cell.column) + delta,
          );
          const label = delta < 0 ? "Narrow column" : "Widen column";
          return (
            <EditorMenuItem
              key={label}
              hint={`${label} to ${width} pixels without dragging`}
              disabled={
                delta < 0 &&
                tableColumnWidth(cell.table, cell.column) <=
                  TABLE_MIN_COLUMN_WIDTH
              }
              onClick={() => {
                const tr = setTableColumnWidth(
                  editor.state,
                  cell.id,
                  cell.column,
                  width,
                );
                if (tr) applyTableEdit(editor, tr);
                editor.view.focus();
              }}
            >
              {label}
            </EditorMenuItem>
          );
        })}
      {(["headerRows", "headerCols"] as const)
        .filter(
          (key) =>
            !axis || key === (axis === "row" ? "headerRows" : "headerCols"),
        )
        .map((key) => (
          <EditorMenuItem
            key={key}
            hint={
              key === "headerRows"
                ? "Style the first row as a header"
                : "Style the first column as a header"
            }
            onClick={() => {
              applyTableEdit(
                editor,
                editor.state.tr.setNodeMarkup(target.pos + 1, undefined, {
                  ...table.attrs,
                  [key]: table.attrs[key] ? 0 : 1,
                }),
              );
              editor.view.focus();
            }}
          >
            {table.attrs[key] ? "Remove" : "Add"}{" "}
            {key === "headerRows" ? "header row" : "header column"}
          </EditorMenuItem>
        ))}
      <DropdownMenuSeparator />
    </DropdownMenuGroup>
  );
}
