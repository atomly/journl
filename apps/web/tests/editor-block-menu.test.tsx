// @vitest-environment jsdom

import { type ReferenceRenderAdapter, schema } from "@acme/blocknote/schema";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { NodeSelection } from "@tiptap/pm/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import {
  BlockEditorContextMenu,
  cloneBlockForDuplicate,
  contextSelectionBlock,
  permitsBlockContextMenu,
  referenceSourceHref,
} from "../src/components/editor/block-editor-block-menu";
import * as DropdownMenu from "../src/components/ui/dropdown-menu";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing test fixture");
  return value;
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  vi.unstubAllGlobals();
});

test("native touch, link, control, and selected-text menus remain available", () => {
  const block = document.createElement("article");
  block.innerHTML =
    '<a href="https://example.com">Source</a><button>Options</button><p>Excerpt</p><div class="content-embed-body">Read this</div>';
  document.body.append(block);
  expect(permitsBlockContextMenu(block, "mouse")).toBe(true);
  expect(permitsBlockContextMenu(block, "touch")).toBe(false);
  expect(
    permitsBlockContextMenu(required(block.querySelector("a")), "mouse"),
  ).toBe(false);
  expect(
    permitsBlockContextMenu(required(block.querySelector("button")), "mouse"),
  ).toBe(false);
  expect(
    permitsBlockContextMenu(
      required(block.querySelector(".content-embed-body")),
      "mouse",
    ),
  ).toBe(false);
  const range = document.createRange();
  range.selectNodeContents(required(block.querySelector("p")));
  window.getSelection()?.addRange(range);
  expect(permitsBlockContextMenu(block, "mouse")).toBe(false);
  expect(permitsBlockContextMenu(block, "mouse", true)).toBe(true);
  block.remove();
});

test("duplicating a reference creates fresh IDs for the entire subtree and retains content and destination", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        children: [
          { content: "Keep this context", id: "child", type: "paragraph" },
        ],
        id: "card",
        props: {
          targetKind: "external",
          url: "https://github.com/atomly/journl/pull/302",
        },
        type: "referenceCard",
      },
    ],
    schema,
  });
  const original = required(editor.document[0]);
  editor.insertBlocks([cloneBlockForDuplicate(original)], original, "after");
  const [source, duplicate] = editor.document;
  expect(source?.id).toBe("card");
  expect(duplicate?.id).not.toBe("card");
  expect(duplicate?.props).toEqual(original.props);
  expect(duplicate?.children[0]?.id).not.toBe("child");
  expect(duplicate?.children[0]?.content).toEqual(
    original.children[0]?.content,
  );
  editor._tiptapEditor.destroy();
});

test("right-click opens scoped block actions and Delete acts on the clicked block", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    matches: true,
    removeEventListener() {},
  }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const editor = BlockNoteEditor.create({
    initialContent: [
      { content: "Keep", id: "first", type: "paragraph" },
      { content: "Remove", id: "second", type: "paragraph" },
    ],
    schema,
  });
  try {
    await act(async () => {
      root.render(
        <BlockNoteView
          editor={editor}
          formattingToolbar={false}
          sideMenu={false}
          shadCNComponents={{ DropdownMenu }}
        >
          <BlockEditorContextMenu />
        </BlockNoteView>,
      );
    });
    const target = required(
      container.querySelector<HTMLElement>(
        '[data-id="second"] .bn-block-content',
      ),
    );
    const touch = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(touch, "pointerType", { value: "touch" });
    target.dispatchEvent(touch);
    const nativeMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(nativeMenu);
    expect(nativeMenu.defaultPrevented).toBe(false);
    const mouse = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(mouse, "pointerType", { value: "mouse" });
    target.dispatchEvent(mouse);
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });
    await act(async () => {
      target.dispatchEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(event.defaultPrevented).toBe(true);
    const popup = container.querySelector(
      '.bn-root [data-slot="dropdown-menu-content"]',
    );
    expect(popup).not.toBeNull();
    const item = required(
      [
        ...required(popup).querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find((element) => element.textContent === "Delete"),
    );
    await act(async () => {
      item.click();
    });
    expect(editor.getBlock("first")).toBeDefined();
    expect(editor.getBlock("second")).toBeUndefined();
    await act(async () => {
      editor.setTextCursorPosition("first", "start");
      editor.focus();
      const shortcut = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "F10",
        shiftKey: true,
      });
      editor._tiptapEditor.view.dom.dispatchEvent(shortcut);
      expect(shortcut.defaultPrevented).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(
      container.querySelector('.bn-root [data-slot="dropdown-menu-content"]'),
    ).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    editor._tiptapEditor.destroy();
    container.remove();
  }
});

test("keyboard block targeting uses a selected card instead of the last text cursor", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        id: "card",
        props: { targetKind: "external", url: "https://example.com" },
        type: "referenceCard",
      },
      { content: "Last text cursor", id: "text", type: "paragraph" },
    ],
    schema,
  });
  editor._tiptapEditor.mount(document.createElement("div"));
  editor.setTextCursorPosition("text", "start");
  let position = -1;
  editor._tiptapEditor.state.doc.descendants((node, pos) => {
    if (node.type.name === "referenceCard") position = pos;
  });
  editor._tiptapEditor.view.dispatch(
    editor._tiptapEditor.state.tr.setSelection(
      NodeSelection.create(editor._tiptapEditor.state.doc, position),
    ),
  );
  expect(contextSelectionBlock(editor).id).toBe("card");
  editor._tiptapEditor.destroy();
});

test("internal source URL is resolved when legacy card props have no URL", async () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        id: "card",
        props: {
          documentId: "11111111-1111-4111-8111-111111111111",
          targetKind: "document",
        },
        type: "referenceCard",
      },
    ],
    schema,
  });
  const loadPreview = vi.fn().mockResolvedValue({
    href: "/pages/11111111-1111-4111-8111-111111111111",
    status: "ready",
  });
  const adapter = { loadPreview } as unknown as ReferenceRenderAdapter;
  expect(
    await referenceSourceHref(required(editor.getBlock("card")), adapter),
  ).toBe(
    new URL(
      "/pages/11111111-1111-4111-8111-111111111111",
      window.location.origin,
    ).toString(),
  );
  expect(loadPreview).toHaveBeenCalledOnce();
  loadPreview.mockResolvedValue({ status: "unavailable" });
  expect(
    await referenceSourceHref(required(editor.getBlock("card")), adapter),
  ).toBeNull();
  editor._tiptapEditor.destroy();
});
