// @vitest-environment jsdom

import { schema } from "@acme/blocknote/schema";
import { BlockNoteEditor, FormattingToolbarExtension } from "@blocknote/core";
import { NodeSelection } from "@tiptap/pm/state";
import { expect, test } from "vitest";
import { preserveControlTabNavigation } from "../src/components/editor/editor-tab-navigation";

function makeEditor() {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        children: [{ content: "Existing", id: "existing", type: "paragraph" }],
        content: "Parent",
        id: "parent",
        type: "paragraph",
      },
      {
        children: [{ content: "Child", id: "child", type: "paragraph" }],
        content: "First",
        id: "first",
        type: "paragraph",
      },
      {
        id: "card",
        props: { url: "https://github.com/atomly/journl/pull/302" },
        type: "referenceCard",
      },
      { content: "Last", id: "last", type: "paragraph" },
    ],
    schema,
    tabBehavior: "prefer-indent",
  });
  editor._tiptapEditor.mount(document.createElement("div"));
  return editor;
}

test("Tab indents an entire text selection with its card and children while the formatting toolbar is open", () => {
  const editor = makeEditor();
  const original = editor.document;
  editor.setSelection("first", "last");
  editor.getExtension(FormattingToolbarExtension)?.store.setState(true);
  expect(editor._tiptapEditor.commands.keyboardShortcut("Tab")).toBe(true);
  expect(editor.document).toHaveLength(1);
  expect(editor.document[0]?.children.map((block) => block.id)).toEqual([
    "existing",
    "first",
    "card",
    "last",
  ]);
  expect(editor.getBlock("first")?.children[0]?.id).toBe("child");
  expect(editor._tiptapEditor.commands.keyboardShortcut("Shift-Tab")).toBe(
    true,
  );
  expect(editor.document).toEqual(original);
  editor._tiptapEditor.destroy();
});

test("a selected reference card can indent and outdent without replacing its ID or nested children", () => {
  const editor = makeEditor();
  editor.updateBlock("card", {
    children: [{ content: "Nested", id: "card-child", type: "paragraph" }],
  });
  const original = editor.document;
  let cardPosition = -1;
  editor._tiptapEditor.state.doc.descendants((node, pos) => {
    if (node.type.name === "referenceCard") cardPosition = pos;
  });
  editor._tiptapEditor.view.dispatch(
    editor._tiptapEditor.state.tr.setSelection(
      NodeSelection.create(editor._tiptapEditor.state.doc, cardPosition),
    ),
  );
  expect(editor._tiptapEditor.commands.keyboardShortcut("Tab")).toBe(true);
  expect(editor.getBlock("first")?.children.map((block) => block.id)).toEqual([
    "child",
    "card",
  ]);
  expect(editor.getBlock("card")?.children[0]?.id).toBe("card-child");
  expect(editor._tiptapEditor.commands.keyboardShortcut("Shift-Tab")).toBe(
    true,
  );
  expect(editor.document).toEqual(original);
  editor._tiptapEditor.destroy();
});

test("Tab from card controls keeps native browser focus traversal without preventing default", () => {
  const dom = document.createElement("div");
  const control = document.createElement("button");
  dom.append(control);
  const view = { dom };
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Tab",
  });
  control.addEventListener("keydown", (event) => {
    expect(preserveControlTabNavigation(view, event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
  control.dispatchEvent(event);
  const editableEvent = new KeyboardEvent("keydown", { key: "Tab" });
  dom.addEventListener("keydown", (event) =>
    expect(preserveControlTabNavigation(view, event)).toBe(false),
  );
  dom.dispatchEvent(editableEvent);
});
