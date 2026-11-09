// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
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
