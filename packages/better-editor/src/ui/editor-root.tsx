"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { cn } from "cn";
import { type ComponentProps, createContext, useContext } from "react";

import { type EditorServices, EditorServicesContext } from "./editor-services";

const emptyServices: EditorServices = {};
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
  services,
  className,
  ...props
}: ComponentProps<"section"> & { editor?: Editor; services?: EditorServices }) {
  const parentServices = useContext(EditorServicesContext);
  return (
    <EditorContext.Provider value={editor}>
      <EditorServicesContext.Provider
        value={services ?? parentServices ?? emptyServices}
      >
        <section
          {...props}
          className={cn("better-editor-editor-shell min-w-0", className)}
        />
      </EditorServicesContext.Provider>
    </EditorContext.Provider>
  );
}
