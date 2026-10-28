// @vitest-environment jsdom
import { type DocumentBlock, parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { clipboardText } from "../serialization/clipboard";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { editingExtension, selectedBlock } from "./commands";
import { blockAt, identityExtension } from "./identity";
import { documentExtensions } from "./schema";
import { slashKey, suggestionExtension } from "./suggestions";
import {
  changeBlockType,
  moveSelectedBlock,
  removeSelectedBlock,
  setBlockProperties,
  setTextColor,
} from "./writing";
import { writingExtension } from "./writing-extension";

function setup(
  blocks: DocumentBlock[] = [parseBlock({ id: "a", type: "paragraph" })],
) {
  let id = 0;
  const createId = () => `fresh-${++id}`;
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    content: toTiptapDocument(blocks).toJSON(),
    // Transaction tests have no browser layout. Real-route tests exercise scrolling.
    editorProps: { handleScrollToSelection: () => true },
    element,
    extensions: [
      ...documentExtensions(),
      editingExtension(createId),
      identityExtension(createId),
      writingExtension(createId),
      suggestionExtension(createId),
    ],
  });
  editor.on("destroy", () => element.remove());
  editor.view.focus();
  const key = (key: string, options: KeyboardEventInit = {}) =>
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
        ...options,
      }),
    );
  const text = (text: string) => {
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp("handleTextInput", (handler) =>
        handler(editor.view, from, to, char, () =>
          editor.state.tr.insertText(char),
        ),
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char));
    }
  };
  const blocksNow = () => fromTiptapDocument(editor.state.doc);
  return { blocks: blocksNow, createId, editor, key, text };
}

test("slash filtering and keyboard selection keep the block identity", () => {
  const { editor, text, key, blocks } = setup();
  try {
    text("/heading 4");
    expect(slashKey.getState(editor.state)?.query).toBe("heading 4");
    key("Enter");
    expect(blocks()).toMatchObject([
      {
        id: "a",
        props: { level: 4 },
        type: "heading",
      },
    ]);
    expect(editor.state.doc.textContent).toBe("");
    key("Enter");
    expect(blocks().map((block) => [block.id, block.type])).toEqual([
      ["a", "heading"],
      ["fresh-1", "paragraph"],
    ]);
    text("/quote");
    key("Escape");
    key("Enter");
    expect(editor.state.doc.textContent).toContain("/quote");
  } finally {
    editor.destroy();
  }
});

test("input rules and list exit preserve nested writing and checked state", () => {
  const { editor, text, key, blocks } = setup();
  try {
    text("[x] ");
    expect(blocks()[0]).toMatchObject({
      id: "a",
      props: { checked: true },
      type: "checkListItem",
    });
    text("Completed");
    key("Enter");
    expect(blocks()[1]).toMatchObject({
      id: "fresh-1",
      props: { checked: false },
      type: "checkListItem",
    });
    key("Enter");
    expect(blocks()[1]).toMatchObject({ id: "fresh-1", type: "paragraph" });
    text("### ");
    expect(blocks()[1]).toMatchObject({ props: { level: 3 }, type: "heading" });
    text("Heading");
    key("Enter");
    text("**bold**");
    expect(JSON.stringify(blocks()[2])).toContain('"bold":true');
  } finally {
    editor.destroy();
  }
});

test("code tabs and table keys never split or nest their containing block", () => {
  const { editor, key, text, blocks } = setup([
    parseBlock({ content: "", id: "code", type: "codeBlock" }),
    parseBlock({
      content: { rows: [{ cells: ["First", "Second"] }], type: "tableContent" },
      id: "table",
      type: "table",
    }),
  ]);
  try {
    key("Tab");
    text("const a = 1;");
    key("Enter");
    text("// [[literal]]");
    expect(blocks()[0]).toMatchObject({
      content: "\tconst a = 1;\n// [[literal]]",
      id: "code",
    });
    const table = blockAt(editor.state.doc, "table");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, table.pos + 5),
      ),
    );
    key("Enter");
    key("Tab");
    text("edited ");
    expect(blocks()).toHaveLength(2);
    expect(blocks()[1]).toMatchObject({
      content: {
        rows: [
          {
            cells: [
              [{ styles: {}, text: "First", type: "text" }],
              [{ styles: {}, text: "edited ", type: "text" }],
            ],
          },
        ],
      },
      id: "table",
    });
  } finally {
    editor.destroy();
  }
});

test("block changes, colors, and moves preserve descendants and reference targets", () => {
  const reference = {
    blockId: "target",
    documentId: "doc",
    label: "Reference",
    resolutionToken: "",
    targetKind: "document",
    url: "/pages/doc",
    version: 1,
  };
  const { editor, blocks } = setup([
    parseBlock({
      children: [{ content: "Keep child", id: "child", type: "paragraph" }],
      content: [
        { styles: { bold: true }, text: "Writing", type: "text" },
        { props: reference, type: "contentReference" },
      ],
      id: "a",
      props: { backgroundColor: "yellow" },
      type: "paragraph",
    }),
    parseBlock({ content: "Second", id: "b", type: "paragraph" }),
  ]);
  try {
    const tr = changeBlockType(editor.state, "heading", { level: 6 });
    expect(tr).not.toBeNull();
    if (tr) editor.view.dispatch(tr);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, 2, 10),
      ),
    );
    const color = setTextColor(editor.state, "textColor", "purple");
    if (color) editor.view.dispatch(color);
    const align = setBlockProperties(editor.state, {
      textAlignment: "justify",
    });
    if (align) editor.view.dispatch(align);
    expect(changeBlockType(editor.state, "codeBlock")).toBeNull();
    const move = moveSelectedBlock(editor.state, 1);
    if (move) editor.view.dispatch(move);
    expect(blocks().map((block) => block.id)).toEqual(["b", "a"]);
    expect(blocks()[1]).toMatchObject({
      children: [{ id: "child" }],
      content: [
        { styles: { bold: true, textColor: "purple" } },
        { props: reference, type: "contentReference" },
      ],
      id: "a",
      props: { backgroundColor: "yellow", level: 6, textAlignment: "justify" },
      type: "heading",
    });
    const child = blockAt(editor.state.doc, "child");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        NodeSelection.create(editor.state.doc, child.pos),
      ),
    );
    expect(selectedBlock(editor.state)).toMatchObject({
      id: "child",
      parentId: "a",
    });
    const remove = removeSelectedBlock(editor.state, () => "new");
    if (remove) editor.view.dispatch(remove);
    expect(blocks()).toHaveLength(2);
    expect(blocks()[1]?.children).toBeUndefined();
  } finally {
    editor.destroy();
  }
});

test("checkboxes commit once; collapsed state does not enter the document or clipboard", () => {
  const { editor, blocks } = setup([
    parseBlock({ content: "Task", id: "check", type: "checkListItem" }),
    parseBlock({
      children: [{ content: "Hidden writing", id: "child", type: "paragraph" }],
      content: "Details",
      id: "toggle",
      type: "toggleListItem",
    }),
  ]);
  try {
    const check = editor.view.dom.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    check?.click();
    expect(blocks()[0]).toMatchObject({
      id: "check",
      props: { checked: true },
    });
    const before = blocks();
    const toggle = editor.view.dom.querySelector<HTMLButtonElement>(
      '[data-block-id="toggle"] button[aria-label="Collapse content"]',
    );
    toggle?.click();
    expect(
      editor.view.dom
        .querySelector('[data-block-id="toggle"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("true");
    expect(blocks()).toEqual(before);
    expect(editor.getHTML()).not.toContain("data-open-editor-block-controls");
    expect(editor.getHTML()).toContain("Hidden writing");
  } finally {
    editor.destroy();
  }
});

test("joining different text block types keeps the first ID and both child trees", () => {
  const { editor, key, blocks } = setup([
    parseBlock({
      children: [
        { content: "First child", id: "first-child", type: "paragraph" },
      ],
      content: "Title",
      id: "heading",
      type: "heading",
    }),
    parseBlock({
      children: [
        { content: "Second child", id: "second-child", type: "paragraph" },
      ],
      content: "Writing",
      id: "paragraph",
      type: "paragraph",
    }),
  ]);
  try {
    const target = blockAt(editor.state.doc, "paragraph");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, target.pos + 2),
      ),
    );
    key("Backspace");
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0]).toMatchObject({
      children: [{ id: "first-child" }, { id: "second-child" }],
      content: [{ text: "TitleWriting" }],
      id: "heading",
      type: "heading",
    });
    key("z", { ctrlKey: true });
    expect(blocks().map((block) => block.id)).toEqual(["heading", "paragraph"]);
  } finally {
    editor.destroy();
  }
});

test("composition leaves Enter and Tab to the native input method", () => {
  const { editor, key, blocks } = setup();
  try {
    Object.defineProperty(editor.view, "composing", {
      configurable: true,
      value: true,
    });
    const before = blocks();
    key("Enter", { isComposing: true });
    key("Tab", { isComposing: true });
    expect(blocks()).toEqual(before);
  } finally {
    editor.destroy();
  }
});

test("deleting the last block leaves a fresh writing position and undo restores the original tree", () => {
  const original = parseBlock({
    children: [
      { content: "Keep my child", id: "descendant", type: "paragraph" },
    ],
    content: "Keep me",
    id: "sole",
    type: "paragraph",
  });
  const { editor, createId, key, blocks } = setup([original]);
  try {
    const tr = removeSelectedBlock(editor.state, createId);
    expect(tr).not.toBeNull();
    if (tr) editor.view.dispatch(tr);
    expect(blocks()).toMatchObject([{ id: "fresh-1", type: "paragraph" }]);
    key("z", { ctrlKey: true });
    expect(blocks()).toMatchObject([
      {
        children: [{ id: "descendant" }],
        content: [{ text: "Keep me" }],
        id: "sole",
      },
    ]);
  } finally {
    editor.destroy();
  }
});

test("Backspace reverses an input rule without changing the block identity or properties", () => {
  const { editor, text, key, blocks } = setup([
    parseBlock({
      id: "a",
      props: { backgroundColor: "yellow" },
      type: "paragraph",
    }),
  ]);
  try {
    text("## ");
    expect(blocks()[0]?.type).toBe("heading");
    key("Backspace");
    expect(blocks()[0]).toMatchObject({
      content: [{ text: "## " }],
      id: "a",
      props: { backgroundColor: "yellow" },
      type: "paragraph",
    });
  } finally {
    editor.destroy();
  }
});

test("turning a selected list range into numbered items preserves every identity and child", () => {
  const fixture = setup([
    parseBlock({
      children: [{ content: "Nested", id: "child", type: "paragraph" }],
      content: "One",
      id: "a",
      type: "bulletListItem",
    }),
    parseBlock({ content: "Two", id: "b", type: "bulletListItem" }),
  ]);
  const { editor, blocks } = fixture;
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(
        editor.state.doc,
        2,
        blockAt(editor.state.doc, "b").pos + 4,
      ),
    ),
  );
  const tr = changeBlockType(editor.state, "numberedListItem");
  expect(tr).not.toBeNull();
  if (tr) editor.view.dispatch(tr);
  expect(blocks().map(({ id, type }) => ({ id, type }))).toEqual([
    { id: "a", type: "numberedListItem" },
    { id: "b", type: "numberedListItem" },
  ]);
  expect(blocks()[0]?.children?.[0]?.id).toBe("child");
  expect(
    blocks().map((block) =>
      block.type === "numberedListItem" ? block.props?.start : undefined,
    ),
  ).toEqual([1, 2]);
  expect(editor.state.selection.empty).toBe(false);
  expect(clipboardText(editor.state.selection.content().content)).toMatch(
    /1\. One[\s\S]*2\. Tw/,
  );
  editor.destroy();
});

test("empty non-paragraph blocks accept new Markdown shortcuts without losing identity", () => {
  for (const type of [
    "heading",
    "bulletListItem",
    "numberedListItem",
    "quote",
  ] as const) {
    const { editor, text, blocks } = setup([
      parseBlock({ content: [], id: "a", type }),
    ]);
    text("## ");
    expect(blocks()[0]).toMatchObject({
      id: "a",
      props: { level: 2 },
      type: "heading",
    });
    text("- ");
    expect(blocks()[0]).toMatchObject({ id: "a", type: "bulletListItem" });
    editor.destroy();
  }
});

test("divider shortcut leaves a writable paragraph and table cells keep literal Markdown", () => {
  const first = setup();
  first.text("---");
  first.text("After divider");
  expect(first.blocks().map((block) => block.type)).toEqual([
    "divider",
    "paragraph",
  ]);
  expect(first.blocks()[1]?.content).toMatchObject([{ text: "After divider" }]);
  first.editor.destroy();
  const table = setup([
    parseBlock({
      content: { rows: [{ cells: [""] }], type: "tableContent" },
      id: "table",
      type: "table",
    }),
  ]);
  const pos = table.editor.state.doc.resolve(5);
  table.editor.view.dispatch(
    table.editor.state.tr.setSelection(TextSelection.near(pos)),
  );
  table.text("- ");
  expect(table.editor.state.doc.textContent).toBe("- ");
  table.editor.destroy();
});

test("turning an empty block into a table puts typing in its first cell", () => {
  const { editor, text, blocks } = setup();
  const tr = changeBlockType(editor.state, "table");
  if (!tr) throw new Error("Expected a table conversion");
  editor.view.dispatch(tr);
  expect(editor.state.selection.$from.parent.type.name).toBe("tableParagraph");
  text("First cell");
  expect(blocks()[0]?.type).toBe("table");
  expect(editor.state.doc.textContent).toBe("First cell");
  editor.destroy();
});

test("the add-block picker opens on empty content without inserting a slash and cancels cleanly", () => {
  const { editor, key, text, blocks } = setup();
  editor.view.dispatch(editor.state.tr.setMeta(slashKey, { open: true }));
  expect(slashKey.getState(editor.state)?.query).toBe("");
  expect(editor.state.doc.textContent).toBe("");
  key("Escape");
  expect(slashKey.getState(editor.state)).toBeNull();
  expect(editor.state.doc.textContent).toBe("");
  editor.view.dispatch(editor.state.tr.setMeta(slashKey, { open: true }));
  text("bullet");
  key("Enter");
  expect(blocks()[0]).toMatchObject({ id: "a", type: "bulletListItem" });
  expect(editor.state.doc.textContent).toBe("");
  expect(slashKey.getState(editor.state)).toBeNull();
  editor.destroy();
});
