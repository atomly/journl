"use client";

import {
  type EditorPrimitive,
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
} from "@acme/blocknote/schema";
import { type ReactNode, useMemo } from "react";
import { useReferenceClient } from "./use-reference-client";

export function ReferenceRuntime({
  children,
  editor,
}: {
  children: ReactNode;
  editor: EditorPrimitive;
}) {
  const references = useReferenceClient();
  const adapter = useMemo<ReferenceRenderAdapter>(
    () => ({
      ...references,
      canConvertInline(blockId) {
        const source = editor.getBlock(blockId);
        return Array.isArray(source?.content);
      },
      convertBlock(blockId, target, display, label, href) {
        if (!editor.isEditable) return;
        if (display === "link") {
          editor.updateBlock(blockId, {
            content: [
              {
                content: [
                  { text: label || href || "Referenced content", type: "text" },
                ],
                href,
                type: "link",
              },
            ] as never,
            type: "paragraph",
          });
          return;
        }
        const props = {
          ...(target.kind === "document"
            ? {
                blockId: target.blockId ?? "",
                documentId: target.documentId,
              }
            : {}),
          label,
          resolutionToken: "",
          targetKind: target.kind,
          url: target.kind === "external" ? target.url : href,
          version: 1,
        } as const;
        if (display === "contentEmbed" && target.kind !== "document") return;
        if (display === "contentReference") {
          editor.updateBlock(blockId, {
            content: [{ props, type: "contentReference" }] as never,
            type: "paragraph",
          });
        } else editor.updateBlock(blockId, { props, type: display });
      },
      convertInline(blockId, target, display, label, href, occurrenceIndex) {
        if (!editor.isEditable) return;
        const source = editor.getBlock(blockId);
        if (!source) return;
        if (!Array.isArray(source.content)) {
          // Tables store cells instead of block.content's inline array. Replace only
          // the selected native inline atom, preserving the complete table shape.
          if (display !== "link") return;
          const { state } = editor._tiptapEditor;
          let selected: { from: number; size: number } | undefined;
          state.doc.descendants((node, position) => {
            if (
              node.type.name !== "blockContainer" ||
              node.attrs.id !== blockId
            )
              return;
            const blockContent = node.firstChild;
            if (!blockContent) return false;
            let ordinal = -1;
            blockContent.descendants((inline, offset) => {
              if (inline.type.name !== "contentReference") return;
              ordinal += 1;
              if (occurrenceIndex !== undefined && ordinal !== occurrenceIndex)
                return;
              const matches =
                target.kind === "document"
                  ? inline.attrs.targetKind === "document" &&
                    inline.attrs.documentId === target.documentId &&
                    (inline.attrs.blockId || "") === (target.blockId ?? "")
                  : inline.attrs.targetKind === "external" &&
                    inline.attrs.url === target.url;
              if (matches && !selected)
                selected = {
                  from: position + 2 + offset,
                  size: inline.nodeSize,
                };
            });
            return false;
          });
          const link = state.schema.marks.link;
          const range = selected;
          if (range && link)
            editor.transact((transaction) =>
              transaction.replaceWith(
                range.from,
                range.from + range.size,
                state.schema.text(label || href, [link.create({ href })]),
              ),
            );
          return;
        }
        const content = source.content as Array<Record<string, unknown>>;
        let referenceIndex = -1;
        const index = content.findIndex((item) => {
          if (item.type !== "contentReference") return false;
          referenceIndex += 1;
          if (
            occurrenceIndex !== undefined &&
            occurrenceIndex !== referenceIndex
          )
            return false;
          const props = item.props as Record<string, unknown> | undefined;
          return target.kind === "document"
            ? props?.targetKind === "document" &&
                props.documentId === target.documentId &&
                (props.blockId || "") === (target.blockId ?? "")
            : props?.targetKind === "external" && props.url === target.url;
        });
        if (index < 0) return;
        if (display === "link") {
          const nextContent = [...content];
          nextContent[index] = {
            content: [
              { text: label || href || "Referenced content", type: "text" },
            ],
            href,
            type: "link",
          };
          editor.updateBlock(blockId, { content: nextContent as never });
          return;
        }
        if (display === "contentEmbed" && target.kind !== "document") return;
        const props = {
          ...(target.kind === "document"
            ? {
                blockId: target.blockId ?? "",
                documentId: target.documentId,
              }
            : {}),
          label,
          resolutionToken: "",
          targetKind: target.kind,
          url: target.kind === "external" ? target.url : href,
          version: 1,
        } as const;
        if (content.length > 1 && display !== "contentReference") {
          const before = content.slice(0, index);
          const after = content.slice(index + 1);
          editor.transact(() => {
            editor.updateBlock(blockId, { content: before as never });
            editor.insertBlocks(
              [
                { props, type: display },
                ...(after.length
                  ? [
                      {
                        content: after as never,
                        props: source.props,
                        type: source.type,
                      },
                    ]
                  : []),
              ] as never,
              blockId,
              "after",
            );
          });
          return;
        }
        if (display === "contentReference") {
          editor.updateBlock(blockId, {
            content: [{ props, type: "contentReference" }] as never,
            type: "paragraph",
          });
        } else editor.updateBlock(blockId, { props, type: display });
      },
      editable: editor.isEditable,
    }),
    [editor, references],
  );

  return (
    <ReferenceRenderContext.Provider value={adapter}>
      {children}
    </ReferenceRenderContext.Provider>
  );
}
