"use client";

import {
  type EditorPrimitive,
  type ReferenceEmbedResult,
  type ReferencePreviewData,
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
  type ReferenceRenderTarget,
} from "@acme/blocknote/schema";
import { QueryObserver, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const adapter = useMemo<ReferenceRenderAdapter>(
    () => ({
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
                content: [{ text: label, type: "text" }],
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
        type StoredBlock = {
          id: string;
          content?: unknown;
          children?: StoredBlock[];
        };
        let source: StoredBlock | undefined;
        const find = (blocks: StoredBlock[]): boolean => {
          for (const block of blocks) {
            if (block.id === blockId) {
              source = block;
              return true;
            }
            if (block.children && find(block.children)) return true;
          }
          return false;
        };
        find(editor.document as unknown as StoredBlock[]);
        if (!source || !Array.isArray(source.content)) return;
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
            content: [{ text: label, type: "text" }],
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
                  ? [{ content: after as never, type: "paragraph" as const }]
                  : []),
              ],
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
        if (target.kind === "external") {
          window.open(target.url, "_blank", "noopener,noreferrer");
        } else {
          const navigate = (destination: string | undefined) => {
            if (!destination) return;
            try {
              const route = new URL(destination, window.location.origin);
              if (
                /^\/(pages\/[0-9a-f-]{36}|journal\/\d{4}-\d{2}-\d{2})\/?$/i.test(
                  route.pathname,
                )
              )
                router.push(`${route.pathname}${route.search}${route.hash}`);
            } catch {
              /* Unavailable routes do not navigate. */
            }
          };
          if (href) navigate(href);
          else
            void queryClient
              .fetchQuery(
                trpc.references.getPreviews.queryOptions({ targets: [target] }),
              )
              .then(({ items }) => {
                const preview = items[0]?.preview;
                if (preview?.status === "ready") navigate(preview.href);
              })
              .catch(() => {});
        }
      },
      subscribeEmbedContent(target, cursor, listener) {
        const observer = new QueryObserver(queryClient, {
          ...trpc.references.getEmbedContent.queryOptions({
            cursor,
            targets: [target],
          }),
          staleTime: 30_000,
        });
        const receive = (
          result: ReturnType<typeof observer.getCurrentResult>,
        ) => {
          if (result.data) {
            const item = result.data.items[0] as
              | ReferenceEmbedResult
              | undefined;
            listener(
              item?.status === "ready"
                ? { ...item, nextCursor: result.data.nextCursor }
                : { status: "unavailable" },
            );
          } else if (result.isError) listener(null);
        };
        const unsubscribe = observer.subscribe(receive);
        receive(observer.getCurrentResult());
        return () => {
          unsubscribe();
          observer.destroy();
        };
      },
      subscribePreview(target, listener) {
        const observer = new QueryObserver(queryClient, {
          ...trpc.references.getPreviews.queryOptions({ targets: [target] }),
          staleTime: 30_000,
        });
        const unsubscribe = observer.subscribe((result) => {
          if (result.data)
            listener(
              result.data.items[0]?.preview ?? { status: "unavailable" },
            );
          else if (result.isError) listener({ status: "unavailable" });
        });
        const result = observer.getCurrentResult();
        if (result.data)
          listener(result.data.items[0]?.preview ?? { status: "unavailable" });
        return () => {
          unsubscribe();
          observer.destroy();
        };
      },
    }),
    [editor, queryClient, router, trpc],
  );

  return (
    <ReferenceRenderContext.Provider value={adapter}>
      {children}
    </ReferenceRenderContext.Provider>
  );
}
