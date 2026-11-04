// @vitest-environment jsdom
import { expect, test } from "vitest";
import { createDocumentEditor } from "../engine/editor";
import { blockPresentationExtensions } from "./block-presentation";

test("engine DOM omits presentation controls until the consumer installs them", () => {
  const initialBlocks = [
    { content: "Task", id: "task", type: "checkListItem" as const },
  ];
  const create = (presentation: boolean) =>
    createDocumentEditor({
      element: document.createElement("div"),
      extensions: presentation ? blockPresentationExtensions() : [],
      initialBlocks,
      resolveUrl: async () => ({ items: [] }),
    });
  const engine = create(false);
  const presented = create(true);
  try {
    expect(engine.view.dom.querySelector('input[type="checkbox"]')).toBeNull();
    expect(
      presented.view.dom.querySelector('input[type="checkbox"]'),
    ).not.toBeNull();
    expect(engine.getJSON()).toEqual(presented.getJSON());
    expect(engine.getHTML()).toEqual(presented.getHTML());
  } finally {
    engine.destroy();
    presented.destroy();
  }
});

test("checkbox disabled state follows option changes without changing stored content", () => {
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: blockPresentationExtensions(),
    initialBlocks: [{ content: "Task", id: "task", type: "checkListItem" }],
    resolveUrl: async () => ({ items: [] }),
  });
  try {
    const checkbox = editor.view.dom.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (!checkbox) throw new Error("Missing checkbox");
    const before = editor.state.doc;
    expect(checkbox.disabled).toBe(false);
    editor.setEditable(false);
    expect(checkbox.disabled).toBe(true);
    expect(editor.state.doc).toBe(before);
    editor.setEditable(true);
    expect(checkbox.disabled).toBe(false);
    editor.destroy();
    expect(checkbox.disabled).toBe(true);
  } finally {
    editor.destroy();
  }
});
