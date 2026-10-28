// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { expect, test } from "vitest";
import { documentExtensions } from "../engine/schema";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { tableMenuActions } from "./table-actions";

test("table menus keep axis eligibility and execute native edits on the same OpenEditor block", () => {
  const editor = new Editor({
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
