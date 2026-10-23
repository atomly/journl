// @vitest-environment jsdom
import { parseBlock } from "@acme/document";
import { Editor } from "@tiptap/core";
import { expect, test } from "vitest";
import { clipboardText, documentExtensions, toTiptapDocument } from "./index";

test("plain clipboard keeps list markers, nesting and partial text without unselected content", () => {
  const doc = toTiptapDocument([
    parseBlock({
      children: [{ content: "Nested", id: "b", type: "numberedListItem" }],
      content: "First",
      id: "a",
      type: "bulletListItem",
    }),
    parseBlock({ content: "Outside", id: "c", type: "paragraph" }),
  ]);
  const first = doc.firstChild;
  if (!first) throw new Error("Missing fixture");
  expect(clipboardText(doc.slice(0, first.nodeSize).content)).toContain(
    "- First\n    1. Nested",
  );
  expect(clipboardText(doc.slice(2, 5).content)).toBe("Fir");
});

test("highlighting decorates code and leaves unsupported languages and storage content intact", () => {
  for (const language of ["javascript", "unknown-language"]) {
    const editor = new Editor({
      content: toTiptapDocument([
        parseBlock({
          content: "const value = 42;",
          id: "code",
          props: { language },
          type: "codeBlock",
        }),
      ]).toJSON(),
      element: document.createElement("div"),
      extensions: documentExtensions(),
    });
    expect(editor.view.dom.querySelector("pre")?.textContent).toBe(
      "const value = 42;",
    );
    if (language === "javascript")
      expect(editor.view.dom.querySelector(".hljs-keyword")).not.toBeNull();
    editor.destroy();
  }
});
