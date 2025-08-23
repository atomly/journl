"use client";

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";

export function NotFoundEditor() {
  // Creates a new editor instance.
  const editor = useCreateBlockNote({
    initialContent: [
      {
        content: "Journl #404",
        type: "heading",
      },
      {
        content: "Page not found.",
        type: "paragraph",
      },
      {
        content: "The path was linked, but the note was not.",
        type: "bulletListItem",
      },
      {
        content: "Will investigate later... or probably forget.",
        type: "bulletListItem",
      },
      {
        children: [
          {
            content: "window.location.href = '/';",
            props: { language: "json" },
            type: "codeBlock",
          },
        ],
        content: "This should help users find their way back...",
        type: "bulletListItem",
      },
      {
        type: "paragraph",
      },
    ],
  });

  return <BlockNoteView autoFocus theme="light" editor={editor} />;
}
