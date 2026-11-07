// @vitest-environment jsdom
import { type DocumentBlock, parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { clipboardText } from "../serialization/clipboard";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { testDocumentExtensions } from "../testing/extensions";
import { blockAt } from "./identity";
import { listNumberingKey } from "./list-numbering";
import { changeBlockType } from "./writing";
import { writingExtension } from "./writing-extension";

const item = (id: string, start?: number): DocumentBlock =>
  parseBlock({
    content: id,
    id,
    type: "numberedListItem",
    ...(start === undefined ? {} : { props: { start } }),
  });

test("implicit ordinals continue siblings, reset at breaks, and preserve explicit starts and nested runs", () => {
  const blocks = [
    item("a"),
    { ...item("b"), children: [item("nested-0", 0), item("nested-1")] },
    item("c"),
    item("explicit", 9),
    item("following"),
    parseBlock({ content: "Break", id: "break", type: "paragraph" }),
    item("reset"),
  ];
  const editor = new Editor({
    content: toTiptapDocument(blocks).toJSON(),
    element: document.createElement("div"),
    extensions: testDocumentExtensions(),
  });
  try {
    const numbers = () =>
      [
        ...editor.view.dom.querySelectorAll(
          '[data-better-editor-body="numberedListItem"]',
        ),
      ].map((el) => el.getAttribute("data-start"));
    expect(numbers()).toEqual(["1", "2", "0", "1", "3", "9", "10", "1"]);
    expect(fromTiptapDocument(editor.state.doc)).toEqual(
      fromTiptapDocument(toTiptapDocument(blocks)),
    );
    const decorations = listNumberingKey.getState(editor.state);
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
    );
    expect(listNumberingKey.getState(editor.state)).toBe(decorations);
    const target = blockAt(editor.state.doc, "b");
    editor.view.dispatch(
      editor.state.tr.delete(target.pos, target.pos + target.node.nodeSize),
    );
    expect(numbers()).toEqual(["1", "2", "9", "10", "1"]);
    expect(clipboardText(editor.state.doc.content)).toContain(
      "1. a\n\n2. c\n\n9. explicit\n\n10. following",
    );
    expect(clipboardText(editor.state.doc.content)).toContain(
      "Break\n\n1. reset",
    );
  } finally {
    editor.destroy();
  }
});

test("Enter and type conversion continue an implicit numbered run", () => {
  const editor = new Editor({
    content: toTiptapDocument([
      item("a"),
      item("b"),
      parseBlock({ content: "Tail", id: "tail", type: "paragraph" }),
    ]).toJSON(),
    editorProps: { handleScrollToSelection: () => true },
    element: document.createElement("div"),
    extensions: [
      ...testDocumentExtensions(),
      writingExtension(() => "new-item"),
    ],
  });
  try {
    const second = blockAt(editor.state.doc, "b");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(
          editor.state.doc,
          second.pos + 2 + (second.node.firstChild?.content.size ?? 0),
        ),
      ),
    );
    editor.commands.keyboardShortcut("Enter");
    expect(
      fromTiptapDocument(editor.state.doc).map((block) => block.id),
    ).toEqual(["a", "b", "new-item", "tail"]);
    const tail = blockAt(editor.state.doc, "tail");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, tail.pos + 2),
      ),
    );
    const conversion = changeBlockType(editor.state, "numberedListItem");
    if (!conversion) throw new Error("Expected list conversion");
    editor.view.dispatch(conversion);
    expect(
      [
        ...editor.view.dom.querySelectorAll(
          '[data-better-editor-body="numberedListItem"]',
        ),
      ].map((el) => el.getAttribute("data-start")),
    ).toEqual(["1", "2", "3", "4"]);
  } finally {
    editor.destroy();
  }
});
