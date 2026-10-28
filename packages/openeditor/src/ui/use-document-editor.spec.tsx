// @vitest-environment jsdom
import { type Editor, Extension } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { EditorCommit } from "../engine/editor";
import { useDocumentEditor } from "./use-document-editor";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("core commits to the current callback, preserves mounted state on save, and destroys on unmount", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const first = vi.fn();
  const second = vi.fn();
  const extensions = [Extension.create({ name: "testPresentation" })];
  let mounted: Editor | undefined;
  function View({ onCommit }: { onCommit: EditorCommit }) {
    const { editor, error, host } = useDocumentEditor({
      extensions,
      initialBlocks: [{ id: "paragraph", type: "paragraph" }],
      onCommit,
      resolveUrl: async () => ({ items: [] }),
    });
    mounted = editor;
    expect(error).toBe(false);
    return <div ref={host} />;
  }
  try {
    await act(async () => root.render(<View onCommit={first} />));
    const editor = mounted;
    expect(editor).toBeDefined();
    expect(
      editor?.extensionManager.extensions.filter(
        (item) => item.name === "testPresentation",
      ),
    ).toHaveLength(1);
    await act(async () => {
      editor?.commands.insertContent("First");
    });
    expect(first).toHaveBeenCalledOnce();
    expect(first.mock.calls[0]?.[0][0]).toMatchObject({
      id: "paragraph",
      type: "paragraph",
    });
    const selection = editor?.state.selection;
    await act(async () => root.render(<View onCommit={second} />));
    expect(mounted).toBe(editor);
    expect(editor?.state.selection).toBe(selection);
    await act(async () => {
      editor?.commands.insertContent(" second");
    });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(editor?.state.doc.textContent).toBe("First second");
    await act(async () => root.unmount());
    expect(editor?.isDestroyed).toBe(true);
  } finally {
    host.remove();
  }
});
