// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import {
  applyAcceptedOperations,
  blockAt,
  captureLink,
  convertReference,
  documentExtensions,
  duplicateSelectedBlock,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  indentBlock,
  toggleTextMark,
  toTiptapDocument,
} from "./index";

const p = (id: string, text = id) =>
  parseBlock({ content: text, id, type: "paragraph" });
function setup(blocks = [p("a", "abcdef"), p("b")]) {
  let n = 0;
  const createId = () => `fresh-${++n}`;
  const editor = new Editor({
    content: toTiptapDocument(blocks).toJSON(),
    element: document.createElement("div"),
    extensions: [
      ...documentExtensions(),
      editingExtension(createId),
      identityExtension(createId),
    ],
  });
  return {
    blocks: () => fromTiptapDocument(editor.state.doc),
    createId,
    editor,
  };
}

test("real keyboard split, join and undo preserve block identity", () => {
  const { editor, blocks } = setup();
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 5)),
    );
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
    expect(blocks().map((block) => block.id)).toEqual(["a", "fresh-1", "b"]);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Backspace",
      }),
    );
    expect(blocks().map((block) => block.id)).toEqual(["a", "b"]);
    expect(editor.state.doc.textContent).toBe("abcdefb");
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "z",
      }),
    );
  } finally {
    editor.destroy();
  }
});

test("indent/outdent and duplicate retain moved IDs and refresh all copied descendant IDs", () => {
  const { editor, blocks, createId } = setup([
    parseBlock({ ...p("a"), children: [p("child")] }),
    p("b"),
  ]);
  try {
    const target = blockAt(editor.state.doc, "b");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, target.pos + 2),
      ),
    );
    const indent = indentBlock(editor.state);
    if (!indent) throw new Error("Missing indent");
    editor.view.dispatch(indent);
    expect(blocks()[0]?.children?.map((block) => block.id)).toEqual([
      "child",
      "b",
    ]);
    const outdent = indentBlock(editor.state, true);
    if (!outdent) throw new Error("Missing outdent");
    editor.view.dispatch(outdent);
    expect(blocks().map((block) => block.id)).toEqual(["a", "b"]);
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
    );
    const duplicate = duplicateSelectedBlock(editor.state, createId);
    if (!duplicate) throw new Error("Missing duplicate");
    editor.view.dispatch(duplicate);
    expect(blocks()).toHaveLength(3);
    expect(blocks()[1]?.id).not.toBe("a");
    expect(blocks()[1]?.children?.[0]?.id).not.toBe("child");
  } finally {
    editor.destroy();
  }
});

test("native external HTML paste creates owned blocks and retains links and marks", () => {
  const { editor, blocks } = setup();
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
    );
    editor.view.pasteHTML(
      '<p>First <strong>bold</strong></p><p><a href="https://example.invalid">Alias</a></p>',
      new Event("paste") as ClipboardEvent,
    );
    expect(blocks().length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(blocks())).toContain('"bold":true');
    expect(JSON.stringify(blocks())).toContain("https://example.invalid");
  } finally {
    editor.destroy();
  }
});

test("inline reference conversions preserve surrounding writing, children, and target meaning", () => {
  const props = {
    blockId: "target-block",
    documentId: "target-doc",
    label: "Alias",
    resolutionToken: "",
    targetKind: "document",
    url: "/pages/target#block=target-block",
    version: 1,
  } as const;
  const { editor, createId, blocks } = setup([
    parseBlock({
      children: [p("child")],
      content: ["Before ", { props, type: "contentReference" }, " after"],
      id: "source",
      type: "paragraph",
    }),
  ]);
  try {
    let pos = 0;
    editor.state.doc.descendants((node, at) => {
      if (node.type.name === "contentReference") pos = at;
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)),
    );
    const card = convertReference(editor.state, "referenceCard", createId);
    if (!card) throw new Error("Missing conversion");
    editor.view.dispatch(card);
    expect(editor.state.doc.textContent).toContain("Before ");
    expect(editor.state.doc.textContent).toContain(" after");
    expect(blocks().find((block) => block.id === "source")).toMatchObject({
      children: [{ id: "child" }],
      props,
      type: "referenceCard",
    });
    const link = convertReference(editor.state, "link", createId);
    if (!link) throw new Error("Missing link conversion");
    editor.view.dispatch(link);
    const source = blockAt(editor.state.doc, "source");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(
          editor.state.doc,
          source.pos + 2,
          source.pos + 2 + props.label.length,
        ),
      ),
    );
    expect(captureLink(editor.state)).toMatchObject({
      href: props.url,
      label: "Alias",
    });
  } finally {
    editor.destroy();
  }
});

test("formatting across a reference styles only text and preserves the complete target", () => {
  const props = {
    blockId: "target",
    documentId: "doc",
    label: "Target",
    resolutionToken: "",
    targetKind: "document",
    url: "/pages/doc",
    version: 1,
  } as const;
  const { editor, blocks } = setup([
    parseBlock({
      content: ["Before ", { props, type: "contentReference" }, " after"],
      id: "a",
      type: "paragraph",
    }),
  ]);
  try {
    const end =
      (editor.state.doc.firstChild?.firstChild?.content.size ?? 0) + 2;
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, 2, end),
      ),
    );
    const transaction = toggleTextMark(editor.state, "bold");
    if (!transaction) throw new Error("Missing formatting transaction");
    editor.view.dispatch(transaction);
    expect(JSON.stringify(blocks())).toContain('"bold":true');
    const content = blocks()[0]?.content;
    expect(
      Array.isArray(content) &&
        content.find(
          (item) =>
            typeof item === "object" && item.type === "contentReference",
        ),
    ).toEqual({ props, type: "contentReference" });
  } finally {
    editor.destroy();
  }
});

test("accepted domain proposals form one undo event", () => {
  const { editor, blocks } = setup();
  try {
    applyAcceptedOperations(editor, [
      {
        data: { content: "Accepted writing", type: "paragraph" },
        id: "a",
        type: "update",
      },
    ]);
    expect(JSON.stringify(blocks()[0])).toContain("Accepted writing");
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "z",
      }),
    );
    expect(blocks()[0]?.id).toBe("a");
    expect(JSON.stringify(blocks()[0])).toContain("abcdef");
  } finally {
    editor.destroy();
  }
});
