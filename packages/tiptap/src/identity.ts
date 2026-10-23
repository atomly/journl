import { Extension } from "@tiptap/core";
import { Fragment, type Node, Slice } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import { required } from "./required";

export type IdFactory = () => string;

export function blockAt(doc: Node, id: string): { node: Node; pos: number } {
  let result: { node: Node; pos: number } | undefined;
  doc.descendants((node, pos) => {
    if (node.type.name === "journlBlock" && node.attrs.id === id)
      result = { node, pos };
  });
  if (!result) throw new Error(`Block not found: ${id}`);
  return result;
}

/** Copies get fresh block IDs recursively; authored reference targets stay intact. */
export function copySlice(slice: Slice, createId: IdFactory): Slice {
  const used = new Set<string>();
  slice.content.descendants((node) => {
    if (node.type.name === "journlBlock") used.add(node.attrs.id);
  });
  const freshId = () => {
    const id = createId();
    if (!id || used.has(id))
      throw new Error("ID factory must return fresh nonempty IDs");
    used.add(id);
    return id;
  };
  const copy = (node: Node): Node => {
    const children: Node[] = [];
    node.forEach((child) => {
      children.push(copy(child));
    });
    return node.isText
      ? node
      : node.type.create(
          {
            ...node.attrs,
            ...(node.type.name === "journlBlock" ? { id: freshId() } : {}),
          },
          children,
          node.marks,
        );
  };
  const children: Node[] = [];
  slice.content.forEach((node) => {
    children.push(copy(node));
  });
  return new Slice(
    Fragment.fromArray(children),
    slice.openStart,
    slice.openEnd,
  );
}

export function identityPlugin(createId: IdFactory): Plugin {
  return new Plugin({
    appendTransaction(transactions, oldState, state) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const preferred = new Map<string, number>();
      oldState.doc.descendants((node, start) => {
        if (node.type.name !== "journlBlock" || !node.attrs.id) return;
        let pos = start;
        let deleted = false;
        for (const transaction of transactions) {
          const mapped = transaction.mapping.mapResult(pos, 1);
          pos = mapped.pos;
          deleted ||= mapped.deleted;
        }
        if (!deleted) preferred.set(node.attrs.id, pos);
      });
      const occurrences = new Map<string, number[]>();
      state.doc.descendants((node, pos) => {
        if (node.type.name !== "journlBlock") return;
        const items = occurrences.get(node.attrs.id) ?? [];
        items.push(pos);
        occurrences.set(node.attrs.id, items);
      });
      const used = new Set(occurrences.keys());
      const transaction = state.tr;
      for (const [id, positions] of occurrences) {
        const preserve = positions.includes(preferred.get(id) ?? -1)
          ? preferred.get(id)
          : positions[0];
        for (const pos of positions) {
          if (typeof id === "string" && id.length && pos === preserve) continue;
          const next = createId();
          if (!next || used.has(next))
            throw new Error("ID factory must return fresh nonempty IDs");
          used.add(next);
          const node = required(transaction.doc.nodeAt(pos));
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id: next,
          });
        }
      }
      return transaction.docChanged ? transaction : null;
    },
    props: {
      handleDOMEvents: {
        dragstart(view, event) {
          if (
            !(event.target instanceof Element) ||
            event.target.closest("a[href]")
          )
            return false;
          const body = event.target.closest("[data-journl-body]");
          if (
            !body ||
            ![
              "referenceCard",
              "contentEmbed",
              "image",
              "video",
              "audio",
              "file",
              "divider",
            ].includes(body.getAttribute("data-journl-body") ?? "")
          )
            return false;
          const wrapper = body.closest<HTMLElement>("[data-block-id]");
          if (!wrapper?.dataset.blockId) return false;
          const target = blockAt(view.state.doc, wrapper.dataset.blockId);
          view.dispatch(
            view.state.tr.setSelection(
              NodeSelection.create(view.state.doc, target.pos),
            ),
          );
          return false;
        },
      },
      handleDrop(view, event, slice, moved) {
        if (moved) return false; // Native move deletes/reinserts the same identities.
        const target = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (!target) return false;
        const copy = copySlice(slice, createId);
        const pos = dropPoint(view.state.doc, target.pos, copy) ?? target.pos;
        const transaction = view.state.tr.replaceRange(pos, pos, copy);
        transaction.setSelection(
          Selection.near(
            transaction.doc.resolve(transaction.mapping.map(pos, 1)),
          ),
        );
        view.dispatch(transaction.setMeta("uiEvent", "drop").scrollIntoView());
        return true;
      },
      handlePaste(view, _event, slice) {
        view.dispatch(
          view.state.tr
            .replaceSelection(copySlice(slice, createId))
            .setMeta("paste", true)
            .scrollIntoView(),
        );
        return true;
      },
    },
  });
}

/** Split keeps the original ID/children on the left and creates a right sibling. */
export function splitBlock(
  transaction: Transaction,
  id: string,
  offset: number,
  createId: IdFactory,
): Transaction {
  const { node, pos } = blockAt(transaction.doc, id);
  const body = required(node.firstChild);
  if (!body.isTextblock || offset < 0 || offset > body.content.size)
    throw new Error("Invalid block split");
  const freshId = createId();
  if (!freshId) throw new Error("ID factory must return fresh nonempty IDs");
  transaction.doc.descendants((candidate) => {
    if (candidate.type.name === "journlBlock" && candidate.attrs.id === freshId)
      throw new Error("ID factory must return fresh nonempty IDs");
  });
  const left = node.type.createChecked(node.attrs, [
    body.copy(body.content.cut(0, offset)),
    ...(node.childCount === 2 ? [node.child(1)] : []),
  ]);
  const right = node.type.createChecked(
    { id: freshId },
    body.copy(body.content.cut(offset)),
  );
  transaction.replaceWith(pos, pos + node.nodeSize, [left, right]);
  return transaction.setSelection(
    TextSelection.create(transaction.doc, pos + left.nodeSize + 2),
  );
}

/** Join adjacent text blocks. The first identity survives; child IDs retain order. */
export function joinBlocks(
  transaction: Transaction,
  leftId: string,
  rightId: string,
): Transaction {
  const left = blockAt(transaction.doc, leftId);
  const right = blockAt(transaction.doc, rightId);
  const a = required(left.node.firstChild);
  const b = required(right.node.firstChild);
  if (
    left.pos + left.node.nodeSize !== right.pos ||
    !a.isTextblock ||
    !b.isTextblock ||
    !a.type.validContent(a.content.append(b.content))
  )
    throw new Error("Blocks cannot be joined");
  const children = (
    left.node.childCount === 2 ? left.node.child(1).content : Fragment.empty
  ).append(
    right.node.childCount === 2 ? right.node.child(1).content : Fragment.empty,
  );
  const joined = left.node.type.createChecked(left.node.attrs, [
    a.copy(a.content.append(b.content)),
    ...(children.size
      ? [
          required(
            transaction.doc.type.schema.nodes.journlChildren,
          ).createChecked(null, children),
        ]
      : []),
  ]);
  transaction.replaceWith(left.pos, right.pos + right.node.nodeSize, joined);
  return transaction.setSelection(
    TextSelection.create(transaction.doc, left.pos + 2 + a.content.size),
  );
}

export function identityExtension(createId: IdFactory): Extension {
  return Extension.create({
    addProseMirrorPlugins: () => [identityPlugin(createId)],
    name: "journlIdentity",
  });
}
