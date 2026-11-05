import { NodeRangeSelection } from "@tiptap/extension-node-range";
import {
  type EditorState,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { blockAt } from "./identity";

/** Replacing a body or the document cannot map text offsets through deleted
 * positions. Anchor each endpoint to the stable block that owns its text. */
export function restoreBlockSelection(before: EditorState, tr: Transaction) {
  if (before.selection instanceof NodeRangeSelection) {
    const first = before.doc.nodeAt(before.selection.from);
    const last = before.doc.resolve(before.selection.to).nodeBefore;
    if (
      first?.type.name !== "betterEditorBlock" ||
      last?.type.name !== "betterEditorBlock"
    )
      return false;
    const a = blockAt(tr.doc, first.attrs.id).pos;
    const end = blockAt(tr.doc, last.attrs.id);
    const h = end.pos + end.node.nodeSize;
    const backward = before.selection.anchor > before.selection.head;
    tr.setSelection(
      NodeRangeSelection.create(
        tr.doc,
        backward ? h : a,
        backward ? a : h,
        tr.doc.resolve(a).depth,
      ),
    );
    return true;
  }
  if (!(before.selection instanceof TextSelection)) return false;
  const point = (pos: number) => {
    const $pos = before.doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth--)
      if ($pos.node(depth).type.name === "betterEditorBlock")
        return {
          id: $pos.node(depth).attrs.id as string,
          offset: pos - $pos.before(depth),
        };
    return null;
  };
  const anchor = point(before.selection.anchor);
  const head = point(before.selection.head);
  if (!anchor || !head) return false;
  const a = blockAt(tr.doc, anchor.id).pos + anchor.offset;
  const h = blockAt(tr.doc, head.id).pos + head.offset;
  if (
    !tr.doc.resolve(a).parent.isTextblock ||
    !tr.doc.resolve(h).parent.isTextblock
  )
    return false;
  tr.setSelection(TextSelection.create(tr.doc, a, h));
  return true;
}
