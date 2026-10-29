"use client";

import type { Editor } from "@tiptap/core";
import type { ComponentProps } from "react";
import { useEditorInstance } from "./editor-root";
import { useHandleVisibility } from "./handle-visibility";
import { TiptapTableHandles } from "./table-handles";

export function TableControls({
  editor: explicit,
  visible,
  ...props
}: Omit<ComponentProps<typeof TiptapTableHandles>, "editor" | "visible"> & {
  editor?: Editor;
  visible?: boolean;
}) {
  const editor = useEditorInstance(explicit);
  const automatic = useHandleVisibility(editor);
  return editor ? (
    <TiptapTableHandles
      {...props}
      editor={editor}
      visible={visible ?? automatic}
    />
  ) : null;
}
