// @vitest-environment jsdom

import {
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
  type schema,
} from "@acme/blocknote/schema";
import { BlockNoteView } from "@blocknote/shadcn";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NodeSelection } from "@tiptap/pm/state";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { useBlockEditor } from "../src/components/editor/use-block-editor";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(async () => ({ items: [] })),
}));
vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    references: {
      resolveUrls: {
        queryOptions: (input: unknown) => ({
          queryFn: mocks.resolve,
          queryKey: ["resolve", input],
        }),
      },
    },
  }),
}));
beforeAll(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterAll(() => vi.unstubAllGlobals());
const url = "https://github.com/atomly/journl/pull/302";
const adapter: ReferenceRenderAdapter = {
  convertBlock() {},
  convertInline() {},
  editable: true,
  loadEmbedContent: async () => ({ blocks: [], status: "ready" }),
  loadPreview: async () => ({
    href: url,
    imageUrl: "https://example.com/thumbnail.png",
    kind: "external",
    status: "ready",
    title: "PR 302",
  }),
  openTarget() {},
};
class ClipboardTransfer {
  values = new Map<string, string>();
  effectAllowed = "all";
  dropEffect = "move";
  files = [];
  get types() {
    return [...this.values.keys()];
  }
  getData(type: string) {
    return this.values.get(type) ?? "";
  }
  setData(type: string, value: string) {
    this.values.set(type, value);
  }
  clearData() {
    this.values.clear();
  }
  setDragImage() {}
}
function dragEvent(type: string, transfer: ClipboardTransfer) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 30,
    clientY: 30,
  });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  return event;
}
async function setup(
  referenceType: "referenceCard" | "contentEmbed" = "referenceCard",
  withChildren = true,
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  let editor: ReturnType<typeof useBlockEditor> | undefined;
  function Harness() {
    editor = useBlockEditor({
      initialBlocks: [
        { content: "Parent", id: "parent", type: "paragraph" },
        {
          children: withChildren
            ? [{ content: "Nested", id: "child", type: "paragraph" }]
            : [],
          id: "reference",
          props:
            referenceType === "referenceCard"
              ? { targetKind: "external", url }
              : {
                  documentId: "10000000-0000-4000-8000-000000000001",
                  targetKind: "document",
                  url: "/pages/source",
                },
          type: referenceType,
        },
        { content: "Last", id: "last", type: "paragraph" },
      ],
    });
    return createElement(
      ReferenceRenderContext.Provider,
      { value: adapter },
      createElement(
        BlockNoteView<
          typeof schema.blockSchema,
          typeof schema.inlineContentSchema,
          typeof schema.styleSchema
        >,
        { editor, formattingToolbar: false, sideMenu: false, slashMenu: false },
      ),
    );
  }
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness)),
    ),
  );
  if (!editor) throw new Error("Editor did not mount");
  let surfacePos = -1;
  editor.prosemirrorView.state.doc.descendants((node, pos) => {
    if (node.type.name === "blockContainer" && node.attrs.id === "reference")
      surfacePos = pos + 1;
  });
  vi.spyOn(editor.prosemirrorView, "posAtCoords").mockReturnValue({
    inside: -1,
    pos: surfacePos,
  });
  return {
    async cleanup() {
      vi.restoreAllMocks();
      await act(async () => root.unmount());
      client.clear();
      container.remove();
    },
    editor,
  };
}

test.each(["referenceCard", "contentEmbed"] as const)(
  "clicking the %s background selects its native node",
  async (type) => {
    const { editor, cleanup } = await setup(type);
    try {
      const background = editor.domElement?.querySelector<HTMLElement>(
        "[data-block-surface]",
      );
      if (!background) throw new Error("Reference surface not found");
      await act(async () =>
        background.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
            cancelable: true,
          }),
        ),
      );
      const selection = editor._tiptapEditor.state.selection;
      expect(selection).toBeInstanceOf(NodeSelection);
      expect((selection as NodeSelection).node.type.name).toBe(type);
      expect(editor.getBlock("reference")?.children[0]?.id).toBe("child");
    } finally {
      await cleanup();
    }
  },
);

test.each([true, false])(
  "dragging a card body moves its existing block (children=%s) and undo restores its position",
  async (withChildren) => {
    const { editor, cleanup } = await setup("referenceCard", withChildren);
    try {
      const view = editor.prosemirrorView;
      const original = editor.document;
      const surface = view.dom.querySelector<HTMLElement>(
        "[data-block-surface]",
      );
      if (!surface) throw new Error("Card body did not render");
      expect(surface.draggable).toBe(true);
      expect(surface.querySelector("a")?.draggable).toBe(false);
      expect(surface.querySelector("img")?.draggable).toBe(false);
      await act(async () =>
        surface.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
            cancelable: true,
          }),
        ),
      );
      const transfer = new ClipboardTransfer();
      await act(async () =>
        surface.dispatchEvent(dragEvent("dragstart", transfer)),
      );
      expect(transfer.effectAllowed).toMatch(/move/i);
      expect(transfer.getData("blocknote/html")).toContain("reference");
      mocks.resolve.mockClear();
      const target = view.state.doc.content.size - 1;
      vi.spyOn(view, "posAtCoords").mockReturnValue({
        inside: -1,
        pos: target,
      });
      await act(async () =>
        view.dom.dispatchEvent(dragEvent("drop", transfer)),
      );
      expect(mocks.resolve).not.toHaveBeenCalled();
      expect(editor.document.map((block) => block.id)).toEqual([
        "parent",
        "last",
        "reference",
      ]);
      expect(
        editor.getBlock("reference")?.children.map((block) => block.id),
      ).toEqual(withChildren ? ["child"] : []);
      expect(
        editor.document.filter((block) => block.type === "referenceCard"),
      ).toHaveLength(1);
      await act(async () => {
        editor.undo();
      });
      expect(editor.document).toEqual(original);
    } finally {
      vi.restoreAllMocks();
      await cleanup();
    }
  },
);

test("an external URL drop still inserts a new card through the app hook", async () => {
  const { editor, cleanup } = await setup();
  try {
    const view = editor.prosemirrorView;
    editor.insertBlocks([{ id: "empty", type: "paragraph" }], "last", "after");
    let pos = -1;
    view.state.doc.descendants((node, position) => {
      if (node.type.name === "blockContainer" && node.attrs.id === "empty")
        pos = position + 2;
    });
    vi.spyOn(view, "posAtCoords").mockReturnValue({ inside: -1, pos });
    const transfer = new ClipboardTransfer();
    transfer.setData("text/plain", "https://example.com/new");
    transfer.setData("text/html", "");
    await act(async () => view.dom.dispatchEvent(dragEvent("drop", transfer)));
    expect(editor.getBlock("empty")?.type).toBe("referenceCard");
    expect(editor.getBlock("empty")?.props).toMatchObject({
      url: "https://example.com/new",
    });
    expect(
      editor.document.filter((block) => block.type === "referenceCard"),
    ).toHaveLength(2);
  } finally {
    vi.restoreAllMocks();
    await cleanup();
  }
});
