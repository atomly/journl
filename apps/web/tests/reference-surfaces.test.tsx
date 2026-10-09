// @vitest-environment jsdom
import {
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
  schema,
} from "@acme/blocknote/schema";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { TextSelection } from "@tiptap/pm/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { BlockEditorContextMenu } from "../src/components/editor/block-editor-block-menu";
import { ReferenceSelectionExtension } from "../src/components/editor/reference-selection";
import * as DropdownMenu from "../src/components/ui/dropdown-menu";
import * as Popover from "../src/components/ui/popover";

const props = {
  targetKind: "external" as const,
  url: "https://github.com/atomly/journl/pull/302",
};
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  window.getSelection()?.removeAllRanges();
  vi.unstubAllGlobals();
});
async function setup() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    matches: true,
    removeEventListener() {},
  }));
  const editor = BlockNoteEditor.create({
    extensions: [ReferenceSelectionExtension()],
    initialContent: [
      {
        content: [
          { styles: {}, text: "Before ", type: "text" },
          { props: { ...props, label: "First" }, type: "contentReference" },
          { styles: {}, text: " between ", type: "text" },
          { props: { ...props, label: "Second" }, type: "contentReference" },
        ],
        id: "before",
        type: "paragraph",
      },
      { id: "card", props, type: "referenceCard" },
      { content: "After", id: "after", type: "paragraph" },
    ],
    schema,
  });
  let referencePos = 0;
  editor._tiptapEditor.state.doc.descendants((node, pos) => {
    if (node.type.name === "referenceCard") referencePos = pos;
  });
  const adapter: ReferenceRenderAdapter = {
    canConvertInline: () => true,
    convertBlock: vi.fn(),
    convertInline: vi.fn(),
    editable: true,
    loadEmbedContent: async () => ({ status: "unavailable" }),
    loadPreview: async () => ({ status: "ready", title: "Pull request" }),
    openTarget: vi.fn(),
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <ReferenceRenderContext.Provider value={adapter}>
        <BlockNoteView
          editor={editor}
          sideMenu={false}
          formattingToolbar={false}
          shadCNComponents={{ DropdownMenu, Popover }}
        >
          <BlockEditorContextMenu />
        </BlockNoteView>
      </ReferenceRenderContext.Provider>,
    ),
  );
  vi.spyOn(editor.prosemirrorView, "posAtCoords").mockReturnValue({
    inside: -1,
    pos: referencePos,
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return { adapter, container, editor };
}
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture");
  return value;
}
function pointer(target: HTMLElement, type: string) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
  });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  target.dispatchEvent(event);
}
async function click(target: HTMLElement) {
  await act(async () => {
    pointer(target, "pointerdown");
    pointer(target, "mousedown");
    pointer(target, "pointerup");
    pointer(target, "mouseup");
    pointer(target, "click");
    await new Promise((r) => setTimeout(r, 30));
  });
}

test("native range selection highlights included cards and removes decoration when the selection collapses", async () => {
  const { editor, container } = await setup();
  const view = editor.prosemirrorView;
  await act(async () => {
    editor.focus();
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          3,
          view.state.doc.content.size - 3,
        ),
      ),
    );
  });
  const card = required(
    container.querySelector('[data-content-type="referenceCard"]')
      ?.parentElement,
  );
  expect(card.getAttribute("data-reference-selected")).toBe("true");
  await act(async () => editor.setTextCursorPosition("after"));
  expect(card.hasAttribute("data-reference-selected")).toBe(false);
});

test("portalled card menu pointerdown does not reselect its source or close before the choice is clicked", async () => {
  const { editor, container, adapter } = await setup();
  const card = required(container.querySelector<HTMLElement>("article"));
  await act(async () => {
    pointer(card, "mousedown");
  });
  const trigger = required(card.querySelector<HTMLButtonElement>("button"));
  await click(trigger);
  const item = required(
    [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Inline",
    ),
  );
  await act(async () => {
    item.focus();
    pointer(item, "pointerdown");
    pointer(item, "mousedown");
  });
  expect(document.activeElement).toBe(item);
  expect(
    item.closest('[role="menu"]')?.getAttribute("data-open"),
  ).not.toBeNull();
  await act(async () => {
    pointer(item, "pointerup");
    pointer(item, "mouseup");
    pointer(item, "click");
  });
  expect(adapter.convertBlock).toHaveBeenCalledWith(
    "card",
    { kind: "external", url: props.url },
    "contentReference",
    "",
    props.url,
  );
  expect(editor.getBlock("before")).toBeDefined();
});

test("desktop right-click on the second rich link offers display choices for that exact occurrence", async () => {
  const { editor, container, adapter } = await setup();
  const badges = [
    ...container.querySelectorAll<HTMLElement>("a.content-reference"),
  ];
  const second = required(badges[1]);
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    button: 2,
    cancelable: true,
    clientX: 40,
    clientY: 40,
  });
  await act(async () => second.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  const display = required(
    [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Display as",
    ),
  );
  await act(async () => {
    display.focus();
    display.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowRight",
      }),
    );
    await new Promise((r) => setTimeout(r, 30));
  });
  const card = required(
    [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Card",
    ),
  );
  await click(card);
  expect(adapter.convertInline).toHaveBeenCalledWith(
    "before",
    { kind: "external", url: props.url },
    "referenceCard",
    "Second",
    props.url,
    1,
  );
  expect(editor.document).toHaveLength(3);
});
