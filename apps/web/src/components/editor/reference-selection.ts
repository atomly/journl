import { createExtension } from "@blocknote/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Native text/range selections do not decorate noneditable reference blocks. */
export const ReferenceSelectionExtension = createExtension(() => ({
  key: "referenceSelection",
  prosemirrorPlugins: [
    new Plugin({
      props: {
        decorations({ doc, selection }) {
          if (selection.empty) return DecorationSet.empty;
          const decorations: Decoration[] = [];
          doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (
              (node.type.name === "referenceCard" ||
                node.type.name === "contentEmbed") &&
              pos >= selection.from &&
              pos + node.nodeSize <= selection.to
            ) {
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  "data-reference-selected": "true",
                }),
              );
            }
          });
          return DecorationSet.create(doc, decorations);
        },
      },
    }),
  ],
}));
