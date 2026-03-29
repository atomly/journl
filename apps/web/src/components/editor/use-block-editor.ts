"use client";

import { schema } from "@acme/blocknote/schema";
import type { PartialBlock } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { DefaultChatTransport } from "ai";

type UseBlockEditorOptions = {
  /**
   * The initial blocks to render in the editor.
   * @note The initial blocks must be a non-empty array.
   */
  initialBlocks?: [PartialBlock, ...PartialBlock[]] | undefined;
};

function getAnchorFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function useBlockEditor({ initialBlocks }: UseBlockEditorOptions) {
  const editor = useCreateBlockNote({
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
  });

  return editor;
}
