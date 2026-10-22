"use client";

import type { DocumentBlock, DocumentOperation } from "@acme/document";
import {
  captureLink,
  convertReference,
  documentChanges,
  documentExtensions,
  duplicateSelectedBlock,
  editingExtension,
  fromTiptapDocument,
  identityExtension,
  indentBlock,
  referenceSelectionPlugin,
  selectedBlock,
  toggleTextMark,
  toTiptapDocument,
} from "@acme/tiptap";
import { useQueryClient } from "@tanstack/react-query";
import { Editor, Extension } from "@tiptap/core";
import { redo, undo } from "@tiptap/pm/history";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { getPlainUrlForAutomaticReference } from "~/references/reference-paste-url";
import { useTRPC } from "~/trpc/react";
import { insertTiptapReference } from "./tiptap-reference-insertion";
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
  const [referenceUrl, setReferenceUrl] = useState("");
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
            "aria-label": "Document editor",
            "aria-multiline": "true",
            class: "journl-tiptap min-h-32 px-8 py-3 outline-none",
            role: "textbox",
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
          editingExtension(() => crypto.randomUUID()),
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
  }, []);
  const run = (action: (editor: Editor) => void) => {
    if (!editor || error) return;
    action(editor);
    editor.view.focus();
  };
  return (
    <section className={cn("min-w-0", className)} data-editor-frontend="tiptap">
      {children}
      {error && (
        <p role="alert" className="px-8 text-destructive">
          This content could not be edited safely. Your last valid draft is
          still available in save details.
        </p>
      )}
      {onCommit && (
        <div
          className="flex flex-wrap items-center gap-1 px-8"
          role="toolbar"
          aria-label="Editor controls"
        >
          {(["bold", "italic", "underline", "strike", "code"] as const).map(
            (mark) => (
              <Button
                key={mark}
                size="sm"
                variant="ghost"
                disabled={error || !editor}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  run((value) => {
                    const transaction = toggleTextMark(value.state, mark);
                    if (transaction) value.view.dispatch(transaction);
                  })
                }
              >
                {mark.charAt(0).toUpperCase() + mark.slice(1)}
              </Button>
            ),
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              run((value) => {
                undo(value.state, value.view.dispatch);
              })
            }
          >
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              run((value) => {
                redo(value.state, value.view.dispatch);
              })
            }
          >
            Redo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              run((value) => {
                const tr = duplicateSelectedBlock(value.state, () =>
                  crypto.randomUUID(),
                );
                if (tr) value.view.dispatch(tr);
              })
            }
          >
            Duplicate block
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              run((value) => {
                const tr = indentBlock(value.state);
                if (tr) value.view.dispatch(tr);
              })
            }
          >
            Indent
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              run((value) => {
                const tr = indentBlock(value.state, true);
                if (tr) value.view.dispatch(tr);
              })
            }
          >
            Outdent
          </Button>
          <select
            aria-label="Block type"
            className="rounded border bg-background p-1 text-sm"
            disabled={error || !editor}
            onChange={(event) =>
              run((value) => {
                const target = selectedBlock(value.state);
                const type = value.schema.nodes[event.target.value];
                if (!target?.node.firstChild?.isTextblock || !type) return;
                const props =
                  event.target.value === "heading" ? { level: 2 } : null;
                const content =
                  event.target.value === "codeBlock"
                    ? target.node.firstChild.textContent
                      ? value.schema.text(target.node.firstChild.textContent)
                      : undefined
                    : target.node.firstChild.content;
                value.view.dispatch(
                  value.state.tr.replaceWith(
                    target.pos + 1,
                    target.pos + target.node.firstChild.nodeSize + 1,
                    type.createChecked({ props }, content),
                  ),
                );
              })
            }
            defaultValue="paragraph"
          >
            {[
              "paragraph",
              "heading",
              "bulletListItem",
              "numberedListItem",
              "checkListItem",
              "toggleListItem",
              "quote",
              "codeBlock",
            ].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            aria-label="Reference URL"
            className="min-w-0 rounded border bg-background p-1 text-sm"
            type="url"
            value={referenceUrl}
            onChange={(event) => setReferenceUrl(event.target.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              run((value) => {
                if (insertTiptapReference(value.view, referenceUrl, resolveUrl))
                  setReferenceUrl("");
              })
            }
          >
            Insert reference
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              run((value) => {
                const link = captureLink(value.state);
                if (link)
                  insertTiptapReference(
                    value.view,
                    link.href,
                    resolveUrl,
                    link.label,
                  );
              })
            }
          >
            Convert selected link
          </Button>
          {(
            [
              "contentReference",
              "referenceCard",
              "contentEmbed",
              "link",
            ] as const
          ).map((display) => (
            <Button
              key={display}
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                run((value) => {
                  const tr = convertReference(value.state, display, () =>
                    crypto.randomUUID(),
                  );
                  if (tr) value.view.dispatch(tr);
                })
              }
            >
              {display === "contentReference"
                ? "Badge"
                : display === "referenceCard"
                  ? "Card"
                  : display === "contentEmbed"
                    ? "Embed"
                    : "Link"}
            </Button>
          ))}
        </div>
      )}
      <div ref={host} />
    </section>
  );
}
