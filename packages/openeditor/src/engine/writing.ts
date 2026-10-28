import { type DocumentBlock, parseBlock } from "@acme/document";
import {
  type EditorState,
  NodeSelection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import {
  editBlocks,
  selectedBlock,
  selectedBlocks,
  setTextMark,
} from "./commands";
import type { IdFactory } from "./identity";
import { restoreBlockSelection } from "./selection";

const inlineTypes = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
]);
const textProperties = new Set([
  "textColor",
  "backgroundColor",
  "textAlignment",
]);

/** Changes only a block's body. The wrapper, children, and authored targets survive. */
export function turnInto(
  transaction: Transaction,
  id: string,
  type: DocumentBlock["type"],
  properties: Record<string, unknown> = {},
): Transaction | null {
  let target:
    | { pos: number; node: import("@tiptap/pm/model").Node }
    | undefined;
  transaction.doc.descendants((node, pos) => {
    if (node.type.name === "journlBlock" && node.attrs.id === id) {
      target = { node, pos };
      return false;
    }
  });
  if (!target?.node.firstChild) return null;
  const { pos, node } = target;
  const body = node.firstChild;
  if (!body) return null;
  const [source] = fromTiptapDocument(transaction.doc.type.create(null, node));
  if (!source || (!body.isTextblock && body.type.name !== type)) return null;
  let reference = false;
  body.descendants((node) => {
    if (node.type.name === "contentReference") reference = true;
  });
  if (type === "codeBlock" && reference) return null;
  const props = Object.fromEntries(
    Object.entries(source.props ?? {}).filter(
      ([key]) =>
        textProperties.has(key) &&
        (type !== "quote" || key !== "textAlignment"),
    ),
  );
  const ordinary = inlineTypes.has(type);
  const content = ordinary
    ? source.content
    : type === "codeBlock"
      ? body.textContent
      : type === "table"
        ? {
            rows: Array.from({ length: 3 }, () => ({ cells: ["", "", ""] })),
            type: "tableContent",
          }
        : undefined;
  if (!ordinary && type !== "codeBlock" && body.content.size) return null;
  const candidate = parseBlock({
    id,
    type,
    ...(content !== undefined ? { content } : {}),
    props:
      type === source.type
        ? { ...source.props, ...properties }
        : ordinary
          ? {
              ...props,
              ...(type === "heading" ? { level: 2 } : {}),
              ...properties,
            }
          : properties,
  });
  const replacement = toTiptapDocument([candidate], transaction.doc.type.schema)
    .firstChild?.firstChild;
  if (!replacement) return null;
  const offset = transaction.selection.$from.parentOffset;
  transaction.replaceWith(pos + 1, pos + 1 + body.nodeSize, replacement);
  transaction.setSelection(
    replacement.isTextblock || replacement.type.name === "table"
      ? TextSelection.near(
          transaction.doc.resolve(
            pos +
              2 +
              (replacement.isTextblock
                ? Math.min(offset, replacement.content.size)
                : 0),
          ),
        )
      : NodeSelection.create(transaction.doc, pos),
  );
  return transaction;
}

export function changeBlockType(
  state: EditorState,
  type: DocumentBlock["type"],
  properties?: Record<string, unknown>,
) {
  const targets = selectedBlocks(state);
  if (!targets.length) return null;
  const bookmark = state.selection.getBookmark();
  const tr = state.tr;
  const first = targets[0];
  const preceding =
    first && first.index > 0
      ? first.siblings.child(first.index - 1).firstChild
      : null;
  const start = Number(
    properties?.start ??
      (preceding?.type.name === "numberedListItem"
        ? Number(preceding.attrs.props?.start ?? 1) + 1
        : 1),
  );
  // Work backwards so each body is replaced at its original position. Do not
  // dispatch a partial conversion when any selected block is incompatible.
  for (let index = targets.length - 1; index >= 0; index--) {
    const target = targets[index];
    if (
      !target ||
      !turnInto(
        tr,
        target.id,
        type,
        type === "numberedListItem"
          ? { ...properties, start: start + index }
          : properties,
      )
    )
      return null;
  }
  if (targets.length > 1 && !restoreBlockSelection(state, tr))
    tr.setSelection(bookmark.map(tr.mapping).resolve(tr.doc));
  return tr;
}

export function setBlockProperties(
  state: EditorState,
  properties: Record<string, unknown>,
) {
  const target = selectedBlock(state);
  const body = target?.node.firstChild;
  if (!target || !body) return null;
  const [source] = fromTiptapDocument(state.doc.type.create(null, target.node));
  if (!source) return null;
  const updated = parseBlock({
    ...source,
    props: { ...source.props, ...properties },
  });
  return state.tr.setNodeMarkup(target.pos + 1, undefined, {
    ...body.attrs,
    props: updated.props ?? null,
  });
}

/** Apply a color only to text; reference atoms have no domain text styles. */
export function setTextColor(
  state: EditorState,
  name: "textColor" | "backgroundColor",
  value: string,
) {
  return setTextMark(state, name, value === "default" ? null : { value });
}

export function moveSelectedBlock(state: EditorState, direction: -1 | 1) {
  const target = selectedBlock(state);
  if (
    !target ||
    target.index + direction < 0 ||
    target.index + direction >= target.siblings.childCount
  )
    return null;
  const after =
    direction === 1
      ? target.siblings.child(target.index + 1).attrs.id
      : target.index > 1
        ? target.siblings.child(target.index - 2).attrs.id
        : null;
  return editBlocks(
    state.tr,
    [
      {
        afterId: after,
        id: target.id,
        parentId: target.parentId,
        type: "move",
      },
    ],
    target.id,
  );
}

export function removeSelectedBlock(state: EditorState, createId: IdFactory) {
  const target = selectedBlock(state);
  if (!target) return null;
  const tr = editBlocks(state.tr, [{ id: target.id, type: "remove" }]);
  if (!tr.doc.childCount)
    tr.insert(
      0,
      toTiptapDocument([{ id: createId(), type: "paragraph" }], state.schema)
        .content,
    );
  tr.setSelection(
    TextSelection.near(
      tr.doc.resolve(Math.min(target.pos + 2, tr.doc.content.size)),
    ),
  );
  return tr;
}
