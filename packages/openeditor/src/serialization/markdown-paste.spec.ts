// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { clipboardPasteExtension } from "../engine/clipboard-paste";
import { identityExtension } from "../engine/identity";
import { documentExtensions } from "../engine/schema";
import { fromTiptapDocument, toTiptapDocument } from "./tiptap";

function setup() {
  let id = 0;
  const fresh = () => `paste-${++id}`;
  const editor = new Editor({
    content: toTiptapDocument([{ id: "original", type: "paragraph" }]).toJSON(),
    element: document.createElement("div"),
    extensions: [
      ...documentExtensions(),
      clipboardPasteExtension(fresh),
      identityExtension(fresh),
    ],
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
  );
  return editor;
}

test("plain multiline bullets paste as ordered owned blocks with nesting and formatting", () => {
  const editor = setup();
  try {
    editor.view.pasteText(
      "- First **bold**\n  - Child\n- Second\n\n1. One\n2. Two",
      new Event("paste") as ClipboardEvent,
    );
    const blocks = fromTiptapDocument(editor.state.doc);
    expect(blocks.map((block) => block.type)).toEqual([
      "bulletListItem",
      "bulletListItem",
      "numberedListItem",
      "numberedListItem",
    ]);
    expect(blocks[0]?.children?.[0]).toMatchObject({
      content: [{ text: "Child" }],
      type: "bulletListItem",
    });
    expect(JSON.stringify(blocks[0]?.content)).toContain('"bold":true');
    const ids: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "openeditorBlock") ids.push(node.attrs.id);
    });
    expect(new Set(ids).size).toBe(ids.length);
    editor.state.doc.check();
  } finally {
    editor.destroy();
  }
});

test("raw HTML and unsafe markdown links remain inert during plain-text paste", () => {
  const editor = setup();
  try {
    editor.view.pasteText(
      "- <script>alert(1)</script>\n- [Unsafe](javascript:alert)",
      new Event("paste") as ClipboardEvent,
    );
    expect(editor.view.dom.querySelector("script")).toBeNull();
    expect(editor.view.dom.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(editor.state.doc.textContent).toContain("<script>");
  } finally {
    editor.destroy();
  }
});

test("rich HTML lists use the same owned nesting and preserve marks and numbering", () => {
  const editor = setup();
  try {
    editor.view.pasteHTML(
      '<ul><li><strong>First</strong><ul><li>Child</li></ul></li><li>Second</li></ul><ol start="3"><li>Three</li><li>Four</li></ol>',
      new Event("paste") as ClipboardEvent,
    );
    const blocks = fromTiptapDocument(editor.state.doc);
    expect(blocks.map((block) => block.type)).toEqual([
      "bulletListItem",
      "bulletListItem",
      "numberedListItem",
      "numberedListItem",
    ]);
    expect(blocks[0]?.children?.[0]).toMatchObject({
      content: [{ text: "Child" }],
      type: "bulletListItem",
    });
    expect(JSON.stringify(blocks[0]?.content)).toContain('"bold":true');
    expect(blocks[2]).toMatchObject({ props: { start: 3 } });
    expect(blocks[3]).toMatchObject({ props: { start: 4 } });
    editor.state.doc.check();
  } finally {
    editor.destroy();
  }
});

test("structured paste in the middle of writing keeps both surrounding fragments", () => {
  const editor = setup();
  try {
    editor.view.dispatch(editor.state.tr.insertText("Before after"));
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 9)),
    );
    editor.view.pasteText("- One\n- Two", new Event("paste") as ClipboardEvent);
    expect(editor.state.doc.textContent).toBe("Before OneTwoafter");
    expect(
      fromTiptapDocument(editor.state.doc).filter(
        (block) => block.type === "bulletListItem",
      ),
    ).toHaveLength(2);
    editor.state.doc.check();
  } finally {
    editor.destroy();
  }
});

test("multiline paste into code stays literal instead of turning into document blocks", () => {
  const editor = setup();
  try {
    editor.commands.setContent(
      toTiptapDocument(
        [{ id: "code", props: { language: "text" }, type: "codeBlock" }],
        editor.schema,
      ).toJSON(),
    );
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
    );
    editor.view.pasteText("- One\n- Two", new Event("paste") as ClipboardEvent);
    expect(fromTiptapDocument(editor.state.doc)).toMatchObject([
      { content: "- One\n- Two", id: "code", type: "codeBlock" },
    ]);
  } finally {
    editor.destroy();
  }
});

test("single-line plain paste keeps the destination's active text formatting", () => {
  const editor = setup();
  try {
    const tr = editor.state.tr.insertText("Bold");
    const bold = editor.schema.marks.bold;
    if (!bold) throw new Error("Missing bold mark");
    tr.addMark(2, 6, bold.create());
    editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 6)));
    editor.view.pasteText(" more", new Event("paste") as ClipboardEvent);
    expect(editor.state.doc.textContent).toBe("Bold more");
    expect(
      editor.state.doc
        .nodeAt(2)
        ?.marks.some((mark) => mark.type.name === "bold"),
    ).toBe(true);
    expect(
      editor.state.doc
        .nodeAt(6)
        ?.marks.some((mark) => mark.type.name === "bold"),
    ).toBe(true);
  } finally {
    editor.destroy();
  }
});
