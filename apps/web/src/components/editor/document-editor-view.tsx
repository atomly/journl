"use client";

import { syntaxHighlightExtension } from "@acme/better-editor/engine/code-block";
import { dropCursorExtension } from "@acme/better-editor/engine/drop-cursor";
import type { EditorCommit } from "@acme/better-editor/engine/editor";
import { blockAt } from "@acme/better-editor/engine/identity";
import { insertTiptapReference } from "@acme/better-editor/engine/reference-insertion";
import { documentExtensions } from "@acme/better-editor/engine/schema";
import {
  defaultSlashItems,
  type SlashItemSource,
} from "@acme/better-editor/engine/slash-items";
import { applyTableEdit } from "@acme/better-editor/engine/table-actions";
import { removeSelectedBlock } from "@acme/better-editor/engine/writing";
import { BlockHandle } from "@acme/better-editor/ui/block-handle";
import { codeBlockPresentation } from "@acme/better-editor/ui/code-block";
import { EditorContextMenu } from "@acme/better-editor/ui/context-menu";
import { EditorMenuItem } from "@acme/better-editor/ui/controls";
import { EditorContent } from "@acme/better-editor/ui/editor-content";
import { EditorError } from "@acme/better-editor/ui/editor-error";
import { EditorRoot } from "@acme/better-editor/ui/editor-root";
import { useHandleVisibility } from "@acme/better-editor/ui/handle-visibility";
import { ReferenceClientContext } from "@acme/better-editor/ui/reference-client";
import {
  ReferenceViews,
  useReferenceViews,
} from "@acme/better-editor/ui/reference-views";
import { SlashMenu } from "@acme/better-editor/ui/slash-menu";
import { TableMenuItems } from "@acme/better-editor/ui/table-controls";
import { TableControls } from "@acme/better-editor/ui/table-controls-root";
import { useBetterEditor } from "@acme/better-editor/ui/use-better-editor";
import type { DocumentBlock } from "@acme/document";
import type { ReferenceClient } from "@acme/references";
import { DropdownMenuSeparator } from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { cn } from "cn";
import { useContext, useMemo } from "react";
import { BlockActions } from "./block-actions";
import type { DocumentEditorServices } from "./document-editor-services";
import { BlockMenuContent, DocumentToolbar } from "./document-toolbar";
import { ReferenceActions } from "./reference-actions";

/** Owns a mounted view, never the draft or its persistence queue. */
type DocumentEditorProps = {
  initialBlocks: readonly DocumentBlock[] | undefined;
  onCommit?: EditorCommit;
  className?: string;
  children?: React.ReactNode;
  references?: ReferenceClient;
  services?: DocumentEditorServices;
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
  slashItems = defaultSlashItems(),
  toolbarMode = "floating",
  toolbarVisibility = "selection",
  services,
}: DocumentEditorProps) {
  const references = useContext(ReferenceClientContext);
  const resolveUrl: ReferenceClient["resolveUrl"] =
    references?.resolveUrl ?? (async () => ({ items: [] }));
  const referenceViews = useReferenceViews();
  const extensions = useMemo(
    () => [
      syntaxHighlightExtension,
      dropCursorExtension.configure({ color: "var(--ring)", width: 2 }),
      ...documentExtensions()
        .filter((extension) => extension.name === "codeBlock")
        .map((extension) => extension.extend(codeBlockPresentation)),
      referenceViews.extension,
    ],
    [referenceViews.extension],
  );
  const { editor, error, host } = useBetterEditor({
    editable,
    extensions,
    initialBlocks,
    normalizeReferenceUrl: services?.normalizeReferenceUrl,
    onCommit,
    onReady,
    openLink: services?.openLink,
    referenceBehavior: true,
    resetKey,
    resolveUrl,
    slashItems: [],
  });
  const handlesVisible = useHandleVisibility(editor);
  return (
    <EditorRoot
      editor={editor}
      onActionError={services?.onActionError}
      className={cn(
        "better-editor-editor-shell min-w-0",
        editable && "flex flex-col",
        className,
      )}
    >
      {children}
      <EditorError error={error} className="px-8 text-destructive" />
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
          <DocumentToolbar
            services={services}
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
      <ReferenceViews
        maxEmbedDepth={2}
        renderActions={(target) => <ReferenceActions {...target} />}
        store={referenceViews}
        renderEmbeddedContent={(blocks) => (
          <DocumentEditor
            initialBlocks={blocks}
            references={references ?? undefined}
            services={services}
            editable={false}
          />
        )}
      />
      {editable && !error && (
        <>
          {editor && (
            <>
              <BlockHandle
                editor={editor}
                visible={handlesVisible}
                renderMenu={({ editor, blockId }) => (
                  <BlockMenuContent
                    services={services}
                    editor={editor}
                    blockId={blockId}
                  />
                )}
              />
              <TableControls
                editor={editor}
                visible={handlesVisible}
                renderMenu={({ editor, axis, blockId }) => (
                  <>
                    <TableMenuItems editor={editor} axis={axis} />
                    <DropdownMenuSeparator />
                    <EditorMenuItem
                      hint="Remove the whole table"
                      variant="destructive"
                      onClick={() => {
                        const block = blockAt(editor.state.doc, blockId);
                        editor.view.dispatch(
                          editor.state.tr.setSelection(
                            NodeSelection.create(editor.state.doc, block.pos),
                          ),
                        );
                        const tr = removeSelectedBlock(editor.state, () =>
                          crypto.randomUUID(),
                        );
                        if (tr) applyTableEdit(editor, tr);
                        editor.view.focus();
                      }}
                    >
                      Delete table
                    </EditorMenuItem>
                  </>
                )}
              />
            </>
          )}
          {slashMenu !== undefined ? (
            slashMenu
          ) : (
            <SlashMenu editor={editor} items={slashItems} />
          )}
          <EditorContextMenu
            editor={editor}
            renderMenu={({ editor, blockId }) => (
              <BlockActions
                services={services}
                editor={editor}
                blockId={blockId}
              />
            )}
          />
        </>
      )}
    </EditorRoot>
  );
}
