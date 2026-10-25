// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import {
  applyAcceptedOperations,
  blockAt,
  blockDragSelection,
  captureLink,
  convertReference,
  documentExtensions,
  duplicateSelectedBlock,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  indentBlock,
  selectedBlocks,
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

test("indent and outdent keep the caret and backward text selection in the moved block", () => {
  const { editor } = setup([p("parent"), p("writing", "abcdef")]);
  try {
    const target = blockAt(editor.state.doc, "writing");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, target.pos + 7, target.pos + 4),
      ),
    );
    const indent = indentBlock(editor.state);
    if (!indent) throw new Error("Missing indent");
    editor.view.dispatch(indent);
    expect(editor.state.selection.$anchor.parentOffset).toBe(5);
    expect(editor.state.selection.$head.parentOffset).toBe(2);
    const outdent = indentBlock(editor.state, true);
    if (!outdent) throw new Error("Missing outdent");
    editor.view.dispatch(outdent);
    expect(editor.state.selection.$anchor.parentOffset).toBe(5);
    expect(editor.state.selection.$head.parentOffset).toBe(2);
    const current = blockAt(editor.state.doc, "writing");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, current.pos + 8),
      ),
    );
    const again = indentBlock(editor.state);
    if (!again) throw new Error("Missing indent");
    editor.view.dispatch(again);
    editor.view.dispatch(editor.state.tr.insertText("!"));
    expect(
      fromTiptapDocument(editor.state.doc)[0]?.children?.[0]?.content,
    ).toEqual([{ styles: {}, text: "abcdef!", type: "text" }]);
  } finally {
    editor.destroy();
  }
});

test("Tab and Shift+Tab move a backward multi-block range as one undoable edit", () => {
  const { editor, blocks } = setup([
    p("parent"),
    p("a", "Alpha"),
    p("b", "Beta"),
    p("last"),
  ]);
  try {
    const anchor = blockAt(editor.state.doc, "b").pos + 5;
    const head = blockAt(editor.state.doc, "a").pos + 3;
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, anchor, head),
      ),
    );
    const key = (shiftKey = false) =>
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Tab",
          shiftKey,
        }),
      );
    key();
    expect(blocks().map((block) => block.id)).toEqual(["parent", "last"]);
    expect(blocks()[0]?.children?.map((block) => block.id)).toEqual(["a", "b"]);
    expect(editor.state.selection.anchor).toBe(
      blockAt(editor.state.doc, "b").pos + 5,
    );
    expect(editor.state.selection.head).toBe(
      blockAt(editor.state.doc, "a").pos + 3,
    );
    key(true);
    expect(blocks().map((block) => block.id)).toEqual([
      "parent",
      "a",
      "b",
      "last",
    ]);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "z",
      }),
    );
    expect(blocks()[0]?.children?.map((block) => block.id)).toEqual(["a", "b"]);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "z",
      }),
    );
    expect(blocks().map((block) => block.id)).toEqual([
      "parent",
      "a",
      "b",
      "last",
    ]);
  } finally {
    editor.destroy();
  }
});

test("a selection ending at the next block boundary excludes that block", () => {
  const { editor, blocks } = setup([p("parent"), p("a"), p("b"), p("last")]);
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(
          editor.state.doc,
          blockAt(editor.state.doc, "a").pos + 2,
          blockAt(editor.state.doc, "last").pos,
        ),
      ),
    );
    const tr = indentBlock(editor.state);
    expect(tr).not.toBeNull();
    if (tr) editor.view.dispatch(tr);
    expect(blocks()[0]?.children?.map((block) => block.id)).toEqual(["a", "b"]);
    expect(blocks()[1]?.id).toBe("last");
  } finally {
    editor.destroy();
  }
});

test("collapsed links can be converted using their complete authored text", () => {
  const { editor } = setup([
    parseBlock({
      content: [
        {
          content: [{ styles: { bold: true }, text: "Example", type: "text" }],
          href: "https://example.com",
          type: "link",
        },
      ],
      id: "link",
      type: "paragraph",
    }),
  ]);
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 5)),
    );
    expect(captureLink(editor.state)).toMatchObject({
      from: 2,
      href: "https://example.com",
      label: "Example",
      to: 9,
    });
  } finally {
    editor.destroy();
  }
});

test("selected reference wrappers share conversions and external links cannot become document embeds", () => {
  const { editor, blocks } = setup([
    parseBlock({
      id: "reference",
      props: {
        blockId: "",
        documentId: "",
        label: "Example",
        resolutionToken: "",
        targetKind: "external",
        url: "https://example.com",
        version: 1,
      },
      type: "referenceCard",
    }),
  ]);
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
    );
    expect(
      convertReference(editor.state, "contentEmbed", () => "new"),
    ).toBeNull();
    const tr = convertReference(editor.state, "link", () => "new");
    expect(tr).not.toBeNull();
    if (tr) editor.view.dispatch(tr);
    expect(blocks()[0]).toMatchObject({
      content: [{ href: "https://example.com", type: "link" }],
      id: "reference",
      type: "paragraph",
    });
  } finally {
    editor.destroy();
  }
});

test("block selection, duplication, and checklist shortcuts use normal editor transactions", () => {
  const { editor, blocks } = setup([
    parseBlock({
      content: "Task",
      id: "task",
      props: { checked: false },
      type: "checkListItem",
    }),
  ]);
  const key = (key: string, ctrlKey = false) =>
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey,
        key,
      }),
    );
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 3)),
    );
    key("Enter", true);
    expect(blocks()[0]).toMatchObject({ id: "task", props: { checked: true } });
    key("Escape");
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    key("Enter");
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(blocks()).toHaveLength(1);
    key("d", true);
    expect(blocks().map((block) => block.id)).toEqual(["task", "fresh-1"]);
  } finally {
    editor.destroy();
  }
});

test("a reference in a table cannot be promoted out of its cell", () => {
  const { editor } = setup([
    parseBlock({
      content: {
        rows: [
          {
            cells: [
              [
                {
                  props: {
                    blockId: "",
                    documentId: "source",
                    label: "Source",
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
      id: "table",
      type: "table",
    }),
  ]);
  try {
    let pos = -1;
    editor.state.doc.descendants((node, offset) => {
      if (node.type.name === "contentReference") pos = offset;
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)),
    );
    expect(
      convertReference(editor.state, "referenceCard", () => "new"),
    ).toBeNull();
    expect(
      convertReference(editor.state, "contentEmbed", () => "new"),
    ).toBeNull();
    expect(convertReference(editor.state, "link", () => "new")).not.toBeNull();
  } finally {
    editor.destroy();
  }
});

test("handle drags expand a selected group to complete wrappers and preserve nested IDs", () => {
  const { editor, blocks } = setup([
    { ...p("a"), children: [p("child")] },
    p("b"),
    p("c"),
  ]);
  try {
    const a = blockAt(editor.state.doc, "a");
    const b = blockAt(editor.state.doc, "b");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, a.pos + 2, b.pos + 3),
      ),
    );
    editor.view.dispatch(
      editor.state.tr.setSelection(blockDragSelection(editor.state, "b")),
    );
    expect(selectedBlocks(editor.state).map((block) => block.id)).toEqual([
      "a",
      "b",
    ]);
    const slice = editor.state.selection.content();
    expect(slice.openStart).toBe(0);
    expect(slice.openEnd).toBe(0);
    const tr = editor.state.tr.deleteSelection();
    tr.insert(tr.doc.content.size, slice.content);
    editor.view.dispatch(tr);
    expect(blocks().map((block) => block.id)).toEqual(["c", "a", "b"]);
    expect(blocks()[1]?.children?.[0]?.id).toBe("child");
  } finally {
    editor.destroy();
  }
});
test("a handle outside the selected range selects only its own block", () => {
  const { editor } = setup([p("a"), p("b"), p("c")]);
  try {
    const b = blockAt(editor.state.doc, "b");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, 2, b.pos + 3),
      ),
    );
    const selection = blockDragSelection(editor.state, "c");
    expect(selection).toBeInstanceOf(NodeSelection);
    expect(selection.from).toBe(blockAt(editor.state.doc, "c").pos);
  } finally {
    editor.destroy();
  }
});

test("clearing the full document leaves a writable paragraph and undo restores original IDs", () => {
  const { editor, blocks } = setup([p("a"), p("b")]);
  try {
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0]?.type).toBe("paragraph");
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    editor.commands.keyboardShortcut("Mod-z");
    expect(blocks().map((block) => block.id)).toEqual(["a", "b"]);
  } finally {
    editor.destroy();
  }
});
