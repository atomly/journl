"use client";

import {
  type EditorPrimitive,
  type ReferenceEmbedResult,
  type ReferencePreviewData,
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
  type ReferenceRenderTarget,
} from "@acme/blocknote/schema";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { useTRPC } from "~/trpc/react";

export function ReferenceRuntime({
  children,
  editor,
}: {
  children: ReactNode;
  editor: EditorPrimitive;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const adapter = useMemo<ReferenceRenderAdapter>(
    () => ({
      convertBlock(blockId, target, display, label, href) {
        if (display === "link") {
          editor.replaceBlocks(
            [blockId],
            [
              {
                content: [
                  {
                    content: [{ text: label, type: "text" }],
                    href,
                    type: "link",
                  },
                ] as never,
                type: "paragraph",
              },
            ],
          );
          return;
        }
        const props = {
          blockId: target.kind === "document" ? (target.blockId ?? "") : "",
          documentId: target.kind === "document" ? target.documentId : "",
          label,
          resolutionToken: "",
          targetKind: target.kind,
          url: target.kind === "external" ? target.url : href,
          version: 1,
        } as const;
        if (display === "contentEmbed" && target.kind !== "document") return;
        editor.replaceBlocks([blockId], [{ props, type: display }]);
      },
      convertInline(blockId, target, display, label, href) {
        type StoredBlock = {
          id: string;
          content?: unknown;
          children?: StoredBlock[];
        };
        let source: StoredBlock | undefined;
        let root = false;
        const find = (blocks: StoredBlock[], isRoot = true): boolean => {
          for (const block of blocks) {
            if (block.id === blockId) {
              source = block;
              root = isRoot;
              return true;
            }
            if (block.children && find(block.children, false)) return true;
          }
          return false;
        };
        find(editor.document as unknown as StoredBlock[]);
        if (!source || !Array.isArray(source.content)) return;
        const content = source.content as Array<Record<string, unknown>>;
        const index = content.findIndex((item) => {
          if (item.type !== "contentReference") return false;
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
            content: [{ text: label, type: "text" }],
            href,
            type: "link",
          };
          editor.updateBlock(blockId, { content: nextContent as never });
          return;
        }
        if (
          !root ||
          content.length !== 1 ||
          (display === "contentEmbed" && target.kind !== "document")
        )
          return;
        const props = {
          blockId: target.kind === "document" ? (target.blockId ?? "") : "",
          documentId: target.kind === "document" ? target.documentId : "",
          label,
          resolutionToken: "",
          targetKind: "document",
          url: target.kind === "external" ? target.url : href,
          version: 1,
        } as const;
        editor.replaceBlocks([blockId], [{ props, type: display }]);
      },
      async loadEmbedContent(target, cursor) {
        const result = await queryClient.fetchQuery({
          ...trpc.references.getEmbedContent.queryOptions({
            cursor,
            targets: [target],
          }),
          staleTime: 30_000,
        });
        const item = result.items[0] as ReferenceEmbedResult | undefined;
        if (item?.status !== "ready") return { status: "unavailable" };
        return {
          ...item,
          nextCursor: result.nextCursor,
        };
      },
      async loadPreview(target) {
        const { items } = await queryClient.fetchQuery({
          ...trpc.references.getPreviews.queryOptions({ targets: [target] }),
          staleTime: 30_000,
        });
        return (
          (items[0]?.preview as ReferencePreviewData | undefined) ?? {
            status: "unavailable",
          }
        );
      },
      openTarget(target: ReferenceRenderTarget, href?: string) {
        const destination =
          href ??
          (target.kind === "external"
            ? target.url
            : `/pages/${target.documentId}`);
        if (target.kind === "external") {
          window.open(destination, "_blank", "noopener,noreferrer");
        } else {
          window.location.assign(destination);
        }
      },
    }),
    [editor, queryClient, trpc],
  );

  return (
    <ReferenceRenderContext.Provider value={adapter}>
      {children}
    </ReferenceRenderContext.Provider>
  );
}
