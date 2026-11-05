// @vitest-environment jsdom
import { isMacOS } from "@tiptap/core";
import { undo } from "@tiptap/pm/history";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test, vi } from "vitest";
import { fromTiptapDocument } from "../serialization/tiptap";
import { createDocumentEditor } from "./editor";
import { blockAt } from "./identity";
import { BLOCK_DRAG_MIME, beginNativeBlockDrag } from "./native-block-drag";

function fixture() {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = createDocumentEditor({
    element,
    extensions: [],
    initialBlocks: [
      {
        children: [{ content: "Nested", id: "child", type: "paragraph" }],
        content: "console.log('once')",
        id: "code",
        type: "codeBlock",
      },
      { content: "Target", id: "target", type: "paragraph" },
      { content: "Last", id: "last", type: "paragraph" },
    ],
    resolveUrl: async () => ({ items: [] }),
  });
  const values = new Map<string, string>();
  const transfer = {
    getData: (type: string) => values.get(type) ?? "",
    setData: (type: string, value: string) => values.set(type, value),
  } as unknown as DataTransfer;
  const select = (id: string) =>
    editor.view.dispatch(
      editor.state.tr.setSelection(
        NodeSelection.create(
          editor.state.doc,
          blockAt(editor.state.doc, id).pos,
        ),
      ),
    );
  select("code");
  beginNativeBlockDrag(editor, transfer);
  const drop = (pos: number, copy = false, y = 0) => {
    vi.spyOn(editor.view, "posAtCoords").mockReturnValue({ inside: -1, pos });
    const event = new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientY: y,
      ...(isMacOS() ? { altKey: copy } : { ctrlKey: copy }),
    });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
    editor.view.dom.dispatchEvent(event);
    return event;
  };
  return {
    blocks: () => fromTiptapDocument(editor.state.doc),
    cleanup: () => {
      editor.destroy();
      element.remove();
      vi.restoreAllMocks();
    },
    drop,
    editor,
    select,
    transfer,
  };
}

test("native code moves once with its children after dragging state and live selection are lost; undo is atomic", () => {
  const f = fixture();
  try {
    f.editor.view.dragging = null;
    f.select("last");
    expect(f.drop(f.editor.state.doc.content.size).defaultPrevented).toBe(true);
    expect(f.blocks().map((b) => b.id)).toEqual(["target", "last", "code"]);
    expect(f.blocks()[2]?.children?.map((b) => b.id)).toEqual(["child"]);
    expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
    expect(f.blocks().map((b) => b.id)).toEqual(["code", "target", "last"]);
  } finally {
    f.cleanup();
  }
});

test("source bookmarks follow preceding document edits without deleting another block", () => {
  const f = fixture();
  try {
    const schema = f.editor.schema;
    const wrapper = schema.nodes.betterEditorBlock;
    const paragraph = schema.nodes.paragraph;
    if (!wrapper || !paragraph) throw new Error("Missing schema");
    f.editor.view.dispatch(
      f.editor.state.tr.insert(
        0,
        wrapper.create(
          { id: "before" },
          paragraph.create(null, schema.text("Before")),
        ),
      ),
    );
    const target = blockAt(f.editor.state.doc, "target");
    f.editor.view.dispatch(
      f.editor.state.tr.insertText("changed ", target.pos + 2),
    );
    f.select("target");
    f.drop(f.editor.state.doc.content.size);
    expect(f.blocks().map((b) => b.id)).toEqual([
      "before",
      "target",
      "last",
      "code",
    ]);
    expect(f.editor.state.doc.textContent).toContain("changed Target");
    expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
    expect(f.editor.state.doc.textContent).toContain("changed Target");
  } finally {
    f.cleanup();
  }
});

test("explicit native copies alone create fresh parent and descendant identities", () => {
  const f = fixture();
  try {
    f.drop(f.editor.state.doc.content.size, true);
    const blocks = f.blocks();
    expect(blocks).toHaveLength(4);
    expect(blocks[0]?.id).toBe("code");
    expect(blocks[3]?.id).not.toBe("code");
    expect(blocks[3]?.children?.[0]?.id).not.toBe("child");
    expect(blocks[3]?.content).toEqual(blocks[0]?.content);
  } finally {
    f.cleanup();
  }
});

for (const reason of [
  "self",
  "removed",
  "ended",
  "stale-token",
  "read-only",
] as const) {
  test(`owned ${reason} drop cannot fall through into clipboard duplication`, () => {
    const f = fixture();
    try {
      if (reason === "read-only") f.editor.setEditable(false);
      else if (reason === "removed") {
        const code = blockAt(f.editor.state.doc, "code");
        f.editor.view.dispatch(
          f.editor.state.tr.delete(code.pos, code.pos + code.node.nodeSize),
        );
      } else if (reason === "ended")
        document.dispatchEvent(new Event("dragend"));
      else if (reason === "stale-token") {
        const payload = JSON.parse(f.transfer.getData(BLOCK_DRAG_MIME));
        f.transfer.setData(
          BLOCK_DRAG_MIME,
          JSON.stringify({ ...payload, token: "stale" }),
        );
      }
      const before = f.editor.state.doc.toJSON();
      f.editor.view.dragging = null;
      f.drop(reason === "self" ? 3 : f.editor.state.doc.content.size);
      expect(f.editor.state.doc.toJSON()).toEqual(before);
    } finally {
      f.cleanup();
    }
  });
}

test("selection-only changes during a gesture do not change the captured source", () => {
  const f = fixture();
  try {
    f.editor.view.dispatch(
      f.editor.state.tr.setSelection(
        TextSelection.create(
          f.editor.state.doc,
          blockAt(f.editor.state.doc, "target").pos + 3,
        ),
      ),
    );
    f.drop(f.editor.state.doc.content.size);
    expect(f.blocks().map((b) => b.id)).toEqual(["target", "last", "code"]);
  } finally {
    f.cleanup();
  }
});

test("selected sibling ranges move together and keep their descendants", async () => {
  const { NodeRangeSelection } = await import("@tiptap/extension-node-range");
  const f = fixture();
  try {
    const last = blockAt(f.editor.state.doc, "last");
    f.editor.view.dispatch(
      f.editor.state.tr.setSelection(
        NodeRangeSelection.create(f.editor.state.doc, 0, last.pos, 0),
      ),
    );
    beginNativeBlockDrag(f.editor, f.transfer);
    f.select("last");
    f.drop(f.editor.state.doc.content.size);
    expect(f.blocks().map((b) => b.id)).toEqual(["last", "code", "target"]);
    expect(f.blocks()[1]?.children?.map((b) => b.id)).toEqual(["child"]);
  } finally {
    f.cleanup();
  }
});

test("block drops use row geometry rather than a caret near the end of its text", () => {
  const f = fixture();
  try {
    f.drop(f.editor.state.doc.content.size);
    f.select("code");
    beginNativeBlockDrag(f.editor, f.transfer);
    const target = blockAt(f.editor.state.doc, "target");
    const dom = f.editor.view.nodeDOM(target.pos);
    if (!(dom instanceof HTMLElement)) throw new Error("Missing target row");
    const body = dom.querySelector("[data-better-editor-body]");
    if (!body) throw new Error("Missing target body");
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 100, 200, 30),
    );
    // The pointer is above this row, even though horizontal hit testing finds
    // a caret in the latter half of its text. Move before, not after, the row.
    f.drop(target.pos + 6);
    expect(f.blocks().map((b) => b.id)).toEqual(["code", "target", "last"]);
  } finally {
    f.cleanup();
  }
});

for (const unavailable of ["read-only", "missing-controller"] as const) {
  test(`native start is rejected when ${unavailable}`, () => {
    const f = fixture();
    try {
      if (unavailable === "read-only") f.editor.setEditable(false);
      else f.editor.unregisterPlugin("better-editor-native-block-drag");
      f.transfer.setData(BLOCK_DRAG_MIME, "");
      expect(beginNativeBlockDrag(f.editor, f.transfer)).toBe(false);
      expect(f.transfer.getData(BLOCK_DRAG_MIME)).toBe("");
    } finally {
      f.cleanup();
    }
  });
}
