// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { expect, test } from "vitest";
import {
  codeLanguages,
  documentExtensions,
  fromTiptapDocument,
  setBlockProperties,
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
    expect(codeLanguages.length).toBeGreaterThan(100);
    expect(editor.view.dom.querySelector(".hljs-keyword")).toBeNull();
    const language = setBlockProperties(editor.state, {
      language: "javascript",
    });
    if (!language) throw new Error("Missing code block");
    editor.view.dispatch(language);
    expect(editor.view.dom.querySelector(".hljs-keyword")?.textContent).toBe(
      "const",
    );
    expect(fromTiptapDocument(editor.state.doc)[0]).toMatchObject({
      content: "const foo = 'bar';",
      id: "code",
      props: { language: "javascript" },
    });
    const plain = setBlockProperties(editor.state, { language: "text" });
    if (plain) editor.view.dispatch(plain);
    expect(editor.view.dom.querySelector(".hljs-keyword")).toBeNull();
  } finally {
    editor.destroy();
  }
});
