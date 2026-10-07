import { getBlockInfoAtNearest } from "@blocknote/core";
import { Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { getPlainUrlForAutomaticReference } from "~/references/reference-paste-url";
import type { RouterOutputs } from "~/trpc";

export function insertReferenceUrl(
  view: EditorView,
  url: string,
  resolveUrl: (
    url: string,
  ) => Promise<RouterOutputs["references"]["resolveUrls"]>,
  position?: number,
  replaceSelection = false,
) {
  const candidate = url.trim();
  if (!candidate || candidate.length > 2048 || /\s/.test(candidate))
    return false;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password
  )
    return false;
  const nodeType = view.state.schema.nodes.contentReference;
  if (!nodeType) return false;

  const token = crypto.randomUUID();
  const insertionPosition = position ?? view.state.selection.from;
  const block = getBlockInfoAtNearest(view.state, insertionPosition);
  const emptyRootParagraph =
    block.isBlockContainer &&
    block.blockContent.node.type.name === "paragraph" &&
    block.blockContent.node.content.size === 0 &&
    view.state.doc.resolve(block.bnBlock.beforePos).depth === 1;
  const presentationNodeType = emptyRootParagraph
    ? view.state.schema.nodes.referenceCard
    : nodeType;
  if (!presentationNodeType) return false;
  const paragraphNodeType = view.state.schema.nodes.paragraph;
  if (emptyRootParagraph && !paragraphNodeType) return false;
  const node = presentationNodeType.create({
    blockId: "",
    documentId: "",
    label: "",
    resolutionToken: token,
    targetKind: "external",
    url: parsed.toString(),
    version: 1,
  });
  let transaction = view.state.tr;
  if (emptyRootParagraph) {
    if (!paragraphNodeType) return false;
    if (!block.isBlockContainer) return false;
    transaction = transaction.replaceWith(
      block.blockContent.beforePos,
      block.blockContent.afterPos,
      node,
    );
    const trailingParagraph = view.state.schema.nodes.blockContainer?.create(
      { id: crypto.randomUUID() },
      paragraphNodeType.create(),
    );
    if (!trailingParagraph) return false;
    transaction = transaction.insert(
      transaction.mapping.map(block.bnBlock.afterPos),
      trailingParagraph,
    );
  } else if (replaceSelection) {
    transaction = transaction.replaceSelectionWith(node);
  } else {
    transaction = transaction.insert(insertionPosition, node);
  }
  if (emptyRootParagraph) {
    transaction.setSelection(
      Selection.near(
        transaction.doc.resolve(
          transaction.mapping.map(block.bnBlock.afterPos, -1) + 2,
        ),
      ),
    );
  }
  view.dispatch(transaction);

  const reconcile = (props: Record<string, string | number | boolean>) => {
    if (view.isDestroyed) return;
    let matchPosition: number | undefined;
    view.state.doc.descendants((current, currentPosition) => {
      if (
        (current.type.name === "contentReference" ||
          current.type.name === "referenceCard") &&
        current.attrs.resolutionToken === token &&
        current.attrs.url === parsed.toString()
      ) {
        matchPosition = currentPosition;
        return false;
      }
      return true;
    });
    if (matchPosition === undefined) return;
    const current = view.state.doc.nodeAt(matchPosition);
    if (
      !current ||
      current.attrs.resolutionToken !== token ||
      current.attrs.url !== parsed.toString()
    )
      return;
    view.dispatch(
      view.state.tr
        .setNodeMarkup(matchPosition, undefined, {
          ...current.attrs,
          ...props,
          resolutionToken: "",
        })
        .setMeta("addToHistory", false),
    );
  };

  const restorePlainUrl = () => {
    if (view.isDestroyed) return;
    let matchPosition: number | undefined;
    let isCard = false;
    view.state.doc.descendants((current, currentPosition) => {
      if (
        (current.type.name === "contentReference" ||
          current.type.name === "referenceCard") &&
        current.attrs.resolutionToken === token &&
        current.attrs.url === parsed.toString()
      ) {
        matchPosition = currentPosition;
        isCard = current.type.name === "referenceCard";
        return false;
      }
      return true;
    });
    if (matchPosition === undefined) return;
    const current = view.state.doc.nodeAt(matchPosition);
    if (
      !current ||
      current.attrs.resolutionToken !== token ||
      current.attrs.url !== parsed.toString()
    )
      return;
    const replacement = isCard
      ? view.state.schema.nodes.paragraph?.create(
          null,
          view.state.schema.text(parsed.toString()),
        )
      : view.state.schema.text(parsed.toString());
    if (!replacement) return;
    view.dispatch(
      view.state.tr
        .replaceWith(
          matchPosition,
          matchPosition + current.nodeSize,
          replacement,
        )
        .setMeta("addToHistory", false),
    );
  };

  // A URL copied from this preview is still an internal route even when
  // PUBLIC_WEB_URL points to the production domain.
  const resolverUrl =
    parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  void resolveUrl(resolverUrl)
    .then(({ items }) => {
      const result = items[0];
      if (!result?.target) {
        reconcile({ label: parsed.hostname });
        return;
      }
      if (result.target.kind === "document") {
        reconcile({
          blockId: result.target.blockId ?? "",
          documentId: result.target.documentId,
          label: "",
          targetKind: "document",
          url:
            result.preview.status === "ready"
              ? (result.preview.href ?? parsed.toString())
              : parsed.toString(),
        });
      } else {
        reconcile({
          label: "",
          targetKind: "external",
          url: result.target.url,
        });
      }
    })
    .catch(restorePlainUrl);
  return true;
}

// BlockNote handles the DOM paste event itself. Returning false from a
// ProseMirror handlePaste hook never reaches that clipboard pipeline.
export function handleReferencePaste(
  context: {
    event: ClipboardEvent;
    editor: { prosemirrorView: EditorView };
    defaultPasteHandler: () => boolean | undefined;
  },
  resolveUrl: Parameters<typeof insertReferenceUrl>[2],
) {
  const { event, editor, defaultPasteHandler } = context;
  const clipboard = event.clipboardData;
  const view = editor.prosemirrorView;
  if (
    !clipboard ||
    clipboard.types.includes("Files") ||
    clipboard.types.includes("blocknote/html") ||
    view.state.selection.$from.parent.type.spec.code
  )
    return defaultPasteHandler();
  const text = clipboard.getData("text/plain");
  let html = clipboard.getData("text/html");
  // Browsers often copy a bare URL as both text and HTML. Preserve aliases,
  // images, and richer HTML; allow wrappers around just the same URL.
  if (html) {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (
      body.textContent?.trim() === text.trim() &&
      !body.querySelector("img, table, video, audio, iframe, pre, code") &&
      [...body.querySelectorAll("a")].every(
        (anchor) => anchor.getAttribute("href") === text.trim(),
      )
    )
      html = "";
  }
  const url = getPlainUrlForAutomaticReference({
    html,
    selectionEmpty: view.state.selection.empty,
    text,
  });
  if (url && insertReferenceUrl(view, url, resolveUrl, undefined, true))
    return true;
  return defaultPasteHandler();
}
