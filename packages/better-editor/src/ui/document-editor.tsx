/// <reference path="./styles.d.ts" />
"use client";

import type { DocumentBlock } from "@acme/document";
import type { ReferenceClient } from "@acme/references";
import type { Editor } from "@tiptap/core";
import { cn } from "cn";
import { useContext, useMemo } from "react";
import { syntaxHighlightExtension } from "../engine/code-block";
import type { EditorCommit } from "../engine/editor";
import { insertTiptapReference } from "../engine/reference-insertion";
import { documentExtensions } from "../engine/schema";
import type { SlashItemSource } from "../engine/slash-items";
import { codeBlockPresentation } from "./code-block";
import { EditorContent } from "./editor-content";
import { EditorRoot } from "./editor-root";
import type { EditorServices } from "./editor-services";
import { useHandleVisibility } from "./handle-visibility";
import { referenceViewStore, TiptapReferenceViews } from "./node-views";
import { ReferenceClientContext } from "./reference-client";
import { TiptapSideMenu } from "./side-menu";
import { SlashMenu } from "./slash-menu";
import { TiptapTableHandles } from "./table-handles";
import { TiptapToolbar } from "./toolbar";
import { useDocumentEditor } from "./use-document-editor";
import { TiptapContextMenu } from "./writing-controls";
import "./editor.css";

/** Owns a mounted view, never the draft or its persistence queue. */
type DocumentEditorProps = {
  initialBlocks: readonly DocumentBlock[] | undefined;
  onCommit?: EditorCommit;
  className?: string;
  children?: React.ReactNode;
  references?: ReferenceClient;
  services?: EditorServices;
  editable?: boolean;
  resetKey?: string | number;
  onReady?: (editor: Editor) => void;
  toolbar?: React.ReactNode;
  slashMenu?: React.ReactNode;
  slashItems?: SlashItemSource;
  toolbarMode?: "floating" | "sticky" | "inline";
  toolbarVisibility?: "always" | "selection";
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
  editable = Boolean(onCommit),
  resetKey,
  onReady,
  toolbar,
  slashMenu,
  slashItems,
  toolbarMode = "floating",
  toolbarVisibility = "selection",
  services,
}: DocumentEditorProps) {
  const references = useContext(ReferenceClientContext);
  const resolveUrl: ReferenceClient["resolveUrl"] =
    references?.resolveUrl ?? (async () => ({ items: [] }));
  const referenceViews = useMemo(referenceViewStore, []);
  const extensions = useMemo(
    () => [
      syntaxHighlightExtension,
      ...documentExtensions()
        .filter((extension) => extension.name === "codeBlock")
        .map((extension) => extension.extend(codeBlockPresentation)),
      referenceViews.extension,
    ],
    [referenceViews.extension],
  );
  const { editor, error, host } = useDocumentEditor({
    editable,
    extensions,
    initialBlocks,
    normalizeReferenceUrl: services?.normalizeReferenceUrl,
    onCommit,
    onReady,
    openLink: services?.openLink,
    resetKey,
    resolveUrl,
    slashItems: [],
  });
  const handlesVisible = useHandleVisibility(editor);
  return (
    <EditorRoot
      editor={editor}
      services={services}
      className={cn(
        "better-editor-editor-shell min-w-0",
        editable && "flex flex-col",
        className,
      )}
      data-editor-frontend="tiptap"
    >
      {children}
      {error && (
        <p role="alert" className="px-8 text-destructive">
          This content could not be edited safely.
        </p>
      )}
      <EditorContent
        ref={host}
        editor={editor}
        className="better-editor-tiptap-host"
      />
      {editable &&
        editor &&
        !error &&
        (toolbar !== undefined ? (
          toolbar
        ) : (
          <TiptapToolbar
            editor={editor}
            mode={toolbarMode}
            visibility={toolbarVisibility}
            insertReference={(url, label, display) => {
              insertTiptapReference(
                editor.view,
                url,
                resolveUrl,
                label,
                display,
                services?.normalizeReferenceUrl,
              );
            }}
          />
        ))}
      <TiptapReferenceViews store={referenceViews} />
      {editable && !error && (
        <>
          {editor && (
            <>
              <TiptapSideMenu editor={editor} visible={handlesVisible} />
              <TiptapTableHandles editor={editor} visible={handlesVisible} />
            </>
          )}
          {slashMenu !== undefined ? (
            slashMenu
          ) : (
            <SlashMenu editor={editor} items={slashItems} />
          )}
          <TiptapContextMenu editor={editor} />
        </>
      )}
    </EditorRoot>
  );
}
