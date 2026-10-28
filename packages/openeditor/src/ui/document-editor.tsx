/// <reference path="./styles.d.ts" />
"use client";

import type { DocumentBlock } from "@acme/document";
import type { ReferenceClient } from "@acme/references";
import { EditorContent } from "@tiptap/react";
import { cn } from "cn";
import { useContext, useMemo } from "react";
import type { EditorCommit } from "../engine/editor";
import { insertTiptapReference } from "../engine/reference-insertion";
import { documentExtensions } from "../engine/schema";
import { codeBlockPresentation } from "./code-block";
import { useHandleVisibility } from "./handle-visibility";
import { referenceViewStore, TiptapReferenceViews } from "./node-views";
import { ReferenceClientContext } from "./reference-client";
import { TiptapSideMenu } from "./side-menu";
import { TiptapTableHandles } from "./table-handles";
import { TiptapToolbar } from "./toolbar";
import { useDocumentEditor } from "./use-document-editor";
import { TiptapContextMenu, TiptapSlashMenu } from "./writing-controls";
import "./editor.css";

/** Owns a mounted view, never the draft or its persistence queue. */
type DocumentEditorProps = {
  initialBlocks: readonly DocumentBlock[] | undefined;
  onCommit?: EditorCommit;
  className?: string;
  children?: React.ReactNode;
  references?: ReferenceClient;
};
export function DocumentEditor({ references, ...props }: DocumentEditorProps) {
  const parent = useContext(ReferenceClientContext);
  return (
    <ReferenceClientContext.Provider value={references ?? parent}>
      <EditorView {...props} />
    </ReferenceClientContext.Provider>
  );
}
function EditorView({
  initialBlocks,
  onCommit,
  className,
  children,
}: DocumentEditorProps) {
  const references = useContext(ReferenceClientContext);
  const resolveUrl: ReferenceClient["resolveUrl"] =
    references?.resolveUrl ?? (async () => ({ items: [] }));
  const referenceViews = useMemo(referenceViewStore, []);
  const extensions = useMemo(
    () => [
      ...documentExtensions()
        .filter((extension) => extension.name === "codeBlock")
        .map((extension) => extension.extend(codeBlockPresentation)),
      referenceViews.extension,
    ],
    [referenceViews.extension],
  );
  const { editor, error, host } = useDocumentEditor({
    extensions,
    initialBlocks,
    onCommit,
    resolveUrl,
  });
  const handlesVisible = useHandleVisibility(editor);
  return (
    <section
      className={cn("journl-editor-shell min-w-0", className)}
      data-editor-frontend="tiptap"
    >
      {onCommit && editor && !error && (
        <TiptapToolbar
          editor={editor}
          insertReference={(url, label, display) => {
            insertTiptapReference(editor.view, url, resolveUrl, label, display);
          }}
        />
      )}
      {children}
      {error && (
        <p role="alert" className="px-8 text-destructive">
          This content could not be edited safely. Your last valid draft is
          still available in save details.
        </p>
      )}
      <EditorContent
        ref={host}
        editor={editor ?? null}
        className="journl-tiptap-host"
      />
      <TiptapReferenceViews store={referenceViews} />
      {onCommit && !error && (
        <>
          {editor && (
            <>
              <TiptapSideMenu editor={editor} visible={handlesVisible} />
              <TiptapTableHandles editor={editor} visible={handlesVisible} />
            </>
          )}
          <TiptapSlashMenu editor={editor} />
          <TiptapContextMenu editor={editor} />
        </>
      )}
    </section>
  );
}
