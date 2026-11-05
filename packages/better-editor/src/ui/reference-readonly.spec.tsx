// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { createDocumentEditor } from "../engine/editor";
import { referenceExtensions } from "../engine/reference-schema";
import { ReferenceSurface } from "./node-views";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
test("reference actions and surfaces follow readonly changes and destruction", async () => {
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
  const node = editor.state.doc.firstChild?.firstChild;
  if (!node) throw new Error("Missing reference");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ReferenceSurface
          view={{
            dom: document.createElement("div"),
            editor,
            getPos: () => 1,
            key: 0,
            node,
          }}
          renderActions={() => <button type="button">Actions</button>}
        />,
      ),
    );
    expect(host.textContent).toContain("Actions");
    await act(async () => editor.setEditable(false));
    expect(host.textContent).not.toContain("Actions");
    expect(host.querySelector('[data-block-surface="true"]')).toBeNull();
    await act(async () => editor.setEditable(true));
    expect(host.textContent).toContain("Actions");
    await act(async () => editor.destroy());
    expect(host.textContent).not.toContain("Actions");
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    host.remove();
  }
});
