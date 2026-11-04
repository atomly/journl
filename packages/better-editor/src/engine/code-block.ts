import { Extension } from "@tiptap/core";
import { createLowlight, type LanguageFn } from "lowlight";
import { createHighlightPlugin } from "prosemirror-highlight";
import { createParser } from "prosemirror-highlight/lowlight";

/** Consumers choose grammars; importing this factory does not register any. */
export function createSyntaxHighlighting(grammars: Record<string, LanguageFn>) {
  const lowlight = createLowlight(grammars);
  const highlight = createParser(lowlight);
  return {
    extension: Extension.create({
      addProseMirrorPlugins: () => [
        createHighlightPlugin({
          languageExtractor: (node) => node.attrs.props?.language ?? "auto",
          nodeTypes: ["codeBlock"],
          parser: (options) =>
            options.language === "auto"
              ? highlight({ ...options, language: undefined })
              : options.language && lowlight.registered(options.language)
                ? highlight(options)
                : [],
        }),
      ],
      name: "better-editor-syntax-highlight",
    }),
    languages: lowlight.listLanguages().sort(),
  };
}
