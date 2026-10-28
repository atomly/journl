// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { documentExtensions } from "../engine/schema";
import { toTiptapDocument } from "../serialization/tiptap";
import { useHandleVisibility } from "./handle-visibility";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("pointer focus can enter editor controls without unmounting the pending click target", async () => {
  const surface = document.createElement("div");
  const host = document.createElement("div");
  const outside = document.createElement("button");
  document.body.append(surface, host, outside);
  const editor = new Editor({
    content: toTiptapDocument([{ id: "text", type: "paragraph" }]).toJSON(),
    element: surface,
    extensions: documentExtensions(),
  });
  const root = createRoot(host);
  function Handles() {
    const visible = useHandleVisibility(editor);
    return visible ? (
      <div data-tiptap-controls="">
        <button type="button">Row actions</button>
      </div>
    ) : null;
  }
  try {
    await act(async () => root.render(<Handles />));
    await act(async () => editor.view.focus());
    const handle = host.querySelector("button");
    await act(async () => handle?.focus());
    expect(document.activeElement).toBe(handle);
    expect(handle?.isConnected).toBe(true);
    await act(async () => editor.view.focus());
    await act(async () => outside.focus());
    expect(host.querySelector("button")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    surface.remove();
    host.remove();
    outside.remove();
  }
});
