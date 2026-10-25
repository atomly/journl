"use client";

import type { DocumentBlock, DocumentOperation } from "@acme/document";
import {
  documentChanges,
  documentExtensions,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  referenceSelectionPlugin,
  safeEditorUrl,
  suggestionExtension,
  toTiptapDocument,
  writingExtension,
} from "@acme/tiptap";
import { useQueryClient } from "@tanstack/react-query";
import { Editor, Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "~/lib/cn";
import { getPlainUrlForAutomaticReference } from "~/references/reference-paste-url";
import { useTRPC } from "~/trpc/react";
import { referenceViewStore, TiptapReferenceViews } from "./tiptap-node-views";
import { insertTiptapReference } from "./tiptap-reference-insertion";
import { TiptapSideMenu } from "./tiptap-side-menu";
import { TiptapTableHandles } from "./tiptap-table-handles";
import { TiptapToolbar } from "./tiptap-toolbar";
import { TiptapContextMenu, TiptapSlashMenu } from "./tiptap-writing-controls";
import "./tiptap-editor.css";

export type TiptapCommit = (
  blocks: DocumentBlock[],
  operations: DocumentOperation[],
) => void;

/** Owns a mounted view, never the draft or its persistence queue. */
export function TiptapEditor({
  initialBlocks,
  onCommit,
  className,
  children,
}: {
  initialBlocks: readonly DocumentBlock[] | undefined;
  onCommit?: TiptapCommit;
  className?: string;
  children?: React.ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const resolveUrl = (url: string) =>
    queryClient.fetchQuery(
      trpc.references.resolveUrls.queryOptions({ urls: [url] }),
    );
  const initial = useRef(initialBlocks);
  const resolver = useRef(resolveUrl);
  resolver.current = resolveUrl;
  const host = useRef<HTMLDivElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const [editor, setEditor] = useState<Editor>();
  const referenceViews = useMemo(referenceViewStore, []);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const initialBlocks = initial.current;
    let current: Editor | undefined;
    try {
      // The placeholder exists only in the view until the first committed edit.
      const blocks = initialBlocks?.length
        ? initialBlocks
        : [{ id: crypto.randomUUID(), type: "paragraph" as const }];
      let previous = [...(initialBlocks ?? [])];
      current = new Editor({
        content: toTiptapDocument(blocks).toJSON(),
        editable: Boolean(commit.current),
        editorProps: {
          attributes: {
            "aria-label": commit.current
              ? "Document editor"
              : "Document content",
            ...(commit.current ? { "aria-multiline": "true" } : {}),
            class: "journl-tiptap min-h-32 outline-none",
            role: commit.current ? "textbox" : "document",
          },
          handleDOMEvents: {
            click: (view, event) => {
              if (
                !view.editable ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                !(event.target instanceof Element) ||
                !event.target.closest("a[data-journl-link]")
              )
                return false;
              event.preventDefault();
              return true;
            },
            dblclick: (view, event) => {
              if (!view.editable || !(event.target instanceof Element))
                return false;
              const anchor = event.target.closest<HTMLAnchorElement>(
                "a[data-journl-link]",
              );
              const href =
                anchor && safeEditorUrl(anchor.getAttribute("href") ?? "");
              if (!href) return false;
              event.preventDefault();
              window.open(href, "_blank", "noopener,noreferrer");
              return true;
            },
            keydown: (view, event) =>
              view.composing || event.isComposing || event.keyCode === 229,
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false;
            const url = getPlainUrlForAutomaticReference({
              html: event.dataTransfer?.getData("text/html") ?? "",
              selectionEmpty: true,
              text: event.dataTransfer?.getData("text/plain") ?? "",
            });
            if (!url) return false;
            const target = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            if (target)
              view.dispatch(
                view.state.tr.setSelection(
                  TextSelection.near(view.state.doc.resolve(target.pos)),
                ),
              );
            return insertTiptapReference(view, url, (value) =>
              resolver.current(value),
            );
          },
          handlePaste: (view, event) => {
            const url = getPlainUrlForAutomaticReference({
              html: event.clipboardData?.getData("text/html") ?? "",
              selectionEmpty: view.state.selection.empty,
              text: event.clipboardData?.getData("text/plain") ?? "",
            });
            return Boolean(
              url &&
                insertTiptapReference(view, url, (value) =>
                  resolver.current(value),
                ),
            );
          },
        },
        element: host.current,
        enableContentCheck: true,
        extensions: [
          ...documentExtensions(),
          referenceViews.extension,
          editingExtension(() => crypto.randomUUID()),
          writingExtension(() => crypto.randomUUID()),
          suggestionExtension(() => crypto.randomUUID()),
          identityExtension(() => crypto.randomUUID()),
          Extension.create({
            addProseMirrorPlugins: () => [referenceSelectionPlugin()],
            name: "journlReferences",
          }),
        ],
        onUpdate: ({ editor: updated }) => {
          try {
            const operations = documentChanges(previous, updated.state.doc);
            const next = fromTiptapDocument(updated.state.doc);
            if (operations.length) commit.current?.(next, operations);
            previous = next;
          } catch {
            updated.setEditable(false);
            setError(true);
          }
        },
      });
      setEditor(current);
      const targetId = new URLSearchParams(window.location.hash.slice(1)).get(
        "block",
      );
      if (targetId) {
        const target = Array.from(
          host.current.querySelectorAll<HTMLElement>("[data-block-id]"),
        ).find((item) => item.dataset.blockId === targetId);
        target?.scrollIntoView({ block: "center" });
        target?.classList.add("reference-target-highlight");
      }
    } catch {
      setError(true);
    }
    return () => {
      current?.destroy();
    };
    // A draft reset remounts this view. Acknowledged saves must not reset selection/history.
  }, [referenceViews.extension]);
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
      <div ref={host} className="journl-tiptap-host" />
      <TiptapReferenceViews store={referenceViews} />
      {onCommit && !error && (
        <>
          {editor && (
            <>
              <TiptapSideMenu editor={editor} />
              <TiptapTableHandles editor={editor} />
            </>
          )}
          <TiptapSlashMenu editor={editor} />
          <TiptapContextMenu editor={editor} />
        </>
      )}
    </section>
  );
}
