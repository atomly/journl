"use client";

import type { DocumentBlock, DocumentOperation } from "@acme/document";
import {
  getPlainUrlForAutomaticReference,
  type ReferenceClient,
} from "@acme/references";
import {
  clipboardPasteExtension,
  clipboardText,
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
import { type AnyExtension, Editor, Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import { insertTiptapReference } from "./reference-insertion";

export type EditorCommit = (
  blocks: DocumentBlock[],
  operations: DocumentOperation[],
) => void;

export type DocumentEditorOptions = {
  initialBlocks: readonly DocumentBlock[] | undefined;
  onCommit?: EditorCommit;
  resolveUrl: ReferenceClient["resolveUrl"];
  /** Stable presentation extensions, including node views. */
  extensions: readonly AnyExtension[];
};

/** Owns the mounted editor and transactions; the caller owns presentation and persistence. */
export function useDocumentEditor({
  initialBlocks,
  onCommit,
  resolveUrl,
  extensions,
}: DocumentEditorOptions) {
  const initial = useRef(initialBlocks);
  const resolver = useRef(resolveUrl);
  resolver.current = resolveUrl;
  const host = useRef<HTMLDivElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const [editor, setEditor] = useState<Editor>();
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
          clipboardTextSerializer: (slice) => clipboardText(slice.content),
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
          ...documentExtensions().map(
            (base) =>
              extensions.find((extension) => extension.name === base.name) ??
              base,
          ),
          ...extensions.filter(
            (extension) =>
              !documentExtensions().some(
                (base) => base.name === extension.name,
              ),
          ),
          clipboardPasteExtension(() => crypto.randomUUID()),
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
            updated.setEditable(false, false);
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
  }, [extensions]);
  return { editor, error, host };
}
