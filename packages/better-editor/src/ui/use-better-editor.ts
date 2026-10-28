"use client";

import type { AnyExtension } from "@tiptap/core";
import {
  type UseDocumentEditorOptions,
  useDocumentEditor,
} from "./use-document-editor";

const emptyExtensions: readonly AnyExtension[] = [];
const unresolved: UseDocumentEditorOptions["resolveUrl"] = async () => ({
  items: [],
});
export type UseBetterEditorOptions = Omit<
  UseDocumentEditorOptions,
  "resolveUrl" | "extensions"
> &
  Partial<Pick<UseDocumentEditorOptions, "resolveUrl" | "extensions">>;

export function useBetterEditor({
  extensions = emptyExtensions,
  resolveUrl = unresolved,
  slashItems = [],
  referenceBehavior = false,
  ...options
}: UseBetterEditorOptions) {
  return useDocumentEditor({
    ...options,
    extensions,
    referenceBehavior,
    resolveUrl,
    slashItems,
  });
}
