"use client";

import { type EditorPartialBlock, schema } from "@acme/blocknote/schema";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { useQueryClient } from "@tanstack/react-query";
import type { EditorView } from "@tiptap/pm/view";
import { DefaultChatTransport } from "ai-sdk-v6";
import { getPlainUrlForAutomaticReference } from "~/references/reference-paste-url";
import { useTRPC } from "~/trpc/react";
import {
  handleReferencePaste,
  insertReferenceUrl,
} from "./reference-insertion";

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
    return insertReferenceUrl(
      view,
      url,
      (resolverUrl) =>
        queryClient.fetchQuery(
          trpc.references.resolveUrls.queryOptions({ urls: [resolverUrl] }),
        ),
      position,
      replaceSelection,
    );
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
      pasteHandler: (context) =>
        handleReferencePaste(context, (url) =>
          queryClient.fetchQuery(
            trpc.references.resolveUrls.queryOptions({ urls: [url] }),
          ),
        ),
      schema,
    },
    [resetKey],
  );

  return editor;
}
