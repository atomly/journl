"use client";

import type { AnyExtension, Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import {
  createDocumentEditor,
  type DocumentEditorOptions,
  retryEditorCommit,
} from "../engine/editor";

export type UseBetterEditorOptions = Omit<
  DocumentEditorOptions,
  "element" | "attributes" | "resolveUrl" | "extensions"
> & {
  extensions?: readonly AnyExtension[];
  resolveUrl?: DocumentEditorOptions["resolveUrl"];
  /** Changing this key deliberately loads current initialBlocks and clears history. */
  resetKey?: string | number;
  onReady?: (editor: Editor) => void;
};

/** Owns one engine until unmount or an explicit reset, independently of UI layout. */
const emptyExtensions: readonly AnyExtension[] = [];
const unresolved: DocumentEditorOptions["resolveUrl"] = async () => ({
  items: [],
});

export function useBetterEditor({
  extensions = emptyExtensions,
  resolveUrl = unresolved,
  referenceBehavior = false,
  slashItems = [],
  ...input
}: UseBetterEditorOptions) {
  const options = {
    ...input,
    extensions,
    referenceBehavior,
    resolveUrl,
    slashItems,
  };
  const latest = useRef(options);
  latest.current = options;
  const host = useRef<HTMLDivElement>(null);
  const configured = useRef(options.extensions);
  const [editor, setEditor] = useState<Editor>();
  const [error, setError] = useState(false);
  const [cause, setCause] = useState<unknown>();
  const [callbackError, setCallbackError] = useState<unknown>();
  const [configurationError, setConfigurationError] = useState<Error>();
  const { resetKey } = options;
  const editable = options.editable ?? true;

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey deliberately owns engine lifetime; other options are live refs or mount-time configuration.
  useEffect(() => {
    const currentOptions = latest.current;
    configured.current = currentOptions.extensions;
    setError(false);
    setCause(undefined);
    setCallbackError(undefined);
    setConfigurationError(undefined);
    let current: Editor | undefined;
    try {
      current = createDocumentEditor({
        ...currentOptions,
        attributes: {
          "aria-label":
            (currentOptions.editable ?? true)
              ? "Document editor"
              : "Document content",
          class: "better-editor-tiptap min-h-32 outline-none",
        },
        editable: currentOptions.editable ?? true,
        element: host.current ?? document.createElement("div"),
        normalizeReferenceUrl: (url) =>
          latest.current.normalizeReferenceUrl?.(url) ?? url,
        onCommit: (blocks, operations) => {
          latest.current.onCommit?.(blocks, operations);
          setCallbackError((previous: unknown) =>
            previous === undefined ? previous : undefined,
          );
        },
        onCommitError: (failure) => {
          setCallbackError(failure);
          latest.current.onCommitError?.(failure);
        },
        onError: (failure) => {
          setError(true);
          setCause(failure);
          latest.current.onError?.(failure);
        },
        openLink: (href) => latest.current.openLink?.(href),
        resolveUrl: (url) => latest.current.resolveUrl(url),
      });
      setEditor(current);
    } catch (failure) {
      setEditor(undefined);
      setError(true);
      setCause(failure);
      latest.current.onError?.(failure);
    }
    return () => current?.destroy();
  }, [resetKey]);

  useEffect(() => {
    const initial = configured.current;
    const changed =
      initial.length !== options.extensions.length ||
      initial.some((item, index) => item !== options.extensions[index]);
    setConfigurationError((previous) =>
      changed
        ? (previous ??
          new Error(
            "Editor extensions are mount-time configuration. Change resetKey to explicitly recreate the editor.",
          ))
        : undefined,
    );
  }, [options.extensions]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || error) return;
    if (editor.isEditable !== editable) editor.setEditable(editable);
    const dom = editor.view.dom;
    dom.setAttribute("role", editable ? "textbox" : "document");
    const label = dom.getAttribute("aria-label");
    if (!label || label === "Document editor" || label === "Document content")
      dom.setAttribute(
        "aria-label",
        editable ? "Document editor" : "Document content",
      );
    if (editable) dom.setAttribute("aria-multiline", "true");
    else dom.removeAttribute("aria-multiline");
  }, [editor, editable, error]);

  useEffect(() => {
    if (editor) latest.current.onReady?.(editor);
  }, [editor]);

  return {
    callbackError,
    cause,
    configurationError,
    editor,
    error,
    host,
    retryCommit: () => (editor && !error ? retryEditorCommit(editor) : false),
  };
}
