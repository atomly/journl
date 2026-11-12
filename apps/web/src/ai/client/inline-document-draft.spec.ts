// @vitest-environment jsdom

import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { tableExtensions } from "@acme/better-editor/engine/table-schema";
import type { DocumentBlock } from "@acme/document";
import { afterEach, expect, test, vi } from "vitest";
import { InlineDocumentDraft } from "./inline-document-draft";

const disposables: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposables.splice(0)) dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("centers the changed line, coalesces frames, and respects manual scrolling", () => {
  const frames: FrameRequestCallback[] = [];
  const schedule = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("requestAnimationFrame", schedule);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const viewport = document.createElement("div");
  viewport.style.overflowY = "auto";
  const mount = document.createElement("div");
  viewport.append(mount);
  document.body.append(viewport);
  const scroll = vi.fn();
  Object.defineProperties(viewport, {
    clientHeight: { value: 600 },
    scrollBy: { value: scroll },
  });
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 100, 800, 600),
  );
  const editor = createDocumentEditor({
    element: mount,
    extensions: [],
    initialBlocks: [{ content: "Original", id: "a", type: "paragraph" }],
    onCommit: vi.fn(),
    resolveUrl: async () => ({ items: [] }),
  });
  const following = vi.fn();
  const draft = new InlineDocumentDraft(editor, following);
  disposables.push(() => {
    draft.destroy();
    editor.destroy();
    viewport.remove();
  });
  const coordinates = vi
    .spyOn(draft.surface.editor.view, "coordsAtPos")
    .mockReturnValue({
      bottom: 920,
      left: 0,
      right: 0,
      top: 900,
    });
  draft.follow();
  expect(schedule).not.toHaveBeenCalled();
  const accepted = editor.state.doc;
  const first = editor.state.tr.insertText(" first", 2).doc;
  const second = editor.state.tr.insertText(" second", 2).doc;
  draft.update(first);
  draft.update(second);
  expect(schedule).toHaveBeenCalledTimes(1);
  frames.shift()?.(0);
  expect(scroll).toHaveBeenLastCalledWith({ behavior: "instant", top: 510 });
  expect(draft.surface.element.style.paddingBottom).toBe("300px");
  expect(coordinates).toHaveBeenCalledOnce();
  expect(editor.state.doc).toBe(accepted);

  draft.surface.editor.view.dom.focus();
  expect(document.activeElement).toBe(draft.surface.editor.view.dom);
  draft.surface.editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "PageUp" }),
  );
  draft.update(first);
  expect(following).toHaveBeenLastCalledWith(false);
  expect(schedule).toHaveBeenCalledTimes(1);
  draft.follow();
  expect(following).toHaveBeenLastCalledWith(true);
  frames.shift()?.(0);
  expect(scroll).toHaveBeenCalledTimes(2);
});

test("AI fade skips unchanged human writing and nested parent bodies, and honors reduced motion", async () => {
  const { fadeAIChanges } = await import("./inline-document-draft");
  const { toTiptapDocument } = await import(
    "@acme/better-editor/serialization/tiptap"
  );
  const animated: string[] = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const previousAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: function (this: HTMLElement) {
      animated.push(
        this.closest<HTMLElement>("[data-block-id]")?.dataset.blockId ?? "",
      );
    },
  });
  const blocks: DocumentBlock[] = [
    { content: "Original A", id: "a", type: "paragraph" as const },
    { content: "Human writing", id: "b", type: "paragraph" as const },
    { content: "Original C", id: "c", type: "paragraph" as const },
    {
      children: [
        { content: "Original child", id: "child", type: "paragraph" as const },
      ],
      content: "Human parent",
      id: "parent",
      type: "bulletListItem" as const,
    },
    {
      content: { rows: [{ cells: ["Retained cell"] }], type: "tableContent" },
      id: "table",
      type: "table",
    },
  ];
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: tableExtensions(),
    initialBlocks: blocks,
    onCommit: vi.fn(),
    resolveUrl: async () => ({ items: [] }),
  });
  try {
    const before = editor.state.doc;
    const changed = structuredClone(blocks);
    for (const block of changed) {
      if (block.id === "a") block.content = "AI A";
      if (block.id === "c") block.content = "AI C";
      for (const child of block.children ?? []) child.content = "AI child";
      if (block.type === "table")
        block.content = {
          rows: [{ cells: ["Updated cell"] }],
          type: "tableContent",
        };
    }
    changed.push({
      content: { rows: [{ cells: ["New cell"] }], type: "tableContent" },
      id: "new-table",
      type: "table",
    });
    editor.view.dispatch(
      editor.state.tr.replaceWith(
        0,
        editor.state.doc.content.size,
        toTiptapDocument(changed, editor.schema).content,
      ),
    );
    expect(animated).toEqual([]); // Ordinary transactions do not install animation behavior.
    fadeAIChanges(editor, before);
    expect(animated.sort()).toEqual(["a", "c", "child", "new-table"]);
    animated.length = 0;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    fadeAIChanges(editor, before);
    expect(animated).toEqual([]);
  } finally {
    editor.destroy();
    if (previousAnimate)
      Object.defineProperty(HTMLElement.prototype, "animate", previousAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
});
