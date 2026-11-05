// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { clipboardPasteExtension } from "../engine/clipboard-paste";
import { identityExtension } from "../engine/identity";
import { testDocumentExtensions } from "../testing/extensions";
import { fromTiptapDocument, toTiptapDocument } from "./tiptap";

function setup() {
  let id = 0;
  const fresh = () => `paste-${++id}`;
  const editor = new Editor({
    content: toTiptapDocument([{ id: "original", type: "paragraph" }]).toJSON(),
    element: document.createElement("div"),
    extensions: [
      ...testDocumentExtensions(),
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
      if (node.type.name === "betterEditorBlock") ids.push(node.attrs.id);
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

test("a single rich paragraph inserts inline at the current text selection", () => {
  const editor = setup();
  try {
    editor.view.dispatch(editor.state.tr.insertText("Before after"));
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 9)),
    );
    editor.view.pasteHTML(
      "<div><p><strong>Pasted</strong></p></div>",
      new Event("paste") as ClipboardEvent,
    );
    const blocks = fromTiptapDocument(editor.state.doc);
    expect(blocks).toHaveLength(1);
    expect(editor.state.doc.textContent).toBe("Before Pastedafter");
    expect(JSON.stringify(blocks[0]?.content)).toContain('"bold":true');
  } finally {
    editor.destroy();
  }
});

test("external rich paragraphs and headings remain siblings instead of forming a staircase", () => {
  const editor = setup();
  try {
    editor.view.pasteHTML(
      "<div><h2>Recipe</h2><p>Duration</p><p>Servings</p><h3>Ingredients</h3><ul><li>First<ul><li>Nested</li></ul></li><li>Second</li></ul><p>Instructions</p></div>",
      new Event("paste") as ClipboardEvent,
    );
    const blocks = fromTiptapDocument(editor.state.doc);
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
      "heading",
      "bulletListItem",
      "bulletListItem",
      "paragraph",
    ]);
    expect(blocks.map((block) => block.children?.length ?? 0)).toEqual([
      0, 0, 0, 0, 1, 0, 0,
    ]);
    expect(JSON.stringify(blocks[4]?.children)).toContain("Nested");
  } finally {
    editor.destroy();
  }
});

test("many external paragraphs, inline prefixes and blockquote paragraphs stay shallow", () => {
  const editor = setup();
  try {
    editor.view.pasteHTML(
      "Preface <strong>bold</strong>" +
        Array.from({ length: 50 }, (_, index) => `<p>Line ${index}</p>`).join(
          "",
        ) +
        "<blockquote><p>Quote one</p><p>Quote two</p></blockquote>",
      new Event("paste") as ClipboardEvent,
    );
    const blocks = fromTiptapDocument(editor.state.doc);
    expect(blocks).toHaveLength(53);
    expect(blocks.every((block) => !block.children?.length)).toBe(true);
    expect(blocks.slice(-2).map((block) => block.type)).toEqual([
      "quote",
      "quote",
    ]);
    expect(JSON.stringify(blocks[0]?.content)).toContain('"bold":true');
  } finally {
    editor.destroy();
  }
});

test("quoted lists and nested lists inside container divs retain their structure", () => {
  const editor = setup();
  try {
    editor.view.pasteHTML(
      "<blockquote><p>Lead</p><ul><li><div><p>Parent</p><div><ul><li>Child</li></ul></div></div></li><li>Sibling</li></ul><p>Tail</p></blockquote>",
      new Event("paste") as ClipboardEvent,
    );
    const blocks = fromTiptapDocument(editor.state.doc);
    expect(blocks.map((block) => block.type)).toEqual([
      "quote",
      "bulletListItem",
      "bulletListItem",
      "quote",
    ]);
    expect(blocks[1]?.children?.[0]).toMatchObject({
      content: [{ text: "Child" }],
      type: "bulletListItem",
    });
    expect(blocks[2]?.children?.length ?? 0).toBe(0);
  } finally {
    editor.destroy();
  }
});

test("HTML ordered list starts and explicit item values preserve zero", () => {
  const editor = setup();
  try {
    editor.view.pasteHTML(
      '<ol start="0"><li>Zero</li><li>One</li><li value="0">Zero again</li></ol>',
      new Event("paste") as ClipboardEvent,
    );
    expect(fromTiptapDocument(editor.state.doc)).toMatchObject([
      { props: { start: 0 }, type: "numberedListItem" },
      { props: { start: 1 }, type: "numberedListItem" },
      { props: { start: 0 }, type: "numberedListItem" },
    ]);
  } finally {
    editor.destroy();
  }
});
