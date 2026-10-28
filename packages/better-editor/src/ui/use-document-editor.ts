"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import {
  createDocumentEditor,
  type DocumentEditorOptions,
} from "../engine/editor";

export type UseDocumentEditorOptions = Omit<
  DocumentEditorOptions,
  "element" | "attributes" | "onError"
>;

/** Mounts an engine in React without owning the draft or save queue. */
export function useDocumentEditor({
  initialBlocks,
  onCommit,
  resolveUrl,
  extensions,
}: UseDocumentEditorOptions) {
  const initial = useRef(initialBlocks);
  const resolver = useRef(resolveUrl);
  resolver.current = resolveUrl;
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let current: Editor | undefined;
    try {
      const attributes: Record<string, string> = {
        "aria-label": commit.current ? "Document editor" : "Document content",
        class: "better-editor-tiptap min-h-32 outline-none",
        role: commit.current ? "textbox" : "document",
      };
      if (commit.current) attributes["aria-multiline"] = "true";
      current = createDocumentEditor({
        attributes,
        element,
        extensions,
        initialBlocks: initial.current,
        onCommit: commit.current
          ? (blocks, operations) => commit.current?.(blocks, operations)
          : undefined,
        onError: () => setError(true),
        resolveUrl: (url) => resolver.current(url),
      });
      setEditor(current);
      const targetId = new URLSearchParams(window.location.hash.slice(1)).get(
        "block",
      );
      if (targetId) {
        const target = Array.from(
          element.querySelectorAll<HTMLElement>("[data-block-id]"),
        ).find((item) => item.dataset.blockId === targetId);
        target?.scrollIntoView({ block: "center" });
        target?.classList.add("reference-target-highlight");
      }
    } catch {
      setError(true);
    }
    return () => current?.destroy();
    // Draft resets remount this view. Save acknowledgements preserve history and selection.
  }, [extensions]);
  return { editor, error, host };
}
