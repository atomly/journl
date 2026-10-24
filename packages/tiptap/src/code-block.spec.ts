// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { expect, test } from "vitest";
import {
  documentExtensions,
  fromTiptapDocument,
  toTiptapDocument,
} from "./index";

test("code language selection highlights through Lowlight and stays out of stored text", () => {
  const editor = new Editor({
    content: toTiptapDocument([
      {
        content: "const foo = 'bar';",
        id: "code",
        props: { language: "text" },
        type: "codeBlock",
      },
    ]).toJSON(),
    element: document.createElement("div"),
    extensions: documentExtensions(),
  });
  try {
    const select = editor.view.dom.querySelector("select");
    if (!select) throw new Error("Missing language picker");
    expect(select.options.length).toBeGreaterThan(100);
    expect(editor.view.dom.querySelector(".hljs-keyword")).toBeNull();
    select.value = "javascript";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.view.dom.querySelector(".hljs-keyword")?.textContent).toBe(
      "const",
    );
    expect(fromTiptapDocument(editor.state.doc)[0]).toMatchObject({
      content: "const foo = 'bar';",
      id: "code",
      props: { language: "javascript" },
    });
    select.value = "text";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.view.dom.querySelector(".hljs-keyword")).toBeNull();
  } finally {
    editor.destroy();
  }
});
