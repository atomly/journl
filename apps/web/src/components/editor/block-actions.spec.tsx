// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { BlockActions } from "./block-actions";

const callbacks = vi.hoisted(() => new Map<string, () => void>());
vi.mock("@acme/better-editor/ui/controls", () => ({
  EditorMenuItem: ({
    hint,
    onClick,
    disabled,
    children,
  }: {
    hint: string;
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
  }) => {
    callbacks.set(hint, onClick);
    return (
      <button
        type="button"
        aria-label={hint}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    );
  },
}));
vi.mock("@acme/ui/dropdown-menu", () => ({
  DropdownMenuSeparator: () => <hr />,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("retained history actions cannot mutate an editor after it becomes read-only", async () => {
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
    initialBlocks: [{ content: "Text", id: "a", type: "paragraph" }],
    resolveUrl: async () => ({ items: [] }),
  });
  editor.view.dispatch(editor.state.tr.insertText("!", 2));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<BlockActions editor={editor} />));
    const undo = host.querySelector<HTMLButtonElement>(
      'button[aria-label^="Undo"]',
    );
    expect(undo?.disabled).toBe(false);
    const retained = [...callbacks]
      .filter(([hint]) => /^(Undo|Redo)/.test(hint))
      .map(([, callback]) => callback);
    expect(retained).toHaveLength(2);
    await act(async () => editor.setEditable(false));
    expect(undo?.disabled).toBe(true);
    const before = editor.getJSON();
    await act(async () => {
      for (const action of retained) action();
    });
    expect(editor.getJSON()).toEqual(before);
    await act(async () => editor.setEditable(true));
    expect(undo?.disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    host.remove();
    callbacks.clear();
  }
});
