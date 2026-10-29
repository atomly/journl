// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { documentExtensions } from "../engine/schema";
import { toTiptapDocument } from "../serialization/tiptap";
import { useEditorEditable } from "./use-editor-editable";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
test("independent editability subscriptions observe destruction and editor replacement", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const create = () =>
    new Editor({
      content: toTiptapDocument([{ id: "p", type: "paragraph" }]).toJSON(),
      element: document.createElement("div"),
      extensions: documentExtensions(),
    });
  const first = create();
  const second = create();
  function Status({ editor }: { editor: Editor }) {
    return (
      <output>{useEditorEditable(editor) ? "editable" : "readonly"}</output>
    );
  }
  try {
    await act(async () => root.render(<Status editor={first} />));
    expect(host.textContent).toBe("editable");
    await act(async () => first.destroy());
    expect(host.textContent).toBe("readonly");
    await act(async () => root.render(<Status editor={second} />));
    expect(host.textContent).toBe("editable");
    await act(async () => second.setEditable(false));
    expect(host.textContent).toBe("readonly");
    await act(async () => second.setEditable(true));
    expect(host.textContent).toBe("editable");
  } finally {
    await act(async () => root.unmount());
    first.destroy();
    second.destroy();
    host.remove();
  }
});
