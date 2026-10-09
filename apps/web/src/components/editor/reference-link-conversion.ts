import type {
  EditorPrimitive,
  ReferenceRenderAdapter,
} from "@acme/blocknote/schema";
import { getBlockInfoAtNearest } from "@blocknote/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { RouterOutputs } from "~/trpc";

export type CapturedReferenceLink = {
  blockId: string;
  doc: ProseMirrorNode;
  from: number;
  to: number;
  href: string;
  label: string;
  occurrenceIndex: number;
};

/** Capture the link before a portalled menu moves the editor's selection. */
export function captureReferenceLink(
  editor: EditorPrimitive,
): CapturedReferenceLink | null {
  const { state } = editor._tiptapEditor;
  const selection = state.selection;
  if (
    !editor.isEditable ||
    selection.empty ||
    !selection.$from.sameParent(selection.$to)
  )
    return null;
  const linkMark = state.schema.marks.link;
  let href: string | undefined;
  let allLinked = true;
  state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (!node.isInline) return;
    const mark = node.isText
      ? node.marks.find((candidate) => candidate.type === linkMark)
      : undefined;
    if (
      !mark ||
      typeof mark.attrs.href !== "string" ||
      (href && href !== mark.attrs.href)
    )
      allLinked = false;
    else href = mark.attrs.href;
  });
  const label = state.doc.textBetween(selection.from, selection.to, "", "");
  if (!allLinked || !href || !label.trim()) return null;
  const block = getBlockInfoAtNearest(state, selection.from);
  if (!block.isBlockContainer) return null;
  let occurrenceIndex = 0;
  selection.$from.parent.nodesBetween(
    0,
    selection.$from.parentOffset,
    (node) => {
      if (node.type.name === "contentReference") occurrenceIndex += 1;
    },
  );
  return {
    blockId: block.bnBlock.node.attrs.id,
    doc: state.doc,
    from: selection.from,
    href,
    label,
    occurrenceIndex,
    to: selection.to,
  };
}

export async function convertCapturedReferenceLink(
  editor: EditorPrimitive,
  adapter: ReferenceRenderAdapter,
  captured: CapturedReferenceLink,
  display: "contentReference" | "referenceCard" | "contentEmbed",
  resolveUrl: (
    url: string,
  ) => Promise<RouterOutputs["references"]["resolveUrls"]>,
): Promise<"converted" | "changed" | "unavailable"> {
  if (
    display !== "contentReference" &&
    !Array.isArray(editor.getBlock(captured.blockId)?.content)
  )
    return "unavailable";
  const url = new URL(captured.href, window.location.origin);
  const resolverUrl =
    url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : captured.href;
  const { items } = await resolveUrl(resolverUrl);
  const resolved = items[0];
  if (
    !resolved?.target ||
    (display === "contentEmbed" && resolved.target.kind !== "document")
  )
    return "unavailable";
  const { state } = editor._tiptapEditor;
  if (!editor.isEditable || !state.doc.eq(captured.doc)) return "changed";
  const target = resolved.target;
  const href =
    target.kind === "external"
      ? target.url
      : resolved.preview.status === "ready"
        ? (resolved.preview.href ?? captured.href)
        : captured.href;
  let label = captured.label;
  try {
    if (
      new URL(label, window.location.origin).href ===
      new URL(captured.href, window.location.origin).href
    )
      label = "";
  } catch {
    // User-authored aliases are kept exactly as entered.
  }
  const props = {
    blockId: target.kind === "document" ? (target.blockId ?? "") : "",
    documentId: target.kind === "document" ? target.documentId : "",
    label,
    resolutionToken: "",
    targetKind: target.kind,
    url: href,
    version: 1,
  };
  const type = state.schema.nodes.contentReference;
  if (!type) return "unavailable";
  // Insert at the captured range rather than at a caret moved by menu focus.
  editor.transact((transaction) => {
    transaction.replaceWith(captured.from, captured.to, type.create(props));
    if (display !== "contentReference")
      adapter.convertInline(
        captured.blockId,
        target,
        display,
        label,
        href,
        captured.occurrenceIndex,
      );
  });
  return "converted";
}
