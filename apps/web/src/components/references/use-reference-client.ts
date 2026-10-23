"use client";
import type {
  ReferenceClient,
  ReferenceEmbedResult,
  ReferencePreviewData,
  ReferenceTarget,
} from "@acme/references";
import { QueryObserver, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTRPC } from "~/trpc/react";

/** App-owned queries and navigation; editor packages receive only this interface. */
export function useReferenceClient(): ReferenceClient {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMemo<ReferenceClient>(
    () => ({
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
      openTarget(target: ReferenceTarget, href?: string) {
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
      resolveUrl(url) {
        return queryClient.fetchQuery(
          trpc.references.resolveUrls.queryOptions({ urls: [url] }),
        );
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
    [queryClient, router, trpc],
  );
}
