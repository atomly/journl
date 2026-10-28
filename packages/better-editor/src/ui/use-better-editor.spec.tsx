// @vitest-environment jsdom
import { type Editor, Extension } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { EditorCommit } from "../engine/editor";
import { useBetterEditor } from "./use-better-editor";

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
    const { editor, error, host } = useBetterEditor({
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

test("array identities and live editability preserve content; reset is deliberate", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const extension = Extension.create({ name: "stable" });
  let current: ReturnType<typeof useBetterEditor> | undefined;
  function View({
    editable,
    resetKey = 0,
  }: {
    editable: boolean;
    resetKey?: number;
  }) {
    current = useBetterEditor({
      editable,
      extensions: [extension],
      initialBlocks: [{ content: "Initial", id: "initial", type: "paragraph" }],
      resetKey,
      resolveUrl: async () => ({ items: [] }),
    });
    return <div ref={current.host} />;
  }
  try {
    await act(async () => root.render(<View editable />));
    const original = current?.editor;
    await act(async () => {
      original?.commands.insertContent("Changed ");
    });
    await act(async () => root.render(<View editable={false} />));
    expect(current?.editor).toBe(original);
    expect(original?.isEditable).toBe(false);
    expect(original?.state.doc.textContent).toContain("Changed");
    expect(current?.configurationError).toBeUndefined();
    await act(async () => root.render(<View editable resetKey={1} />));
    expect(original?.isDestroyed).toBe(true);
    expect(current?.editor).not.toBe(original);
    expect(current?.editor?.state.doc.textContent).toBe("Initial");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("consumer callback failure does not invalidate or disable the editor", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const failure = new Error("Consumer save failed");
  let current: ReturnType<typeof useBetterEditor> | undefined;
  function View() {
    current = useBetterEditor({
      editable: true,
      extensions: [],
      initialBlocks: [{ id: "p", type: "paragraph" }],
      onCommit: () => {
        throw failure;
      },
      resolveUrl: async () => ({ items: [] }),
    });
    return <div ref={current.host} />;
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => {
      current?.editor?.commands.insertContent("Still writing");
    });
    expect(current?.error).toBe(false);
    expect(current?.editor?.isEditable).toBe(true);
    expect(current?.callbackError).toBe(failure);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("consumer mutation cannot corrupt cached snapshots or future operation IDs", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let current: ReturnType<typeof useBetterEditor> | undefined;
  const ids: string[] = [];
  function View() {
    current = useBetterEditor({
      editable: true,
      extensions: [],
      initialBlocks: [{ id: "p", type: "paragraph" }],
      onCommit: (blocks, operations) => {
        for (const operation of operations)
          if ("id" in operation) ids.push(operation.id);
        const first = blocks[0];
        if (first) first.id = "consumer mutation";
        const operation = operations[0];
        if (operation && "id" in operation) operation.id = "consumer mutation";
      },
      resolveUrl: async () => ({ items: [] }),
    });
    return <div ref={current.host} />;
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => {
      current?.editor?.commands.insertContent("First");
    });
    await act(async () => {
      current?.editor?.commands.insertContent(" second");
    });
    expect(current?.error).toBe(false);
    expect(ids).toEqual(["p", "p"]);
    expect(current?.editor?.state.doc.textContent).toBe("First second");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("commit retry retains missed edits and clears the consumer error", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let current: ReturnType<typeof useBetterEditor> | undefined;
  let attempts = 0;
  const received: unknown[] = [];
  function View() {
    current = useBetterEditor({
      editable: true,
      extensions: [],
      initialBlocks: [{ id: "p", type: "paragraph" }],
      onCommit: (blocks, operations) => {
        attempts++;
        if (attempts === 1) throw new Error("Consumer failed");
        received.push({ blocks, operations });
      },
      resolveUrl: async () => ({ items: [] }),
    });
    return <div ref={current.host} />;
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => {
      current?.editor?.commands.insertContent("Retained");
    });
    expect(current?.callbackError).toBeInstanceOf(Error);
    await act(async () => {
      expect(current?.retryCommit()).toBe(true);
    });
    expect(attempts).toBe(2);
    expect(current?.callbackError).toBeUndefined();
    expect(received).toMatchObject([
      {
        blocks: [{ content: [{ text: "Retained" }], id: "p" }],
        operations: [
          {
            data: { content: [{ text: "Retained" }] },
            id: "p",
            type: "update",
          },
        ],
      },
    ]);
    expect(current?.editor?.isEditable).toBe(true);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
