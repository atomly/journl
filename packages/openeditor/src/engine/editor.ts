import type { DocumentBlock, DocumentOperation } from "@acme/document";
import {
  getPlainUrlForAutomaticReference,
  type ReferenceClient,
} from "@acme/references";
import { type AnyExtension, Editor, Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { clipboardText } from "../serialization/clipboard";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { documentChanges } from "./changes";
import { clipboardPasteExtension } from "./clipboard-paste";
import { editingExtension } from "./commands";
import { identityExtension } from "./identity";
import { insertTiptapReference } from "./reference-insertion";
import { referenceSelectionPlugin } from "./reference-selection";
import { documentExtensions, safeEditorUrl } from "./schema";
import { suggestionExtension } from "./suggestions";
import { writingExtension } from "./writing-extension";

export type EditorCommit = (
  blocks: DocumentBlock[],
  operations: DocumentOperation[],
) => void;

export type DocumentEditorOptions = {
  element: HTMLElement;
  initialBlocks: readonly DocumentBlock[] | undefined;
  onCommit?: EditorCommit;
  resolveUrl: ReferenceClient["resolveUrl"];
  extensions: readonly AnyExtension[];
  attributes?: Record<string, string>;
  onError?: () => void;
};

/** Creates the Tiptap engine. The caller owns its presentation and destruction. */
export function createDocumentEditor({
  element,
  initialBlocks,
  onCommit,
  resolveUrl,
  extensions,
  attributes = {},
  onError,
}: DocumentEditorOptions) {
  const blocks = initialBlocks?.length
    ? initialBlocks
    : [{ id: crypto.randomUUID(), type: "paragraph" as const }];
  let previous = [...(initialBlocks ?? [])];
  const editor = new Editor({
    content: toTiptapDocument(blocks).toJSON(),
    editable: Boolean(onCommit),
    editorProps: {
      attributes,
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
        return insertTiptapReference(view, url, (value) => resolveUrl(value));
      },
      handlePaste: (view, event) => {
        const url = getPlainUrlForAutomaticReference({
          html: event.clipboardData?.getData("text/html") ?? "",
          selectionEmpty: view.state.selection.empty,
          text: event.clipboardData?.getData("text/plain") ?? "",
        });
        return Boolean(
          url && insertTiptapReference(view, url, (value) => resolveUrl(value)),
        );
      },
    },
    element,
    enableContentCheck: true,
    extensions: [
      ...documentExtensions().map(
        (base) =>
          extensions.find((extension) => extension.name === base.name) ?? base,
      ),
      ...extensions.filter(
        (extension) =>
          !documentExtensions().some((base) => base.name === extension.name),
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
        if (operations.length) onCommit?.(next, operations);
        previous = next;
      } catch {
        updated.setEditable(false, false);
        onError?.();
      }
    },
  });
  return editor;
}
