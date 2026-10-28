"use client";

import type { Editor } from "@tiptap/core";
import type { ComponentProps } from "react";
import { useEditorInstance } from "./editor-root";
import { useHandleVisibility } from "./handle-visibility";
import { TiptapSideMenu } from "./side-menu";

export function BlockHandle({
  editor: explicit,
  visible,
  ...props
}: Omit<ComponentProps<typeof TiptapSideMenu>, "editor" | "visible"> & {
  editor?: Editor;
  visible?: boolean;
}) {
  const editor = useEditorInstance(explicit);
  const automatic = useHandleVisibility(editor);
  return editor ? (
    <TiptapSideMenu {...props} editor={editor} visible={visible ?? automatic} />
  ) : null;
}
