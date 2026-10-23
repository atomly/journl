// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addRowAfter,
  CellSelection,
  mergeCells,
  splitCell,
  TableMap,
} from "@tiptap/pm/tables";
import { expect, test } from "vitest";
import {
  blockAt,
  documentExtensions,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  toTiptapDocument,
} from "./index";

test("native table commands preserve Journl identity, content, spans and resized widths", () => {
  let id = 0;
  const editor = new Editor({
    content: toTiptapDocument([
      parseBlock({
        content: {
          columnWidths: [120, 140],
          headerRows: 1,
          rows: [{ cells: ["A", "B"] }, { cells: ["C", "D"] }],
          type: "tableContent",
        },
        id: "table",
        type: "table",
      }),
    ]).toJSON(),
    element: document.createElement("div"),
    extensions: [
      ...documentExtensions(),
      editingExtension(() => `new-${++id}`),
      identityExtension(() => `new-${++id}`),
    ],
  });
  const blocks = () => fromTiptapDocument(editor.state.doc);
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 5)),
    );
    expect(addRowAfter(editor.state, editor.view.dispatch)).toBe(true);
    expect(addColumnAfter(editor.state, editor.view.dispatch)).toBe(true);
    let table = editor.state.doc.firstChild?.firstChild;
    expect(table?.childCount).toBe(3);
    expect(table?.firstChild?.childCount).toBe(3);
    expect(blocks()[0]?.id).toBe("table");
    if (!table) throw new Error("Table missing");
    const map = TableMap.get(table);
    const start = blockAt(editor.state.doc, "table").pos + 2;
    const first = start + (map.map[0] ?? 0);
    const second = start + (map.map[1] ?? 0);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        CellSelection.create(editor.state.doc, first, second),
      ),
    );
    expect(mergeCells(editor.state, editor.view.dispatch)).toBe(true);
    expect(JSON.stringify(blocks())).toContain('"colspan":2');
    expect(splitCell(editor.state, editor.view.dispatch)).toBe(true);
    table = editor.state.doc.firstChild?.firstChild;
    const cell = table?.firstChild?.firstChild;
    if (!cell) throw new Error("Cell missing");
    const resize = editor.state.tr;
    if (!table) throw new Error("Table missing after splitting");
    const currentMap = TableMap.get(table);
    const positions = new Set(
      Array.from(
        { length: currentMap.height },
        (_, row) => start + (currentMap.map[row * currentMap.width] ?? 0),
      ),
    );
    for (const pos of positions) {
      const current = resize.doc.nodeAt(pos);
      if (current)
        resize.setNodeMarkup(pos, undefined, {
          ...current.attrs,
          colwidth: [210],
        });
    }
    editor.view.dispatch(resize);
    const saved = blocks();
    expect(saved[0]).toMatchObject({
      content: { columnWidths: [210, undefined, 140], headerRows: 1 },
      id: "table",
    });
    expect(JSON.stringify(saved)).toContain('"text":"A"');
    expect(JSON.stringify(saved)).toContain('"text":"D"');
    expect(fromTiptapDocument(toTiptapDocument(saved))).toEqual(saved);
  } finally {
    editor.destroy();
  }
});

test("table widths follow logical columns across row spans", () => {
  const source = parseBlock({
    content: {
      columnWidths: [100, 240],
      rows: [
        {
          cells: [
            { content: "Spanning", props: { rowspan: 2 }, type: "tableCell" },
            { content: "Top right", type: "tableCell" },
          ],
        },
        { cells: [{ content: "Bottom right", type: "tableCell" }] },
      ],
      type: "tableContent",
    },
    id: "spans",
    type: "table",
  });
  const doc = toTiptapDocument([source]);
  expect(
    doc.firstChild?.firstChild?.lastChild?.firstChild?.attrs.colwidth,
  ).toEqual([240]);
  const saved = fromTiptapDocument(doc);
  expect(saved[0]).toMatchObject({
    content: { columnWidths: [100, 240] },
    id: "spans",
  });
  expect(fromTiptapDocument(toTiptapDocument(saved))).toEqual(saved);
});
