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
        props: {
          textAlignment: "center",
        },
        type: "paragraph",
      },
      {
        type: "paragraph",
      },
      {
        content: "The path was linked, but the note was not.",
        type: "bulletListItem",
      },
      {
        content: "Will investigate later... I hope.",
        type: "bulletListItem",
      },
      {
        type: "paragraph",
      },
    ],
  });

  return <BlockNoteView autoFocus theme="light" editor={editor} />;
}
