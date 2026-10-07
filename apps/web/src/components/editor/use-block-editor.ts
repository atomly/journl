"use client";

import { type EditorPartialBlock, schema } from "@acme/blocknote/schema";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { DefaultChatTransport } from "ai-sdk-v6";
import { getPlainUrlForAutomaticReference } from "~/references/reference-utils";
import { useTRPC } from "~/trpc/react";

type UseBlockEditorOptions = {
  /**
   * The initial blocks to render in the editor.
   * @note The initial blocks must be a non-empty array.
   */
  initialBlocks?: [EditorPartialBlock, ...EditorPartialBlock[]] | undefined;
  resetKey?: number;
};

function getAnchorFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function useBlockEditor({
  initialBlocks,
  resetKey,
}: UseBlockEditorOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  function insertPendingReference(
    view: EditorView,
    url: string,
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
    const $position = view.state.doc.resolve(insertionPosition);
    const emptyRootParagraph =
      $position.depth === 1 &&
      $position.parent.type.name === "paragraph" &&
      $position.parent.content.size === 0;
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
      transaction = transaction.replaceWith(
        $position.before(1),
        $position.after(1),
        Fragment.fromArray([node, paragraphNodeType.create()]),
      );
    } else if (replaceSelection) {
      transaction = transaction.replaceSelectionWith(node);
    } else {
      transaction = transaction.insert(insertionPosition, node);
    }
    if (emptyRootParagraph) {
      transaction.setSelection(
        Selection.near(
          transaction.doc.resolve($position.before(1) + node.nodeSize + 1),
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

    void queryClient
      .fetchQuery(
        trpc.references.resolveUrls.queryOptions({ urls: [parsed.toString()] }),
      )
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
            label:
              result.preview.status === "ready"
                ? (result.preview.title ?? "")
                : "",
            targetKind: "document",
            url:
              result.preview.status === "ready"
                ? (result.preview.href ?? parsed.toString())
                : parsed.toString(),
          });
        } else {
          reconcile({
            label:
              result.preview.status === "ready"
                ? (result.preview.title ?? "")
                : parsed.hostname,
            targetKind: "external",
            url: result.target.url,
          });
        }
      })
      .catch(restorePlainUrl);
    return true;
  }

  const editor = useCreateBlockNote(
    {
      _tiptapOptions: {
        editorProps: {
          handleClick: (_view, _pos, event) => {
            const anchor = getAnchorFromTarget(event.target);

            if (!anchor) return false;

            event.preventDefault();

            // Block single-click navigation for links in the editor.
            return true;
          },
          handleDoubleClick: (_view, _pos, event) => {
            const anchor = getAnchorFromTarget(event.target);

            if (!anchor) return false;

            event.preventDefault();

            window.open(
              anchor.href,
              anchor.target || "_blank",
              "noopener,noreferrer",
            );

            return true;
          },
          handleDrop: (view, event) => {
            const plainText = event.dataTransfer?.getData("text/plain") ?? "";
            const html = event.dataTransfer?.getData("text/html") ?? "";
            const pageReference = event.dataTransfer?.getData(
              "application/x-journl-page-reference",
            );
            let droppedPageUrl = "";
            if (pageReference) {
              try {
                const { pageId } = JSON.parse(pageReference) as {
                  pageId?: unknown;
                };
                if (
                  typeof pageId === "string" &&
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                    pageId,
                  )
                ) {
                  droppedPageUrl = new URL(
                    `/pages/${pageId}`,
                    window.location.origin,
                  ).toString();
                }
              } catch {
                // Ignore malformed custom payloads and preserve default drop behavior.
              }
            }
            const url = getPlainUrlForAutomaticReference({
              html: droppedPageUrl ? "" : html,
              // Drop position is supplied by the pointer location, not the current text selection.
              selectionEmpty: true,
              text: droppedPageUrl || plainText,
            });
            if (!url) return false;
            const position = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            })?.pos;
            if (position === undefined) return false;
            const handled = insertPendingReference(view, url, position);
            if (handled) event.preventDefault();
            return handled;
          },
          handlePaste: (view, event) => {
            const plainText = event.clipboardData?.getData("text/plain") ?? "";
            const html = event.clipboardData?.getData("text/html") ?? "";
            const url = getPlainUrlForAutomaticReference({
              html,
              selectionEmpty: view.state.selection.empty,
              text: plainText,
            });
            if (!url) return false;
            const handled = insertPendingReference(view, url, undefined, true);
            if (handled) event.preventDefault();
            return handled;
          },
        },
      },
      animations: false,
      dictionary: {
        ...en,
        ai: aiEn,
      },
      extensions: [
        AIExtension({
          // The `agentCursor.color` is the default across multiple BlockNote components, we're just setting the name.
          agentCursor: { color: "#8bc6ff", name: "Journl" },
          transport: new DefaultChatTransport({
            api: "/api/ai/blocknote",
          }),
        }),
      ],
      initialContent: initialBlocks,
      schema,
    },
    [resetKey],
  );

  return editor;
}
