"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { cn } from "cn";
import { type ComponentProps, createContext, useContext } from "react";

const ActionErrorContext = createContext<
  ((error: unknown) => void) | undefined
>(undefined);
export function useEditorActionError() {
  return useContext(ActionErrorContext);
}
const EditorContext = createContext<Editor | undefined>(undefined);

export function useEditorInstance(explicit?: Editor) {
  const contextual = useContext(EditorContext);
  return explicit ?? contextual;
}

/** Subscribes only to the selected value, never a document snapshot in context. */
export function useEditorSelector<T>(
  selector: (editor: Editor) => T,
  explicit?: Editor,
  equalityFn?: (a: T | undefined, b: T | undefined) => boolean,
) {
  const editor = useEditorInstance(explicit);
  return useEditorState({
    editor: editor ?? null,
    equalityFn: equalityFn
      ? (a, b) => equalityFn(a ?? undefined, b ?? undefined)
      : undefined,
    selector: () => (editor ? selector(editor) : undefined),
  });
}

export function EditorRoot({
  editor,
  onActionError,
  className,
  ...props
}: ComponentProps<"section"> & {
  editor?: Editor;
  onActionError?: (error: unknown) => void;
}) {
  const parentError = useContext(ActionErrorContext);
  return (
    <EditorContext.Provider value={editor}>
      <ActionErrorContext.Provider value={onActionError ?? parentError}>
        <section
          data-better-editor-root=""
          {...props}
          className={cn("better-editor-editor-shell min-w-0", className)}
        />
      </ActionErrorContext.Provider>
    </EditorContext.Provider>
  );
}
