"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

type NotFoundEditorProps = Pick<
  React.ComponentProps<typeof BlockNoteView>,
  "className"
>;

export function NotFoundEditor(props: NotFoundEditorProps) {
  // Creates a new editor instance.
  const editor = useCreateBlockNote({
    initialContent: [
      {
        content: "Journl #404",
        type: "heading",
      },
      {
        content: "Page not found.",
        type: "bulletListItem",
      },
      {
        content: "Error: #404",
        type: "bulletListItem",
      },
      {
        type: "paragraph",
      },
    ],
  });

  return <BlockNoteView autoFocus theme="light" editor={editor} {...props} />;
}
