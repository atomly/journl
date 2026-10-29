// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { SlashMenuItem } from "../engine/slash-items";
import { slashKey } from "../engine/suggestions";
import { EditorContent } from "./editor-content";
import { EditorRoot, useEditorSelector } from "./editor-root";
import { EditorToolbar } from "./editor-toolbar";
import { BoldButton } from "./mark-button";
import { useSlashMenu } from "./slash-menu";
import { useBetterEditor } from "./use-better-editor";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("composed content and toolbar share one engine across live presentation changes", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  let selectorRenders = 0;
  function Selection() {
    useEditorSelector((editor) => editor.isEditable);
    selectorRenders++;
    return null;
  }
  function View({ mode }: { mode: "inline" | "sticky" }) {
    controller = useBetterEditor({
      editable: true,
      initialBlocks: [{ id: "p", type: "paragraph" }],
    });
    return (
      <EditorRoot editor={controller.editor}>
        <EditorContent />
        <Selection />
        <EditorToolbar mode={mode}>
          <BoldButton>Custom bold</BoldButton>
        </EditorToolbar>
      </EditorRoot>
    );
  }
  try {
    await act(async () => root.render(<View mode="inline" />));
    const editor = controller?.editor;
    const before = selectorRenders;
    await act(async () => {
      editor?.commands.insertContent("Draft");
    });
    expect(selectorRenders).toBe(before);
    await act(async () => root.render(<View mode="sticky" />));
    expect(controller?.editor).toBe(editor);
    expect(editor?.state.doc.textContent).toBe("Draft");
    expect(
      container.querySelector('[data-better-editor-toolbar-mode="sticky"]'),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-better-editor-toolbar-mode] button")
        ?.textContent,
    ).toBe("Custom bold");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("slash keyboard and custom view use the same ordered results, skipping disabled items", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  let menu: ReturnType<typeof useSlashMenu> | undefined;
  const items: SlashMenuItem[] = [
    {
      disabled: true,
      id: "disabled",
      run: ({ transaction }) => transaction.insertText("wrong"),
      title: "Unavailable",
    },
    {
      id: "custom",
      run: ({ transaction }) => transaction.insertText("Custom output"),
      title: "Custom",
    },
  ];
  function Menu() {
    menu = useSlashMenu({ items });
    return null;
  }
  function View() {
    controller = useBetterEditor({
      editable: true,
      initialBlocks: [{ id: "p", type: "paragraph" }],
    });
    return (
      <EditorRoot editor={controller.editor}>
        <EditorContent />
        <Menu />
      </EditorRoot>
    );
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => {
      const editor = controller?.editor;
      editor?.view.focus();
      editor?.commands.insertContent("/");
    });
    const editor = controller?.editor;
    expect(menu?.query?.items.map((item) => item.id)).toEqual([
      "disabled",
      "custom",
    ]);
    expect(menu?.query?.index).toBe(1);
    await act(async () => {
      editor?.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(editor?.state.doc.textContent).toBe("Custom output");
    expect(editor && slashKey.getState(editor.state)).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("late slash results cannot replace the current query", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  let menu: ReturnType<typeof useSlashMenu> | undefined;
  const requests = new Map<
    string,
    { resolve: (items: readonly SlashMenuItem[]) => void; signal: AbortSignal }
  >();
  const source = (query: string, { signal }: { signal: AbortSignal }) =>
    new Promise<readonly SlashMenuItem[]>((resolve) => {
      requests.set(query, { resolve, signal });
    });
  function Menu() {
    menu = useSlashMenu({ items: source });
    return null;
  }
  function View() {
    controller = useBetterEditor({
      editable: true,
      initialBlocks: [{ id: "p", type: "paragraph" }],
    });
    return (
      <EditorRoot editor={controller.editor}>
        <EditorContent />
        <Menu />
      </EditorRoot>
    );
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => {
      controller?.editor?.view.focus();
      controller?.editor?.commands.insertContent("/old");
    });
    await act(async () => {
      controller?.editor?.commands.insertContent("new");
    });
    expect(requests.get("old")?.signal.aborted).toBe(true);
    const item = (id: string): SlashMenuItem => ({
      id,
      run: ({ transaction }) => transaction.insertText(id),
      title: id,
    });
    await act(async () => requests.get("oldnew")?.resolve([item("latest")]));
    await act(async () => requests.get("old")?.resolve([item("stale")]));
    expect(menu?.query?.items.map((entry) => entry.id)).toEqual(["latest"]);
    await act(async () => menu?.select("latest"));
    expect(controller?.editor?.state.doc.textContent).toBe("latest");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("minimal content does not capture slash keys without a mounted command menu", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  function View() {
    controller = useBetterEditor({
      initialBlocks: [{ id: "p", type: "paragraph" }],
    });
    return (
      <EditorRoot editor={controller.editor}>
        <EditorContent aria-label="Custom article" />
      </EditorRoot>
    );
  }
  try {
    await act(async () => root.render(<View />));
    expect(controller?.editor?.isEditable).toBe(true);
    await act(async () => {
      controller?.editor?.view.focus();
      controller?.editor?.commands.insertContent("/paragraph");
    });
    const editor = controller?.editor;
    expect(editor && slashKey.getState(editor.state)).toBeNull();
    expect(editor?.view.dom.getAttribute("aria-label")).toBe("Custom article");
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    await act(async () => {
      editor?.view.dom.dispatchEvent(event);
    });
    expect(editor?.state.doc.textContent).toContain("/paragraph");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("Alt+F10 focuses an already visible toolbar", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  function View() {
    controller = useBetterEditor({
      editable: true,
      initialBlocks: [{ id: "p", type: "paragraph" }],
    });
    return (
      <EditorRoot editor={controller.editor}>
        <EditorContent />
        <EditorToolbar visibility="always">
          <BoldButton>Bold</BoldButton>
        </EditorToolbar>
      </EditorRoot>
    );
  }
  try {
    await act(async () => root.render(<View />));
    await act(async () => {
      controller?.editor?.view.focus();
      controller?.editor?.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          key: "F10",
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(
      container.querySelector("[data-better-editor-toolbar-mode] button"),
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

test("reference views fetch and render embedded content only through consumer composition", async () => {
  const { ReferenceClientContext } = await import("./reference-client");
  const { ReferenceViews, useReferenceViews } = await import(
    "./reference-views"
  );
  const loadEmbedContent = vi.fn(async () => ({
    blocks: [{ content: "Consumer content", id: "child", type: "paragraph" }],
    status: "ready" as const,
  }));
  const client: import("@acme/references").ReferenceClient = {
    loadEmbedContent,
    loadPreview: async () => ({
      href: "https://example.com/source",
      status: "ready",
      title: "Embedded source",
    }),
    openTarget: () => {},
    resolveUrl: async () => ({ items: [] }),
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function View({ render }: { render: boolean }) {
    const views = useReferenceViews();
    const { editor } = useBetterEditor({
      extensions: [views.extension],
      initialBlocks: [
        {
          id: "embed",
          props: {
            blockId: "",
            documentId: "source",
            label: "Embedded",
            resolutionToken: "",
            targetKind: "document",
            url: "https://example.com/source",
            version: 1,
          },
          type: "contentEmbed",
        },
      ],
    });
    return (
      <ReferenceClientContext.Provider value={client}>
        <EditorRoot editor={editor}>
          <EditorContent />
          <ReferenceViews
            store={views}
            renderEmbeddedContent={
              render
                ? (blocks) => <p data-consumer-preview="">{blocks[0]?.id}</p>
                : undefined
            }
          />
        </EditorRoot>
      </ReferenceClientContext.Provider>
    );
  }
  try {
    await act(async () => root.render(<View render={false} />));
    expect(
      container.querySelector('[aria-label="Reference actions"]'),
    ).toBeNull();
    const toggle = container.querySelector<HTMLButtonElement>(
      ".content-embed-toggle",
    );
    expect(toggle).not.toBeNull();
    await act(async () => toggle?.click());
    expect(loadEmbedContent).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".better-editor-tiptap")).toHaveLength(1);
    await act(async () => root.render(<View render={true} />));
    expect(loadEmbedContent).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[data-consumer-preview]")?.textContent,
    ).toBe("child");
    expect(container.querySelectorAll(".better-editor-tiptap")).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("toolbar callback updates preserve owned popup focus and use the latest handlers", async () => {
  const container = document.createElement("div");
  const popup = document.createElement("button");
  document.body.append(container, popup);
  const root = createRoot(container);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  const keys: number[] = [];
  const changes: number[] = [];
  function View({ revision }: { revision: number }) {
    controller = useBetterEditor({
      initialBlocks: [{ content: "Selected", id: "p", type: "paragraph" }],
    });
    return (
      <EditorRoot editor={controller.editor}>
        <EditorContent />
        <EditorToolbar
          visibility="selection"
          onEditorKeyDown={() => keys.push(revision)}
          onOpenChange={() => changes.push(revision)}
        >
          <button type="button">Control</button>
        </EditorToolbar>
      </EditorRoot>
    );
  }
  try {
    await act(async () => root.render(<View revision={1} />));
    const editor = controller?.editor;
    if (!editor) throw new Error("Missing engine");
    await act(async () => {
      editor.view.focus();
      editor.commands.selectAll();
    });
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    popup.dataset.tiptapOwner = editor.instanceId;
    await act(async () => popup.focus());
    expect(editor.isFocused).toBe(false);
    await act(async () => root.render(<View revision={2} />));
    expect(document.activeElement).toBe(popup);
    expect(container.querySelector('[role="toolbar"]')).toBe(toolbar);
    await act(async () => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          key: "F10",
        }),
      );
    });
    expect(keys).toEqual([2]);
    expect(changes).toEqual([2]);
  } finally {
    await act(async () => root.unmount());
    popup.remove();
    container.remove();
  }
});
