import {
  getNodeRangeDecorations,
  NodeRangeSelection,
} from "@tiptap/extension-node-range";
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Shared by both frontends; depends only on semantic node names and selections. */
export function referenceSelectionPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _previous, state) {
      if (!transactions.some((transaction) => transaction.selectionSet))
        return null;
      const { selection, doc } = state;
      if (
        !(selection instanceof TextSelection) ||
        selection.to - selection.from !== 1
      )
        return null;
      if (doc.nodeAt(selection.from)?.type.name !== "contentReference")
        return null;
      return state.tr.setSelection(NodeSelection.create(doc, selection.from));
    },
    props: {
      decorations({ doc, selection }) {
        if (selection.empty) return DecorationSet.empty;
        const decorations: Decoration[] =
          selection instanceof NodeRangeSelection
            ? getNodeRangeDecorations([...selection.ranges]).find()
            : [];
        doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (
            ["referenceCard", "contentEmbed", "contentReference"].includes(
              node.type.name,
            ) &&
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
      handleDOMEvents: {
        keydown(view, event) {
          // A handled DOM event does not cancel browser focus traversal.
          return (
            event.key === "Tab" &&
            event.target instanceof Element &&
            event.target !== view.dom &&
            Boolean(
              event.target.closest(
                "button, input, select, textarea, a[href], [role='button']",
              ),
            )
          );
        },
      },
    },
  });
}
