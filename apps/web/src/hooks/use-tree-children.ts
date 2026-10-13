"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { TreeItem } from "~/lib/tree-model";
import {
  restartTreePagination,
  type TreeChildrenInfiniteData,
} from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";

export function useTreeChildren({
  enabled = true,
  parentNodeId,
}: {
  enabled?: boolean;
  parentNodeId: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryOptions = trpc.tree.getChildrenPaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentNodeId),
    {
      getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    },
  );
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery({ ...queryOptions, enabled });
  const normalized = data ? restartTreePagination(data) : undefined;
  // Replace stale earlier pages before presenting content, then continue from
  // the fresh revision while preserving the InfiniteData page/parameter pairing.
  useEffect(() => {
    if (normalized && normalized !== data) {
      queryClient.setQueryData<TreeChildrenInfiniteData>(
        queryOptions.queryKey,
        normalized,
      );
    }
  }, [data, normalized, queryClient, queryOptions.queryKey]);
  const items = (normalized?.pages.flatMap((page) => page.items) ??
    []) as TreeItem[];
  const shouldShowInitialSkeleton = items.length === 0 && isPending;
  useEffect(() => {
    if (
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === "undefined" ||
      !loadMoreRef.current
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  return {
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    items,
    loadMoreRef,
    shouldRenderNestedContent:
      shouldShowInitialSkeleton ||
      items.length > 0 ||
      isFetchingNextPage ||
      !!hasNextPage,
    shouldShowInitialSkeleton,
  };
}
