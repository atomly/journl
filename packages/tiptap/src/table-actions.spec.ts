// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { undo } from "@tiptap/pm/history";
import { CellSelection } from "@tiptap/pm/tables";
import { expect, test } from "vitest";
import {
  canDropTableAxis,
  canMoveTableAxis,
  captureLink,
  documentExtensions,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  minimumTableSize,
  moveTableAxis,
  resizeTableAxis,
  setTableColumnWidth,
  setTextColor,
  setTextMark,
  tableAxisSelection,
  tableColumnWidth,
  tableContext,
  tableHeadersKey,
  textMarkActive,
  toggleTextMark,
  toTiptapDocument,
} from "./index";

function setup() {
  const editor = new Editor({
    content: toTiptapDocument([
      parseBlock({
        content: {
          columnWidths: [100, 160, 220],
          headerRows: 1,
          rows: [
            { cells: ["A", "B", "C"] },
            { cells: ["D", "E", "F"] },
            { cells: ["", "", ""] },
          ],
          type: "tableContent",
        },
        id: "table",
        type: "table",
      }),
    ]).toJSON(),
    element: document.createElement("div"),
    extensions: [
      ...documentExtensions(),
      editingExtension(() => crypto.randomUUID()),
      identityExtension(() => crypto.randomUUID()),
    ],
  });
  return { editor, saved: () => fromTiptapDocument(editor.state.doc) };
}

test("row and column handles use native full-axis cell selections", () => {
  const { editor } = setup();
  try {
    const row = tableAxisSelection(editor.state, "table", "row", 1);
    const col = tableAxisSelection(editor.state, "table", "column", 2);
    expect(row).toBeInstanceOf(CellSelection);
    expect(row?.isRowSelection()).toBe(true);
    expect(col?.isColSelection()).toBe(true);
    expect(tableAxisSelection(editor.state, "table", "row", -1)).toBeNull();
    expect(tableAxisSelection(editor.state, "missing", "column", 0)).toBeNull();
  } finally {
    editor.destroy();
  }
});

test("native row and column moves retain table identity, cell content and widths", () => {
  const { editor, saved } = setup();
  try {
    const row = moveTableAxis(editor.state, "table", "row", 0, 1);
    expect(row).not.toBeNull();
    if (row) editor.view.dispatch(row);
    expect(
      editor.state.doc.firstChild?.firstChild?.firstChild?.textContent,
    ).toBe("DEF");
    const col = moveTableAxis(editor.state, "table", "column", 0, 2);
    expect(col).not.toBeNull();
    if (col) editor.view.dispatch(col);
    expect(
      editor.state.doc.firstChild?.firstChild?.firstChild?.textContent,
    ).toBe("EFD");
    expect(saved()[0]).toMatchObject({
      content: { columnWidths: [160, 220, 100], headerRows: 1 },
      id: "table",
    });
    expect(fromTiptapDocument(toTiptapDocument(saved()))).toEqual(saved());
  } finally {
    editor.destroy();
  }
});

test("extension rails batch edits for undo and cannot trim authored content", () => {
  const { editor, saved } = setup();
  try {
    const original = saved();
    const grow = resizeTableAxis(editor.state, "table", "row", 6);
    expect(grow).not.toBeNull();
    if (grow) editor.view.dispatch(grow);
    expect(tableContext(editor.state)?.map.height).toBe(6);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(saved()).toEqual(original);
    expect(resizeTableAxis(editor.state, "table", "row", 1)).toBeNull();
    const shrink = resizeTableAxis(editor.state, "table", "row", 2);
    if (shrink) editor.view.dispatch(shrink);
    expect(tableContext(editor.state)?.map.height).toBe(2);
    expect(editor.state.doc.textContent).toBe("ABCDEF");
  } finally {
    editor.destroy();
  }
});

test("spans disable unsafe axis dragging and empty-rail trimming protects reference atoms", () => {
  const document = [
    parseBlock({
      content: {
        rows: [
          {
            cells: [
              { content: "Merged", props: { rowspan: 2 }, type: "tableCell" },
              { content: "B", type: "tableCell" },
            ],
          },
          { cells: [""] },
        ],
        type: "tableContent",
      },
      id: "spans",
      type: "table",
    }),
  ];
  const doc = toTiptapDocument(document);
  const table = doc.firstChild?.firstChild;
  if (!table) throw new Error("Missing table");
  expect(canMoveTableAxis(table, "row", 0)).toBe(false);
  expect(canMoveTableAxis(table, "row", 1)).toBe(false);
  expect(minimumTableSize(table, "row")).toBe(2);
  const referenceTable = toTiptapDocument([
    parseBlock({
      content: {
        rows: [
          { cells: [""] },
          {
            cells: [
              [
                {
                  props: {
                    blockId: "",
                    documentId: "source",
                    label: "",
                    resolutionToken: "",
                    targetKind: "document",
                    url: "/pages/source",
                    version: 1,
                  },
                  type: "contentReference",
                },
              ],
            ],
          },
        ],
        type: "tableContent",
      },
      id: "ref",
      type: "table",
    }),
  ]).firstChild?.firstChild;
  if (!referenceTable) throw new Error("Missing reference table");
  expect(minimumTableSize(referenceTable, "row")).toBe(2);
});

test("separate table actions undo independently even when performed rapidly", async () => {
  const { applyTableEdit } = await import("./table-actions");
  const { editor } = setup();
  try {
    const rows = resizeTableAxis(editor.state, "table", "row", 5);
    if (!rows) throw new Error("Expected row extension");
    applyTableEdit(editor, rows);
    const columns = resizeTableAxis(editor.state, "table", "column", 5);
    if (!columns) throw new Error("Expected column extension");
    applyTableEdit(editor, columns);
    undo(editor.state, editor.view.dispatch);
    expect(tableContext(editor.state)?.map.width).toBe(3);
    expect(tableContext(editor.state)?.map.height).toBe(5);
    undo(editor.state, editor.view.dispatch);
    expect(tableContext(editor.state)?.map.height).toBe(3);
  } finally {
    editor.destroy();
  }
});

test("axis moves allow merged outer boundaries and reject splitting a merged region", () => {
  const { editor, saved } = setup();
  const content = toTiptapDocument([
    parseBlock({
      content: {
        rows: [
          { cells: ["A", "B", "C"] },
          {
            cells: [
              { content: "D", type: "tableCell" },
              {
                content: "Merged",
                props: { colspan: 2, rowspan: 2 },
                type: "tableCell",
              },
            ],
          },
          { cells: ["G"] },
        ],
        type: "tableContent",
      },
      id: "table",
      type: "table",
    }),
  ]).toJSON();
  try {
    for (const axis of ["row", "column"] as const) {
      editor.commands.setContent(content);
      const table = tableContext(editor.state, "table")?.table;
      if (!table) throw new Error("Missing merged table");
      expect(canDropTableAxis(table, axis, 0, 1)).toBe(false);
      expect(canDropTableAxis(table, axis, 0, 2)).toBe(true);
      expect(moveTableAxis(editor.state, "table", axis, 0, 1)).toBeNull();
      const move = moveTableAxis(editor.state, "table", axis, 0, 2);
      if (!move) throw new Error("Expected move past merged region");
      editor.view.dispatch(move);
      const context = tableContext(editor.state, "table");
      expect(context?.map.problems).toBeNull();
      expect(context?.map.width).toBe(3);
      expect(context?.map.height).toBe(3);
      expect(editor.state.doc.textContent).toContain("Merged");
      expect(fromTiptapDocument(toTiptapDocument(saved()))).toEqual(saved());
    }
  } finally {
    editor.destroy();
  }
});

test("formatting applies across all selected cells and leaves other cells untouched", () => {
  const { editor } = setup();
  try {
    const context = tableContext(editor.state, "table");
    if (!context) throw new Error("Missing table");
    const first = context.map.map[0];
    const last = context.map.map[4];
    const bold = editor.schema.marks.bold;
    if (first === undefined || last === undefined || !bold)
      throw new Error("Missing table cells or mark");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        CellSelection.create(
          editor.state.doc,
          context.start + first,
          context.start + last,
        ),
      ),
    );
    for (const change of [
      () => toggleTextMark(editor.state, "bold"),
      () => setTextColor(editor.state, "textColor", "purple"),
      () => setTextMark(editor.state, "link", { href: "https://example.com/" }),
    ]) {
      const tr = change();
      if (!tr) throw new Error("Expected formatting transaction");
      editor.view.dispatch(tr);
    }
    const marks = new Map<string, string[]>();
    editor.state.doc.descendants((node) => {
      if (node.isText && node.text)
        marks.set(node.text, node.marks.map((mark) => mark.type.name).sort());
    });
    for (const text of ["A", "B", "D", "E"])
      expect(marks.get(text)).toEqual(["bold", "link", "textColor"]);
    for (const text of ["C", "F"]) expect(marks.get(text)).toEqual([]);
    expect(textMarkActive(editor.state, "bold")).toBe(true);
    expect(captureLink(editor.state)).toBeNull();
    const relink = setTextMark(editor.state, "link", {
      href: "https://example.com/relinked",
    });
    if (relink) editor.view.dispatch(relink);
    const urls: string[] = [];
    editor.state.doc.descendants((node) => {
      const href = node.marks.find((mark) => mark.type.name === "link")?.attrs
        .href;
      if (href) urls.push(href);
    });
    expect(urls).toEqual(Array(4).fill("https://example.com/relinked"));
    const off = toggleTextMark(editor.state, "bold");
    if (off) editor.view.dispatch(off);
    expect(textMarkActive(editor.state, "bold")).toBe(false);
    // A mixed range should become uniformly bold, rather than toggling only its last cell.
    editor.view.dispatch(
      editor.state.tr.addMark(
        context.start + first + 2,
        context.start + first + 3,
        bold.create(),
      ),
    );
    const mixed = toggleTextMark(editor.state, "bold");
    if (mixed) editor.view.dispatch(mixed);
    expect(textMarkActive(editor.state, "bold")).toBe(true);
  } finally {
    editor.destroy();
  }
});

test("headers expose table semantics and reuse decorations on selection-only changes", () => {
  const { editor } = setup();
  try {
    expect(
      editor.view.dom.querySelectorAll('[role="columnheader"]'),
    ).toHaveLength(3);
    const headers = tableHeadersKey.getState(editor.state);
    const selection = tableAxisSelection(editor.state, "table", "row", 1);
    if (selection)
      editor.view.dispatch(editor.state.tr.setSelection(selection));
    expect(tableHeadersKey.getState(editor.state)).toBe(headers);
    const block = editor.state.doc.firstChild?.firstChild;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(1, undefined, {
        ...block?.attrs,
        headerCols: 1,
      }),
    );
    expect(tableHeadersKey.getState(editor.state)).not.toBe(headers);
    expect(editor.view.dom.querySelectorAll('[role="rowheader"]')).toHaveLength(
      2,
    );
    editor.setEditable(false);
    expect(
      editor.view.dom.querySelectorAll('[role="columnheader"]'),
    ).toHaveLength(3);
  } finally {
    editor.destroy();
  }
});

test("non-drag width changes cover the column, preserve other widths and undo", () => {
  const { editor, saved } = setup();
  try {
    const original = saved();
    const change = setTableColumnWidth(editor.state, "table", 1, 205);
    if (!change) throw new Error("Expected width change");
    editor.view.dispatch(change);
    expect(saved()[0]).toMatchObject({
      content: { columnWidths: [100, 205, 220] },
    });
    const resized = tableContext(editor.state, "table");
    if (!resized) throw new Error("Missing resized table");
    expect(tableColumnWidth(resized.table, 1)).toBe(205);
    expect(setTableColumnWidth(editor.state, "table", 1, 20)).toBeNull();
    undo(editor.state, editor.view.dispatch);
    expect(saved()).toEqual(original);
  } finally {
    editor.destroy();
  }
});
