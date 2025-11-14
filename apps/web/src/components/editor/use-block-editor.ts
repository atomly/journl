"use client";

import { model } from "@acme/blocknote/ai";
import { schema } from "@acme/blocknote/schema";
import type { PartialBlock } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { createAIExtension } from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";

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
      createAIExtension({
        // The `agentCursor.color` is the default across multiple BlockNote components, we're just setting the name.
        agentCursor: { color: "#8bc6ff", name: "Journl" },
        model,
      }),
    ],
    initialContent: initialBlocks,
    schema,
  });

  return editor;
}
