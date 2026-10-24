import type { ReferenceProps } from "@acme/document";
import { getMarkRange } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { selectedBlock } from "./commands";
import type { IdFactory } from "./identity";
import { blockAt } from "./identity";
import { required } from "./required";

/** A cell can contain inline forms; document embeds require owned document targets. */
export function referenceDisplayAllowed(
  display: "contentReference" | "referenceCard" | "contentEmbed" | "link",
  targetKind: string,
  inTable = false,
) {
  return (
    (display !== "contentEmbed" || targetKind === "document") &&
    (!inTable || display === "contentReference" || display === "link")
  );
}

/** Capture before a toolbar or asynchronous resolver changes the selection. */
export function captureLink(state: EditorState) {
  const { selection } = state;
  // A table selection has independent ranges, not one captured inline link.
  if (selection instanceof CellSelection) return null;
  const mark = state.schema.marks.link;
  const range =
    selection.empty && mark ? getMarkRange(selection.$from, mark) : null;
  const wrapper =
    selection instanceof NodeSelection
      ? state.doc.nodeAt(selection.from)
      : null;
  const wholeText =
    wrapper?.type.name === "journlBlock" && wrapper.firstChild?.isTextblock;
  if (wrapper?.type.name === "journlBlock" && !wholeText) return null;
  const from = wholeText ? selection.from + 2 : (range?.from ?? selection.from);
  const to = wholeText
    ? from + (wrapper?.firstChild?.content.size ?? 0)
    : (range?.to ?? selection.to);
  if (from === to || !selection.$from.sameParent(selection.$to)) return null;
  let href: string | undefined;
  let valid = true;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isInline) return;
    const link = node.marks.find((mark) => mark.type.name === "link");
    if (!node.isText || !link || (href && href !== link.attrs.href))
      valid = false;
    else href = link.attrs.href;
  });
  return valid && href
    ? {
        doc: state.doc,
        from,
        href,
        label: state.doc.textBetween(from, to),
        to,
      }
    : null;
}

/** Convert one selected reference without dropping surrounding text or children. */
export function convertReference(
  state: EditorState,
  display: "contentReference" | "referenceCard" | "contentEmbed" | "link",
  createId: IdFactory,
) {
  const target = selectedBlock(state);
  const at = state.doc.nodeAt(state.selection.from);
  const selected = at?.type.name === "journlBlock" ? at.firstChild : at;
  const from =
    at?.type.name === "journlBlock"
      ? state.selection.from + 1
      : state.selection.from;
  if (
    !selected ||
    !target ||
    !["contentReference", "referenceCard", "contentEmbed"].includes(
      selected.type.name,
    )
  )
    return null;
  const props = selected.attrs.props as ReferenceProps;
  const body = required(target.node.firstChild);
  if (
    !referenceDisplayAllowed(
      display,
      props.targetKind,
      body.type.name === "table",
    ) ||
    (display === "contentEmbed" && !props.documentId)
  )
    return null;
  const schema = state.schema;
  const transaction = state.tr;
  if (display === "contentReference" || display === "link") {
    const inline =
      display === "contentReference"
        ? required(schema.nodes.contentReference).create({ props })
        : schema.text(props.label || props.url || "Reference", [
            required(schema.marks.link).create({ href: props.url }),
          ]);
    if (selected.isInline)
      return transaction.replaceWith(from, from + selected.nodeSize, inline);
    const replacement = required(schema.nodes.paragraph).createChecked(
      null,
      inline,
    );
    return transaction.replaceWith(
      target.pos + 1,
      target.pos + 1 + body.nodeSize,
      replacement,
    );
  }
  if (!selected.isInline)
    return transaction.setNodeMarkup(from, required(schema.nodes[display]), {
      props,
    });
  const offset = from - target.pos - 2;
  const before = body.content.cut(0, offset);
  const after = body.content.cut(offset + selected.nodeSize);
  const wrapper = required(schema.nodes.journlBlock);
  const nodes = [
    ...(before.size
      ? [wrapper.createChecked({ id: createId() }, body.copy(before))]
      : []),
    wrapper.createChecked(target.node.attrs, [
      required(schema.nodes[display]).create({ props }),
      ...(target.node.childCount === 2 ? [target.node.child(1)] : []),
    ]),
    ...(after.size
      ? [wrapper.createChecked({ id: createId() }, body.copy(after))]
      : []),
  ];
  transaction.replaceWith(target.pos, target.pos + target.node.nodeSize, nodes);
  // A terminal reference needs a writable sibling, just like pasted URL cards.
  // Keep the reference selected so its display menu and selection cue still work.
  const converted = blockAt(transaction.doc, target.id);
  const boundary = transaction.doc.resolve(converted.pos);
  if (boundary.index() === boundary.parent.childCount - 1) {
    transaction.insert(
      converted.pos + converted.node.nodeSize,
      wrapper.createChecked(
        { id: createId() },
        required(schema.nodes.paragraph).create(),
      ),
    );
  }
  const cardPos =
    target.pos +
    (nodes.length && before.size ? required(nodes[0]).nodeSize : 0) +
    1;
  return transaction.setSelection(
    NodeSelection.create(transaction.doc, cardPos),
  );
}
