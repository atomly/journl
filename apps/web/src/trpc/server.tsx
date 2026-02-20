import type { ApiRouter } from "@acme/api";
import { apiRouter, createTRPCContext, embedderRouter } from "@acme/api";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { ResolverDef, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "~/auth/server";
import { startDocumentEmbeddingTaskWorkflow } from "~/workflows/start-document-embedding-task";
import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    auth,
    headers: heads,
    startDocumentEmbeddingTaskWorkflow,
  });
});

const getQueryClient = cache(createQueryClient);

export const api = apiRouter.createCaller(createContext);

export const embedder = embedderRouter.createCaller(createContext);

export const trpc = createTRPCOptionsProxy<ApiRouter>({
  ctx: createContext,
  queryClient: getQueryClient,
  router: apiRouter,
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch<T extends ReturnType<TRPCQueryOptions<ResolverDef>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // biome-ignore lint/suspicious/noExplicitAny: <any is good here>
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
