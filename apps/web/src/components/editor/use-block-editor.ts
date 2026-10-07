"use client";

import { type EditorPartialBlock, schema } from "@acme/blocknote/schema";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { DefaultChatTransport } from "ai-sdk-v6";

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
