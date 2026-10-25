import type { ReferenceProps } from "@acme/document";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { selectedBlock } from "./commands";
import type { IdFactory } from "./identity";
import { required } from "./required";

/** Capture before a toolbar or asynchronous resolver changes the selection. */
export function captureLink(state: EditorState) {
  const { selection } = state;
  if (selection.empty || !selection.$from.sameParent(selection.$to))
    return null;
  let href: string | undefined;
  let valid = true;
  state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (!node.isInline) return;
    const link = node.marks.find((mark) => mark.type.name === "link");
    if (!node.isText || !link || (href && href !== link.attrs.href))
      valid = false;
    else href = link.attrs.href;
  });
  return valid && href
    ? {
        doc: state.doc,
        from: selection.from,
        href,
        label: state.doc.textBetween(selection.from, selection.to),
        to: selection.to,
      }
    : null;
}

/** Convert one selected reference without dropping surrounding text or children. */
export function convertReference(
  state: EditorState,
  display: "contentReference" | "referenceCard" | "contentEmbed" | "link",
  createId: IdFactory,
) {
  const selected = state.doc.nodeAt(state.selection.from);
  const target = selectedBlock(state);
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
      return transaction.replaceWith(
        state.selection.from,
        state.selection.from + selected.nodeSize,
        inline,
      );
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
    return transaction.setNodeMarkup(
      state.selection.from,
      required(schema.nodes[display]),
      { props },
    );
  const offset = state.selection.from - target.pos - 2;
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
  const cardPos =
    target.pos +
    (nodes.length && before.size ? required(nodes[0]).nodeSize : 0) +
    1;
  return transaction.setSelection(
    NodeSelection.create(transaction.doc, cardPos),
  );
}
