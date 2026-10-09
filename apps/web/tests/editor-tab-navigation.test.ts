// @vitest-environment jsdom

import { schema } from "@acme/blocknote/schema";
import { BlockNoteEditor, FormattingToolbarExtension } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NodeSelection } from "@tiptap/pm/state";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterAll(() => vi.unstubAllGlobals());

import { useBlockEditor } from "../src/components/editor/use-block-editor";

vi.mock("../src/trpc/react", () => ({ useTRPC: () => ({ references: {} }) }));

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

test.each(["referenceCard", "contentEmbed"] as const)(
  "the app editor hook outdents a selected %s immediately after Tab",
  async (referenceType) => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);
    const client = new QueryClient();
    let editor: ReturnType<typeof useBlockEditor> | undefined;
    function Harness() {
      editor = useBlockEditor({
        initialBlocks: [
          { content: "Parent", id: "parent", type: "paragraph" },
          {
            children: [{ content: "Child", id: "child", type: "paragraph" }],
            id: "card",
            props: { url: "https://github.com/atomly/journl/pull/302" },
            type: referenceType,
          },
          { content: "Last", id: "last", type: "paragraph" },
        ],
      });
      return createElement(
        BlockNoteView<
          typeof schema.blockSchema,
          typeof schema.inlineContentSchema,
          typeof schema.styleSchema
        >,
        {
          editor,
          formattingToolbar: false,
          sideMenu: false,
          slashMenu: false,
        },
      );
    }
    try {
      await act(async () =>
        root.render(
          createElement(
            QueryClientProvider,
            { client },
            createElement(Harness),
          ),
        ),
      );
      if (!editor) throw new Error("Editor did not mount");
      const view = editor._tiptapEditor.view;
      const original = editor.document;
      let pos = -1;
      view.state.doc.descendants((node, position) => {
        if (node.type.name === referenceType) pos = position;
      });
      view.dispatch(
        view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)),
      );
      const background = view.dom.querySelector<HTMLElement>(
        `[data-content-type="${referenceType}"]`,
      );
      if (!background) throw new Error("Card node view did not render");
      const tab = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Tab",
        key: "Tab",
      });
      await act(async () => {
        background.dispatchEvent(tab);
      });
      expect(tab.defaultPrevented).toBe(true);
      expect(editor.document.map((block) => block.id)).toEqual([
        "parent",
        "last",
      ]);
      expect(editor.getBlock("card")?.children[0]?.id).toBe("child");
      const shiftTab = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Tab",
        key: "Tab",
        shiftKey: true,
      });
      const indentedBackground = view.dom.querySelector<HTMLElement>(
        `[data-content-type="${referenceType}"]`,
      );
      if (!indentedBackground) throw new Error("Indented card did not render");
      await act(async () => {
        indentedBackground.dispatchEvent(shiftTab);
      });
      expect(shiftTab.defaultPrevented).toBe(true);
      expect(editor.document).toEqual(original);
      const button = document.createElement("button");
      view.dom
        .querySelector(`[data-content-type="${referenceType}"]`)
        ?.append(button);
      const controlTab = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
        shiftKey: true,
      });
      button.dispatchEvent(controlTab);
      expect(controlTab.defaultPrevented).toBe(false);
      expect(editor.document).toEqual(original);
    } finally {
      editor?._tiptapEditor.destroy();
      await act(async () => root.unmount());
      client.clear();
      rootElement.remove();
    }
  },
);
