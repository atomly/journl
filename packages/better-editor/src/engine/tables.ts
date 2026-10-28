import { Extension, type NodeViewRendererProps } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import {
  columnResizing,
  goToNextCell,
  isInTable,
  moveCellForward,
  nextCell,
  selectionCell,
  TableMap,
  TableView,
  tableEditing,
} from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const TABLE_MIN_COLUMN_WIDTH = 35;
export const TABLE_DEFAULT_COLUMN_WIDTH = 120;

export const tableHeadersKey = new PluginKey<DecorationSet>(
  "better-editor-table-headers",
);

function tableHeaders(doc: Node) {
  const decorations: Decoration[] = [];
  doc.descendants((table, pos) => {
    if (table.type.name !== "table") return;
    if (!table.attrs.headerRows && !table.attrs.headerCols) return false;
    const map = TableMap.get(table);
    for (const offset of new Set(map.map)) {
      const cell = table.nodeAt(offset);
      if (!cell) continue;
      const rect = map.findCell(offset);
      const columnHeader = rect.top < (table.attrs.headerRows ?? 0);
      const rowHeader = rect.left < (table.attrs.headerCols ?? 0);
      if (columnHeader || rowHeader)
        decorations.push(
          Decoration.node(pos + 1 + offset, pos + 1 + offset + cell.nodeSize, {
            "aria-colindex": String(rect.left + 1),
            "aria-rowindex": String(rect.top + 1),
            "data-header-cell": "true",
            role: columnHeader ? "columnheader" : "rowheader",
          }),
        );
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/** The same open-source editing and resize foundation used by BlockNote.
 * Only the frontend schema knows the library's cell attributes/paragraphs. */
export function tableExtension() {
  return Extension.create({
    addKeyboardShortcuts() {
      const tab = (direction: 1 | -1) => {
        const { state, view } = this.editor;
        if (view.composing || !isInTable(state)) return false;
        goToNextCell(direction)(state, view.dispatch);
        return true;
      };
      return {
        Backspace: () => {
          const { state } = this.editor;
          return (
            isInTable(state) &&
            state.selection.empty &&
            state.selection.$from.parentOffset === 0
          );
        },
        Enter: () => {
          const { state, view } = this.editor;
          if (view.composing || !isInTable(state)) return false;
          const next = nextCell(selectionCell(state), "vert", 1);
          if (next)
            view.dispatch(
              state.tr
                .setSelection(
                  TextSelection.between(next, moveCellForward(next)),
                )
                .scrollIntoView(),
            );
          return true;
        },
        "Shift-Tab": () => tab(-1),
        Tab: () => tab(1),
      };
    },
    addProseMirrorPlugins: () => [
      new Plugin<DecorationSet>({
        key: tableHeadersKey,
        props: { decorations: (state) => tableHeadersKey.getState(state) },
        state: {
          apply: (tr, previous) =>
            tr.docChanged ? tableHeaders(tr.doc) : previous,
          init: (_, state) => tableHeaders(state.doc),
        },
      }),
      columnResizing({
        cellMinWidth: TABLE_MIN_COLUMN_WIDTH,
        defaultCellMinWidth: TABLE_DEFAULT_COLUMN_WIDTH,
        View: null,
      }),
      tableEditing(),
    ],
    extendNodeSchema(extension) {
      return {
        tableRole: (
          { table: "table", tableCell: "cell", tableRow: "row" } as Record<
            string,
            string
          >
        )[extension.name],
      };
    },
    name: "better-editor-tables",
    priority: 1100,
  });
}

export function tableNodeView({ node }: NodeViewRendererProps) {
  const view = new TableView(node, TABLE_DEFAULT_COLUMN_WIDTH);
  view.dom.classList.add("better-editor-table-wrapper");
  view.table.dataset.betterEditorBody = "table";
  return view;
}
