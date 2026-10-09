import { createExtension } from "@blocknote/core";
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Decorate reference blocks and inline atoms fully contained in native selections. */
export const ReferenceSelectionExtension = createExtension(() => ({
  key: "referenceSelection",
  prosemirrorPlugins: [
    new Plugin({
      appendTransaction(transactions, _previous, state) {
        if (!transactions.some((transaction) => transaction.selectionSet))
          return null;
        const { selection, doc } = state;
        if (
          !(selection instanceof TextSelection) ||
          selection.to - selection.from !== 1
        )
          return null;
        const node = doc.nodeAt(selection.from);
        if (node?.type.name !== "contentReference") return null;
        // The native toolbar hides text selections without text. An exact atom
        // selection is a node selection, which retains the native toolbar/actions.
        return state.tr.setSelection(NodeSelection.create(doc, selection.from));
      },
      props: {
        decorations({ doc, selection }) {
          if (selection.empty) return DecorationSet.empty;
          const decorations: Decoration[] = [];
          doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (
              (node.type.name === "referenceCard" ||
                node.type.name === "contentEmbed" ||
                node.type.name === "contentReference") &&
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
