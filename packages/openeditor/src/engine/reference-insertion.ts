import type { ReferenceProps } from "@acme/document";
import type { ReferenceClient } from "@acme/references";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { selectedBlock } from "./commands";
import { convertReference } from "./references";

type Resolve = ReferenceClient["resolveUrl"];

/** Resolution follows a token, never a stale ProseMirror position or DOM wrapper. */
export function insertTiptapReference(
  view: EditorView,
  url: string,
  resolve: Resolve,
  label = "",
  display?: "contentReference" | "referenceCard",
) {
  if (!view.editable) return false;
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    return false;
  }
  if (
    !/^https?:$/.test(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.href.length > 2048
  )
    return false;
  const type = view.state.schema.nodes.contentReference;
  const target = selectedBlock(view.state);
  if (
    !type ||
    !target ||
    view.state.selection.$from.parent.type.name === "codeBlock"
  )
    return false;
  const token = crypto.randomUUID();
  const props: ReferenceProps = {
    blockId: "",
    documentId: "",
    label,
    resolutionToken: token,
    targetKind: "external",
    url: parsed.href,
    version: 1,
  };
  const body = target.node.firstChild;
  if (body?.type.name === "table" && display === "referenceCard") return false;
  const rootCard =
    display !== "contentReference" &&
    body?.type.name === "paragraph" &&
    !body.content.size &&
    target.parentId === null;
  const original = view.state.doc.slice(
    view.state.selection.from,
    view.state.selection.to,
  ).content;
  const transaction = view.state.tr;
  if (rootCard) {
    const card = view.state.schema.nodes.referenceCard;
    const paragraph = view.state.schema.nodes.paragraph;
    const wrapper = view.state.schema.nodes.openeditorBlock;
    if (!card || !paragraph || !wrapper || !body) return false;
    transaction.replaceWith(
      target.pos + 1,
      target.pos + 1 + body.nodeSize,
      card.create({ props }),
    );
    const changed = transaction.doc.nodeAt(target.pos);
    if (!changed) return false;
    const nextPos = target.pos + changed.nodeSize;
    transaction.insert(
      nextPos,
      wrapper.createChecked({ id: crypto.randomUUID() }, paragraph.create()),
    );
    transaction.setSelection(
      TextSelection.create(transaction.doc, nextPos + 2),
    );
  } else {
    const from = transaction.selection.from;
    transaction.replaceSelectionWith(type.create({ props }));
    if (display === "referenceCard")
      transaction.setSelection(NodeSelection.create(transaction.doc, from));
  }
  view.dispatch(transaction);
  if (!rootCard && display === "referenceCard") {
    const conversion = convertReference(view.state, display, () =>
      crypto.randomUUID(),
    );
    if (conversion) {
      view.dispatch(conversion);
      const current = selectedBlock(view.state);
      if (current) {
        const end = current.pos + current.node.nodeSize;
        view.dispatch(
          view.state.tr.setSelection(
            TextSelection.near(view.state.doc.resolve(end), 1),
          ),
        );
      }
    }
  }
  const settle = (resolved?: Partial<ReferenceProps>, failed = false) => {
    if (view.isDestroyed) return;
    let found:
      | { pos: number; node: ReturnType<typeof view.state.doc.nodeAt> }
      | undefined;
    view.state.doc.descendants((node, pos) => {
      if (
        node.attrs.props?.resolutionToken === token &&
        node.attrs.props?.url === parsed.href
      )
        found = { node, pos };
    });
    if (!found?.node) return;
    const { node, pos } = found;
    const tr = view.state.tr;
    if (failed) {
      const text = view.state.schema.text(parsed.href);
      const replacement = node.isInline
        ? text
        : view.state.schema.nodes.paragraph?.createChecked(null, text);
      if (!replacement) return;
      tr.replaceWith(
        pos,
        pos + node.nodeSize,
        label && node.isInline && original.size ? original : replacement,
      );
    } else
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        props: { ...node.attrs.props, ...resolved, resolutionToken: "" },
      });
    view.dispatch(tr.setMeta("addToHistory", false));
  };
  const resolverUrl =
    parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.href;
  void resolve(resolverUrl)
    .then(({ items }) => {
      const result = items[0];
      const target = result?.target;
      settle(
        !target
          ? { label: label || parsed.hostname }
          : target.kind === "document"
            ? {
                blockId: target.blockId ?? "",
                documentId: target.documentId,
                targetKind: "document",
                url:
                  result?.preview.status === "ready"
                    ? (result.preview.href ?? parsed.href)
                    : parsed.href,
              }
            : { targetKind: "external", url: target.url },
      );
    })
    .catch(() => settle(undefined, true));
  return true;
}
