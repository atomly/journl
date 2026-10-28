import { Extension } from "@tiptap/core";
import { all, createLowlight } from "lowlight";
import { createHighlightPlugin } from "prosemirror-highlight";
import { createParser } from "prosemirror-highlight/lowlight";

const lowlight = createLowlight(all);
const highlight = createParser(lowlight);
export const codeLanguages = lowlight.listLanguages().sort();

/** Highlighting is transient ProseMirror decoration state, never stored content. */
export const codeHighlightPlugin = () =>
  createHighlightPlugin({
    languageExtractor: (node) => node.attrs.props?.language ?? "auto",
    nodeTypes: ["codeBlock"],
    parser: (options) =>
      options.language === "auto"
        ? highlight({ ...options, language: undefined })
        : options.language && lowlight.registered(options.language)
          ? highlight(options)
          : [],
  });

export const syntaxHighlightExtension = Extension.create({
  addProseMirrorPlugins: () => [codeHighlightPlugin()],
  name: "better-editor-syntax-highlight",
});
