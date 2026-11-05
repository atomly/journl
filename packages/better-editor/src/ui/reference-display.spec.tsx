// @vitest-environment jsdom

import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { createDocumentEditor } from "../engine/editor";
import { referenceExtensions } from "../engine/reference-schema";
import {
  ReferenceDisplayControl,
  ReferenceDisplayItems,
} from "./reference-display";

const callbacks = vi.hoisted(() => new Map<string, () => void>());
vi.mock("./controls", () => ({
  EditorMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }) => {
    callbacks.set(String(children), onClick);
    return (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  },
  EditorToolbarControl: ({ children }: { children: ReactNode }) => children,
  restoreEditorFocus: () => false,
}));
vi.mock("@acme/ui/dropdown-menu", () => {
  const Pass = ({ children }: { children: ReactNode }) => children;
  return {
    DropdownMenu: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuGroup: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuTrigger: ({ render }: { render: ReactNode }) => render,
  };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const create = () =>
  createDocumentEditor({
    element: document.createElement("div"),
    extensions: referenceExtensions(),
    initialBlocks: [
      { content: "Before Link after", id: "p", type: "paragraph" },
    ],
    resolveUrl: async () => ({ items: [] }),
  });
function linked() {
  const editor = create();
  const mark = editor.schema.marks.link;
  if (!mark) throw new Error("Missing link mark");
  const tr = editor.state.tr.addMark(
    9,
    13,
    mark.create({ href: "https://example.com" }),
  );
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 10)));
  return editor;
}

test("retained link actions use mapped current ranges and refuse readonly or changed targets", async () => {
  const editor = linked();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const insert = vi.fn();
  try {
    await act(async () =>
      root.render(
        <ReferenceDisplayItems editor={editor} insertReference={insert} />,
      ),
    );
    const card = callbacks.get("Card");
    expect(card).toBeTypeOf("function");
    await act(async () =>
      editor.view.dispatch(editor.state.tr.insertText("Prefix ", 2)),
    );
    await act(async () => card?.());
    expect(insert).toHaveBeenLastCalledWith(
      "https://example.com",
      "Link",
      "referenceCard",
    );
    expect(editor.state.selection.from).toBe(16);
    expect(editor.state.selection.to).toBe(20);
    insert.mockClear();
    await act(async () => editor.setEditable(false));
    const before = editor.state.doc;
    await act(async () => card?.());
    expect(editor.state.doc).toBe(before);
    expect(insert).not.toHaveBeenCalled();
    expect(
      [...host.querySelectorAll("button")].every((button) => button.disabled),
    ).toBe(true);
    await act(async () => editor.setEditable(true));
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
      ),
    );
    await act(async () => card?.());
    expect(insert).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    host.remove();
  }
});

test("standalone display controls follow caret changes within one paragraph", async () => {
  const editor = linked();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
      ),
    );
    await act(async () =>
      root.render(
        <ReferenceDisplayControl editor={editor} insertReference={() => {}} />,
      ),
    );
    expect(host.querySelector("button")).toBeNull();
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setSelection(
          TextSelection.create(editor.state.doc, 10),
        ),
      ),
    );
    expect(host.textContent).toContain("Display as");
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
      ),
    );
    expect(host.querySelector("button")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    host.remove();
  }
});

test("retained reference conversion cannot mutate a readonly or destroyed editor", async () => {
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: referenceExtensions(),
    initialBlocks: [
      {
        id: "ref",
        props: {
          blockId: "",
          documentId: "source",
          label: "Source",
          resolutionToken: "",
          targetKind: "document",
          url: "https://example.com",
          version: 1,
        },
        type: "referenceCard",
      },
    ],
    resolveUrl: async () => ({ items: [] }),
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<ReferenceDisplayItems editor={editor} />),
    );
    const link = callbacks.get("Link");
    expect(link).toBeTypeOf("function");
    const before = editor.state.doc;
    await act(async () => editor.setEditable(false));
    await act(async () => link?.());
    expect(editor.state.doc).toBe(before);
    await act(async () => editor.setEditable(true));
    await act(async () => link?.());
    expect(editor.state.doc.firstChild?.firstChild?.type.name).toBe(
      "paragraph",
    );
    await act(async () => editor.destroy());
    expect(() => link?.()).not.toThrow();
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    host.remove();
  }
});
