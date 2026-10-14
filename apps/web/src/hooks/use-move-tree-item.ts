"use client";

import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { getLoadedTreeItems, moveNode } from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";

export function useMoveTreeItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const treeFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const pending = useIsMutating({
    mutationKey: trpc.tree.moveItem.mutationKey(),
  });
  const loadedItems = useCallback(
    () =>
      getLoadedTreeItems({
        queryClient,
        queryFilter: trpc.tree.getChildrenPaginated.infiniteQueryFilter(),
      }),
    [queryClient, trpc],
  );
  const mutation = useMutation(
    trpc.tree.moveItem.mutationOptions({
      onError: () =>
        toast.error("Couldn't save the item order. Please try again."),
      onMutate: async (variables) => {
        await queryClient.cancelQueries(treeFilter);
        moveNode({
          destination: variables.destination,
          getContainerQueryKey: (parentId) =>
            trpc.tree.getChildrenPaginated.infiniteQueryKey(
              getInfiniteSidebarTreeQueryOptions(parentId),
            ),
          nodeId: variables.node_id,
          queryClient,
          queryFilter: treeFilter,
        });
      },
      onSettled: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.tree.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.folders.pathKey() }),
          queryClient.invalidateQueries({
            queryKey: trpc.pages.getById.pathKey(),
          }),
        ]);
      },
      // Serialize saves from both views. Reconcile with the server instead of restoring
      // whole-query snapshots that may predate another successful create/delete.
      scope: { id: "tree-order" },
    }),
  );
  return {
    ...mutation,
    isPending: mutation.isPending || pending > 0,
    loadedItems,
  };
}
