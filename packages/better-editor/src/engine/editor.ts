import {
  type DocumentBlock,
  type DocumentOperation,
  parseBlock,
} from "@acme/document";
import {
  getPlainUrlForAutomaticReference,
  type ReferenceClient,
} from "@acme/references";
import { type AnyExtension, Editor, Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { clipboardText } from "../serialization/clipboard";
import {
  createDocumentReader,
  toTiptapDocument,
} from "../serialization/tiptap";
import { diffDocumentSnapshots } from "./changes";
import { clipboardPasteExtension } from "./clipboard-paste";
import { editingExtension } from "./commands";
import { identityExtension } from "./identity";
import { insertTiptapReference } from "./reference-insertion";
import { referenceSelectionPlugin } from "./reference-selection";
import { documentExtensions, safeEditorUrl } from "./schema";
import { type SlashMenuItem, setSlashItems } from "./slash-items";
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
  onError?: (error: unknown) => void;
  onCommitError?: (error: unknown) => void;
  editable?: boolean;
  slashItems?: readonly SlashMenuItem[];
  referenceBehavior?: boolean;
  openLink?: (href: string) => void;
  normalizeReferenceUrl?: (url: string) => string;
};

const commitRetries = new WeakMap<Editor, () => boolean>();
/** Retries the latest valid snapshot after a synchronous consumer callback failure. */
export function retryEditorCommit(editor: Editor): boolean {
  return !editor.isDestroyed && (commitRetries.get(editor)?.() ?? false);
}

/** Creates the Tiptap engine. The caller owns its presentation and destruction. */
export function createDocumentEditor({
  element,
  initialBlocks,
  onCommit,
  resolveUrl,
  extensions,
  attributes = {},
  onError,
  onCommitError,
  editable = Boolean(onCommit),
  openLink,
  normalizeReferenceUrl,
  slashItems,
  referenceBehavior = true,
}: DocumentEditorOptions) {
  const blocks = initialBlocks?.length
    ? initialBlocks
    : [{ id: crypto.randomUUID(), type: "paragraph" as const }];
  let previous: readonly DocumentBlock[] = (initialBlocks ?? []).map(
    parseBlock,
  );
  const readDocument = createDocumentReader();
  let pending: readonly DocumentBlock[] | undefined;
  let delivering = false;
  const deliver = (updated: Editor): boolean => {
    if (delivering) return false;
    delivering = true;
    try {
      while (pending) {
        const next = pending;
        pending = undefined;
        let operations: DocumentOperation[];
        try {
          operations = diffDocumentSnapshots(previous, next);
        } catch (error) {
          updated.setEditable(false, false);
          onError?.(error);
          return false;
        }
        if (operations.length) {
          try {
            onCommit?.(
              structuredClone(next) as DocumentBlock[],
              structuredClone(operations),
            );
          } catch (error) {
            // Keep the last delivered baseline so the next attempt includes any
            // missed edits. Reentrant updates may have supplied a newer snapshot.
            pending ??= next;
            onCommitError?.(error);
            return false;
          }
        }
        previous = next;
      }
      return true;
    } finally {
      delivering = false;
    }
  };
  const defaults = documentExtensions();
  const editor = new Editor({
    content: toTiptapDocument(blocks).toJSON(),
    editable,
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
            !event.target.closest("a[data-better-editor-link]")
          )
            return false;
          event.preventDefault();
          return true;
        },
        dblclick: (view, event) => {
          if (!view.editable || !(event.target instanceof Element))
            return false;
          const anchor = event.target.closest<HTMLAnchorElement>(
            "a[data-better-editor-link]",
          );
          const href =
            anchor && safeEditorUrl(anchor.getAttribute("href") ?? "");
          if (!href || !openLink) return false;
          event.preventDefault();
          openLink(href);
          return true;
        },
        keydown: (view, event) =>
          view.composing || event.isComposing || event.keyCode === 229,
      },
      handleDrop: (view, event, _slice, moved) => {
        // A stale table-axis gesture must not become a clipboard copy.
        if (
          event.dataTransfer?.types.includes(
            "application/x-better-editor-table-axis",
          )
        )
          return true;
        if (moved || !referenceBehavior) return false;
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
        return insertTiptapReference(
          view,
          url,
          (value) => resolveUrl(value),
          "",
          undefined,
          normalizeReferenceUrl,
        );
      },
      handlePaste: (view, event) => {
        if (!referenceBehavior) return false;
        const url = getPlainUrlForAutomaticReference({
          html: event.clipboardData?.getData("text/html") ?? "",
          selectionEmpty: view.state.selection.empty,
          text: event.clipboardData?.getData("text/plain") ?? "",
        });
        return Boolean(
          url &&
            insertTiptapReference(
              view,
              url,
              (value) => resolveUrl(value),
              "",
              undefined,
              normalizeReferenceUrl,
            ),
        );
      },
    },
    element,
    enableContentCheck: true,
    extensions: [
      ...defaults.map(
        (base) =>
          extensions.find((extension) => extension.name === base.name) ?? base,
      ),
      ...extensions.filter(
        (extension) => !defaults.some((base) => base.name === extension.name),
      ),
      clipboardPasteExtension(() => crypto.randomUUID()),
      editingExtension(() => crypto.randomUUID()),
      writingExtension(() => crypto.randomUUID()),
      suggestionExtension(() => crypto.randomUUID()),
      identityExtension(() => crypto.randomUUID()),
      Extension.create({
        addProseMirrorPlugins: () => [referenceSelectionPlugin()],
        name: "better-editor-references",
      }),
    ],
    onUpdate: ({ editor: updated }) => {
      try {
        pending = readDocument(updated.state.doc);
      } catch (error) {
        updated.setEditable(false, false);
        onError?.(error);
        return;
      }
      deliver(updated);
    },
  });
  commitRetries.set(editor, () => deliver(editor));
  editor.on("destroy", () => commitRetries.delete(editor));
  if (slashItems)
    setSlashItems(editor, {
      enabled: slashItems.length > 0,
      items: slashItems,
    });
  return editor;
}
