// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { documentExtensions } from "../engine/schema";
import {
  selectedTableCell,
  setTableColumnWidth,
  tableContext,
} from "../engine/table-actions";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { tableMenuActions } from "./table-actions";

function fixture() {
  return new Editor({
    content: toTiptapDocument([
      parseBlock({
        content: {
          columnWidths: [100, 150],
          rows: [{ cells: ["A", "B"] }, { cells: ["C", "D"] }],
          type: "tableContent",
        },
        id: "table",
        type: "table",
      }),
    ]).toJSON(),
    element: document.createElement("div"),
    extensions: documentExtensions(),
  });
}

test("table menus keep axis eligibility and execute native edits on the same BetterEditor block", () => {
  const editor = fixture();
  try {
    const rows = tableMenuActions(editor, "row");
    expect(rows.some(({ label }) => label === "Insert column right")).toBe(
      false,
    );
    expect(rows.some(({ label }) => label === "Merge cells")).toBe(false);
    expect(
      tableMenuActions(editor).find(({ label }) => label === "Merge cells")
        ?.disabled,
    ).toBe(true);
    rows.find(({ label }) => label === "Insert row below")?.run();
    const saved = fromTiptapDocument(editor.state.doc);
    expect(saved[0]?.id).toBe("table");
    const content = saved[0]?.content;
    if (
      !content ||
      Array.isArray(content) ||
      typeof content === "string" ||
      content.type !== "tableContent"
    )
      throw new Error("Expected table content");
    expect(content.rows).toHaveLength(3);
    expect(content.rows[0]?.cells[0]).toMatchObject([{ text: "A" }]);
    expect(content.rows[1]?.cells).toMatchObject([
      { content: [] },
      { content: [] },
    ]);
    expect(content.rows[2]?.cells[0]).toMatchObject([{ text: "C" }]);
  } finally {
    editor.destroy();
  }
});

test("retained table commands use the current document after typing", () => {
  const editor = fixture();
  try {
    const insert = tableMenuActions(editor).find(
      (action) => action.label === "Insert row below",
    );
    editor.commands.insertContent("new");
    expect(() => insert?.run()).not.toThrow();
    const context = tableContext(editor.state);
    expect(context?.map.height).toBe(3);
    expect(editor.state.doc.textContent).toContain("new");
  } finally {
    editor.destroy();
  }
});

test("retained width and axis actions resolve the current cell and width", () => {
  const editor = fixture();
  try {
    const actions = tableMenuActions(editor);
    const context = tableContext(editor.state);
    if (!context) throw new Error("Missing table");
    const cell = context.map.map[3];
    if (cell === undefined) throw new Error("Missing cell");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.near(editor.state.doc.resolve(context.start + cell + 1)),
      ),
    );
    const resize = setTableColumnWidth(editor.state, "table", 1, 220);
    if (!resize) throw new Error("Missing resize");
    editor.view.dispatch(resize);
    actions.find((action) => action.label === "Widen column")?.run();
    expect(
      selectedTableCell(editor.state)?.table.firstChild?.lastChild?.attrs
        .colwidth,
    ).toEqual([240]);
    actions.find((action) => action.label === "Select row")?.run();
    expect(selectedTableCell(editor.state)?.row).toBe(1);
    expect(selectedTableCell(editor.state)?.column).toBe(0);
  } finally {
    editor.destroy();
  }
});

test("retained header actions resolve moved tables and preserve newer attributes", () => {
  const editor = fixture();
  try {
    const action = tableMenuActions(editor).find(
      (item) => item.label === "Add header row",
    );
    const wrapper = editor.schema.nodes.betterEditorBlock;
    const paragraph = editor.schema.nodes.paragraph;
    if (!wrapper || !paragraph) throw new Error("Missing schema");
    editor.view.dispatch(
      editor.state.tr.insert(
        0,
        wrapper.createChecked({ id: "before" }, paragraph.create()),
      ),
    );
    const context = tableContext(editor.state);
    if (!context) throw new Error("Missing moved table");
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(context.start - 1, undefined, {
        ...context.table.attrs,
        headerCols: 1,
      }),
    );
    expect(() => action?.run()).not.toThrow();
    expect(tableContext(editor.state)?.table.attrs).toMatchObject({
      headerCols: 1,
      headerRows: 1,
    });
    expect(editor.state.doc.firstChild?.firstChild?.type.name).toBe(
      "paragraph",
    );
  } finally {
    editor.destroy();
  }
});

for (const unavailable of ["read-only", "removed"] as const) {
  test(`retained table actions are safe when ${unavailable}`, () => {
    const editor = fixture();
    try {
      const actions = tableMenuActions(editor);
      if (unavailable === "read-only") {
        editor.setEditable(false);
        expect(
          tableMenuActions(editor).every((action) => action.disabled),
        ).toBe(true);
      } else editor.commands.clearContent();
      const before = editor.state.doc.toJSON();
      for (const action of actions) expect(() => action.run()).not.toThrow();
      expect(editor.state.doc.toJSON()).toEqual(before);
    } finally {
      editor.destroy();
    }
  });
}
