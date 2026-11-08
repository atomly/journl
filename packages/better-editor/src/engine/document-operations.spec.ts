// @vitest-environment jsdom
import { type DocumentBlock, parseBlock } from "@acme/document";
import { redo, undo } from "@tiptap/pm/history";
import { NodeSelection, TextSelection, Transaction } from "@tiptap/pm/state";
import { expect, test, vi } from "vitest";
import { fromTiptapDocument } from "../serialization/tiptap";
import { applyAcceptedOperations } from "./commands";
import { createDocumentEditor } from "./editor";
import { blockAt } from "./identity";
import { tableExtensions } from "./table-schema";

const p = (id: string, text = id) =>
  parseBlock({ content: text, id, type: "paragraph" });
const update = (id: string, content: string) => ({
  data: { content, type: "paragraph" as const },
  id,
  type: "update" as const,
});
function setup(
  initialBlocks: DocumentBlock[] = [p("a", "Alpha"), p("b", "Beta")],
  extensions: ReturnType<typeof tableExtensions> = [],
) {
  const onCommit = vi.fn();
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions,
    initialBlocks,
    onCommit,
    resolveUrl: async () => ({ items: [] }),
  });
  return {
    blocks: () => fromTiptapDocument(editor.state.doc),
    editor,
    onCommit,
  };
}

test("accepted updates keep unrelated nodes, descendants and the current caret", () => {
  const { editor, onCommit } = setup([
    { ...p("a"), children: [p("child")] },
    p("b", "Unrelated"),
  ]);
  try {
    const sibling = blockAt(editor.state.doc, "b").node;
    const child = blockAt(editor.state.doc, "child").node;
    const caret = blockAt(editor.state.doc, "b").pos + 5;
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, caret),
      ),
    );
    expect(applyAcceptedOperations(editor, [update("a", "Rewritten")])).toBe(
      true,
    );
    expect(blockAt(editor.state.doc, "b").node).toBe(sibling);
    expect(blockAt(editor.state.doc, "child").node).toBe(child);
    expect(editor.state.selection.from).toBe(
      blockAt(editor.state.doc, "b").pos + 5,
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
  } finally {
    editor.destroy();
  }
});

const table = (id: string, columnWidths?: (number | undefined)[]) =>
  parseBlock({
    content: {
      columnWidths,
      headerRows: 1,
      rows: [{ cells: ["Name", "Status"] }, { cells: ["Alpha", "Ready"] }],
      type: "tableContent",
    },
    id,
    type: "table",
  });

test.each([
  { widths: [] },
  { widths: [0, 0] },
  { widths: [100] },
  { widths: [100, 200, 300] },
  { widths: [undefined, undefined] },
  { widths: [100, 200] },
])(
  "Rust edits preserve untouched tables with width metadata $widths",
  ({ widths }) => {
    const { editor, blocks, onCommit } = setup(
      [
        table("table", widths),
        parseBlock({
          content: 'console.log("ready");',
          id: "code",
          props: { language: "javascript" },
          type: "codeBlock",
        }),
      ],
      tableExtensions(),
    );
    try {
      const before = editor.state.doc;
      const untouched = blockAt(before, "table").node;
      expect(
        applyAcceptedOperations(editor, [
          {
            data: {
              content: 'fn main() {\n    println!("ready");\n}',
              props: { language: "rust" },
              type: "codeBlock",
            },
            id: "code",
            type: "update",
          },
        ]),
      ).toBe(true);
      expect(blockAt(editor.state.doc, "table").node).toBe(untouched);
      expect(blocks()[1]).toMatchObject({
        content: 'fn main() {\n    println!("ready");\n}',
        id: "code",
        props: { language: "rust" },
        type: "codeBlock",
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      const after = editor.state.doc;
      expect(undo(editor.state, editor.view.dispatch)).toBe(true);
      expect(editor.state.doc.eq(before)).toBe(true);
      expect(redo(editor.state, editor.view.dispatch)).toBe(true);
      expect(editor.state.doc.eq(after)).toBe(true);
    } finally {
      editor.destroy();
    }
  },
);

test("a table edit preserves an unrelated table with native resized cell widths", () => {
  const { editor, blocks, onCommit } = setup(
    [table("resized", [100, 200]), table("edited", [100, 200])],
    tableExtensions(),
  );
  try {
    const resized = blockAt(editor.state.doc, "resized");
    const tr = editor.state.tr;
    resized.node.descendants((node, offset) => {
      if (node.type.name === "tableCell" && node.attrs.colwidth?.[0] === 100)
        tr.setNodeMarkup(resized.pos + 1 + offset, undefined, {
          ...node.attrs,
          colwidth: [180],
        });
    });
    editor.view.dispatch(tr);
    onCommit.mockClear();
    const before = editor.state.doc;
    const untouched = blockAt(before, "resized").node;
    expect(untouched.firstChild?.attrs.columnWidths).toEqual([100, 200]);
    expect(blocks()[0]).toMatchObject({
      content: { columnWidths: [180, 200] },
    });
    expect(
      applyAcceptedOperations(editor, [
        {
          data: {
            content: {
              rows: [
                { cells: ["Name", "Status"] },
                { cells: ["Alpha", "Done"] },
                { cells: ["Beta", "Planned"] },
              ],
              type: "tableContent",
            },
            type: "table",
          },
          id: "edited",
          type: "update",
        },
      ]),
    ).toBe(true);
    expect(blockAt(editor.state.doc, "resized").node).toBe(untouched);
    expect(blocks()[0]).toMatchObject({
      content: { columnWidths: [180, 200] },
    });
    expect(blocks()[1]).toMatchObject({
      content: {
        rows: [
          { cells: expect.any(Array) },
          { cells: expect.any(Array) },
          { cells: expect.any(Array) },
        ],
      },
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.eq(before)).toBe(true);
  } finally {
    editor.destroy();
  }
});

test("canonical comparison still rejects a transaction with different writing before dispatch", () => {
  const { editor, onCommit } = setup(
    [p("a"), table("table", [])],
    tableExtensions(),
  );
  const replace = Transaction.prototype.replaceWith;
  // Inject a valid but incorrect step to exercise the final content check.
  const corrupted = vi
    .spyOn(Transaction.prototype, "replaceWith")
    .mockImplementationOnce(function (this: Transaction, from, to) {
      return replace.call(
        this,
        from,
        to,
        editor.schema.node(
          "paragraph",
          null,
          editor.schema.text("Unexpected writing"),
        ),
      );
    });
  try {
    const before = editor.state;
    expect(() =>
      applyAcceptedOperations(editor, [update("a", "Requested writing")]),
    ).toThrow("The editor transaction did not match the validated edit");
    expect(editor.state).toBe(before);
    expect(onCommit).not.toHaveBeenCalled();
    expect(undo(editor.state, editor.view.dispatch)).toBe(false);
  } finally {
    corrupted.mockRestore();
    editor.destroy();
  }
});

test("mixed operations commit atomically and retain moved subtree identities", () => {
  const { editor, blocks, onCommit } = setup([
    { ...p("a"), children: [p("child")] },
    p("b"),
    p("c"),
  ]);
  try {
    const child = blockAt(editor.state.doc, "child").node;
    expect(
      applyAcceptedOperations(editor, [
        update("a", "Edited"),
        { afterId: "child", block: p("new"), parentId: "a", type: "insert" },
        { afterId: "new", id: "b", parentId: "a", type: "move" },
        { id: "c", type: "remove" },
      ]),
    ).toBe(true);
    expect(blocks().map((block) => block.id)).toEqual(["a"]);
    expect(blocks()[0]?.children?.map((block) => block.id)).toEqual([
      "child",
      "new",
      "b",
    ]);
    expect(blockAt(editor.state.doc, "child").node).toBe(child);
    expect(onCommit).toHaveBeenCalledTimes(1);
  } finally {
    editor.destroy();
  }
});

test("a late invalid operation leaves content, history and commits untouched", () => {
  const { editor, onCommit } = setup();
  try {
    const before = editor.state;
    expect(() =>
      applyAcceptedOperations(editor, [
        update("a", "Must not appear"),
        { afterId: null, id: "b", parentId: "missing", type: "move" },
      ]),
    ).toThrow();
    expect(editor.state).toBe(before);
    expect(onCommit).not.toHaveBeenCalled();
    expect(undo(editor.state, editor.view.dispatch)).toBe(false);
  } finally {
    editor.destroy();
  }
});

test("an absent optional schema is rejected before any edit is dispatched", () => {
  const { editor, onCommit } = setup();
  try {
    const before = editor.state;
    expect(() =>
      applyAcceptedOperations(editor, [
        update("a", "Must not appear"),
        {
          afterId: "b",
          block: parseBlock({
            content: { rows: [{ cells: ["Cell"] }], type: "tableContent" },
            id: "table",
            type: "table",
          }),
          parentId: null,
          type: "insert",
        },
      ]),
    ).toThrow();
    expect(editor.state).toBe(before);
    expect(onCommit).not.toHaveBeenCalled();
  } finally {
    editor.destroy();
  }
});

test("duplicate nested identities are rejected before dispatch", () => {
  const { editor, onCommit } = setup();
  try {
    const before = editor.state;
    expect(() =>
      applyAcceptedOperations(editor, [
        {
          afterId: "b",
          block: { ...p("new"), children: [p("a")] },
          parentId: null,
          type: "insert",
        },
      ]),
    ).toThrow();
    expect(editor.state).toBe(before);
    expect(onCommit).not.toHaveBeenCalled();
  } finally {
    editor.destroy();
  }
});

test("accepted edits form one undo event isolated from typing on either side", () => {
  const { editor, blocks } = setup();
  try {
    editor.view.dispatch(editor.state.tr.insertText("Before ", 2));
    applyAcceptedOperations(editor, [
      update("a", "Accepted"),
      update("b", "Also accepted"),
    ]);
    editor.view.dispatch(
      editor.state.tr.insertText(
        "After ",
        blockAt(editor.state.doc, "b").pos + 2,
      ),
    );
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.textContent).toBe("AcceptedAlso accepted");
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.textContent).toBe("Before AlphaBeta");
    expect(blocks().map((block) => block.id)).toEqual(["a", "b"]);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.textContent).toBe("AlphaBeta");
    expect(redo(editor.state, editor.view.dispatch)).toBe(true);
    expect(redo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.textContent).toBe("AcceptedAlso accepted");
  } finally {
    editor.destroy();
  }
});

test("moving a block retains its backwards text selection", () => {
  const { editor } = setup([p("a", "abcdef"), p("b")]);
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, 7, 3),
      ),
    );
    applyAcceptedOperations(editor, [
      { afterId: "b", id: "a", parentId: null, type: "move" },
    ]);
    const moved = blockAt(editor.state.doc, "a");
    expect(editor.state.selection.anchor).toBe(moved.pos + 7);
    expect(editor.state.selection.head).toBe(moved.pos + 3);
  } finally {
    editor.destroy();
  }
});

test("moving a selected wrapper retains that wrapper selection", () => {
  const { editor } = setup();
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
    );
    applyAcceptedOperations(editor, [
      { afterId: "b", id: "a", parentId: null, type: "move" },
    ]);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.state.selection.from).toBe(
      blockAt(editor.state.doc, "a").pos,
    );
  } finally {
    editor.destroy();
  }
});

test("shorter updates clamp the selection inside the same block", () => {
  const { editor } = setup([p("a", "A long passage"), p("b")]);
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 15)),
    );
    applyAcceptedOperations(editor, [update("a", "Short")]);
    expect(editor.state.selection.from).toBe(7);
    expect(editor.state.selection.$from.parent.textContent).toBe("Short");
  } finally {
    editor.destroy();
  }
});

test("removing all blocks retains an editable caret and undo restores original identities", () => {
  const { editor, blocks, onCommit } = setup();
  try {
    expect(
      applyAcceptedOperations(editor, [
        { id: "a", type: "remove" },
        { id: "b", type: "remove" },
      ]),
    ).toBe(true);
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0]?.type).toBe("paragraph");
    expect(editor.state.selection.$from.parent.isTextblock).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(blocks().map((block) => block.id)).toEqual(["a", "b"]);
  } finally {
    editor.destroy();
  }
});

test("replacing the caret block with code and a trailing divider retains a caret", () => {
  const { editor } = setup([p("a", "Starter")]);
  try {
    const before = editor.state.doc;
    expect(
      applyAcceptedOperations(editor, [
        { id: "a", type: "remove" },
        {
          afterId: null,
          block: parseBlock({
            content: 'console.log("ready");',
            id: "code",
            props: { language: "javascript" },
            type: "codeBlock",
          }),
          parentId: null,
          type: "insert",
        },
        {
          afterId: "code",
          block: parseBlock({ id: "divider", type: "divider" }),
          parentId: null,
          type: "insert",
        },
      ]),
    ).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe("codeBlock");
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.eq(before)).toBe(true);
  } finally {
    editor.destroy();
  }
});

test("retained actions respect current read-only and destroyed editor state", () => {
  const { editor, onCommit } = setup();
  const before = editor.state.doc;
  editor.setEditable(false);
  onCommit.mockClear();
  expect(applyAcceptedOperations(editor, [update("a", "Forbidden")])).toBe(
    false,
  );
  expect(editor.state.doc).toBe(before);
  expect(onCommit).not.toHaveBeenCalled();
  editor.destroy();
  expect(applyAcceptedOperations(editor, [update("a", "Forbidden")])).toBe(
    false,
  );
});

test("empty and semantically unchanged batches do not create an undo event", () => {
  const { editor, onCommit } = setup();
  try {
    expect(applyAcceptedOperations(editor, [])).toBe(false);
    expect(applyAcceptedOperations(editor, [update("a", "Alpha")])).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    expect(undo(editor.state, editor.view.dispatch)).toBe(false);
  } finally {
    editor.destroy();
  }
});
