// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { undo } from "@tiptap/pm/history";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test, vi } from "vitest";
import { fromTiptapDocument } from "../serialization/tiptap";
import { applyAcceptedOperations } from "./commands";
import { createDocumentEditor } from "./editor";

const divider = parseBlock({ id: "divider", type: "divider" });
const image = parseBlock({
  id: "image",
  props: { url: "https://example.com/image.png" },
  type: "image",
});
const atoms = [divider, image];
function fixture(initialBlocks = atoms) {
  const onCommit = vi.fn();
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
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

test("loading atom-only writing initializes an empty native selection without a content change", () => {
  const { editor, onCommit, blocks } = fixture();
  try {
    expect(editor.state.selection).toBeInstanceOf(GapCursor);
    expect(editor.state.selection.empty).toBe(true);
    expect(blocks()).toEqual(atoms);
    expect(onCommit).not.toHaveBeenCalled();
  } finally {
    editor.destroy();
  }
});

test("replacing the caret with only atoms retains an empty selection and exact Undo", () => {
  const { editor } = fixture([
    parseBlock({ content: "", id: "starter", type: "paragraph" }),
  ]);
  try {
    const before = editor.state;
    expect(
      applyAcceptedOperations(editor, [
        { id: "starter", type: "remove" },
        { afterId: null, block: divider, parentId: null, type: "insert" },
        {
          afterId: "divider",
          block: image,
          parentId: null,
          type: "insert",
        },
      ]),
    ).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(GapCursor);
    expect(editor.state.selection.empty).toBe(true);
    expect(undo(editor.state, editor.view.dispatch)).toBe(true);
    expect(editor.state.doc.eq(before.doc)).toBe(true);
    expect(editor.state.selection.eq(before.selection)).toBe(true);
  } finally {
    editor.destroy();
  }
});

test.each(["Enter", "typing", "paste", "composition"])(
  "%s from the root gap creates normal identified writing only on input",
  (input) => {
    const { editor, onCommit, blocks } = fixture();
    try {
      const before = editor.state.doc;
      if (input === "Enter")
        editor.view.dom.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
          }),
        );
      else if (input === "paste")
        expect(
          editor.view.pasteText(
            "Pasted\n\n- First\n- Second",
            new Event("paste") as ClipboardEvent,
          ),
        ).toBe(true);
      else {
        if (input === "composition") {
          editor.view.dom.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              data: "あ",
              inputType: "insertCompositionText",
            }),
          );
          expect(editor.state.selection.$from.parent.isTextblock).toBe(true);
        }
        editor.view.dispatch(
          editor.state.tr.insertText(input === "composition" ? "あ" : "Typed"),
        );
      }
      expect(editor.state.selection).toBeInstanceOf(TextSelection);
      expect(editor.state.doc.child(0)).toBe(before.child(0));
      expect(editor.state.doc.child(1)).toBe(before.child(1));
      const after = blocks();
      expect(after.length).toBeGreaterThan(2);
      expect(new Set(after.map((b) => b.id)).size).toBe(after.length);
      expect(after.every((b) => b.id)).toBe(true);
      if (input === "composition")
        expect(editor.state.doc.textContent).toBe("あ");
      expect(onCommit).toHaveBeenCalled();
    } finally {
      editor.destroy();
    }
  },
);

test("read-only Enter cannot insert writing and explicit node selections remain selected", () => {
  const { editor, onCommit } = fixture();
  try {
    const before = editor.state.doc;
    editor.setEditable(false);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
    expect(editor.state.doc).toBe(before);
    expect(onCommit).not.toHaveBeenCalled();
    editor.setEditable(true);
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
    );
    expect(
      applyAcceptedOperations(editor, [
        { afterId: "image", id: "divider", parentId: null, type: "move" },
      ]),
    ).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.attrs.id).toBe(
      "divider",
    );
  } finally {
    editor.destroy();
  }
});
