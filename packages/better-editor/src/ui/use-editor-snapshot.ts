"use client";
import type { Editor } from "@tiptap/core";
import { useEditorSelector } from "./editor-root";
/** For gesture controllers that require the complete current ProseMirror state. */
export function useEditorSnapshot(editor?: Editor) {
  return useEditorSelector((instance) => instance.state, editor, Object.is);
}
