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

export function useBlockEditor({ initialBlocks }: UseBlockEditorOptions) {
  const editor = useCreateBlockNote({
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
