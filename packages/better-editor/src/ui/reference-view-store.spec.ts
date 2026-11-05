// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { createDocumentEditor } from "../engine/editor";
import { blockAt } from "../engine/identity";
import { referenceExtensions } from "../engine/reference-schema";
import { required } from "../engine/required";
import { referenceViewStore } from "./reference-view-store";

test("updating one reference only notifies that reference and preserves membership", () => {
  const store = referenceViewStore();
  const initialBlocks = ["a", "b"].map((id) => ({
    id,
    props: {
      blockId: "",
      documentId: "source",
      label: id,
      resolutionToken: "",
      targetKind: "document" as const,
      url: "https://example.com",
      version: 1 as const,
    },
    type: "referenceCard" as const,
  }));
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [...referenceExtensions(), store.extension],
    initialBlocks,
    resolveUrl: async () => ({ items: [] }),
  });
  const keys = store.getSnapshot();
  expect(keys).toHaveLength(2);
  const membership = vi.fn();
  const a = vi.fn();
  const b = vi.fn();
  const off = [
    store.subscribe(membership),
    store.subscribeView(required(keys[0]), a),
    store.subscribeView(required(keys[1]), b),
  ];
  try {
    const pos = blockAt(editor.state.doc, "a").pos + 1;
    const node = required(editor.state.doc.nodeAt(pos));
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        props: { ...node.attrs.props, label: "Updated" },
      }),
    );
    expect(store.getSnapshot()).toBe(keys);
    expect(membership).not.toHaveBeenCalled();
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
    expect(store.getView(required(keys[0]))?.node.attrs.props.label).toBe(
      "Updated",
    );
    editor.view.dispatch(editor.state.tr.setMeta("unrelated", true));
    expect(a).toHaveBeenCalledOnce();
  } finally {
    for (const unsubscribe of off) unsubscribe();
    editor.destroy();
  }
  expect(store.getSnapshot()).toEqual([]);
});
