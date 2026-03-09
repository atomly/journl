"use client";

import type { Folder } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  collectDescendantNodeIds,
  getLoadedTreeItems,
  type NestedPagesInfiniteData,
  type QuerySnapshot,
  removeNode,
  restoreQueries,
  snapshotQueries,
  snapshotQuery,
} from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";

type DeleteFolderDialogProps = {
  folder: Folder;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DeleteFolderDialogTriggerProps = ComponentProps<typeof DialogTrigger>;

type DeleteFolderButtonProps = ComponentProps<typeof Button>;

type DeleteFolderMutationContext = {
  folderByIdSnapshot: QuerySnapshot;
  foldersByUserSnapshot: QuerySnapshot;
  nestedSnapshots: QuerySnapshot[];
  treeSnapshots: QuerySnapshot[];
};

export function DeleteFolderButton({
  className,
  children,
  size = "sm",
  variant = "ghost",
  onClick,
  ...props
}: DeleteFolderButtonProps) {
  return (
    <Button
      aria-label="Delete folder"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? <Trash2 />}
    </Button>
  );
}

export function DeleteFolderDialogTrigger(
  props: DeleteFolderDialogTriggerProps,
) {
  return <DialogTrigger {...props} />;
}

export function DeleteFolderDialog({
  folder,
  children,
  open,
  onOpenChange,
}: DeleteFolderDialogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const deleteFolderContextRef = useRef<DeleteFolderMutationContext | null>(
    null,
  );
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const nestedFolderPagesQueryFilter =
    trpc.tree.getNestedPagesPaginated.infiniteQueryFilter();
  const foldersByUserQueryKey = trpc.folders.getByUser.queryOptions().queryKey;
  const folderByIdQueryKey = trpc.folders.getById.queryOptions({
    id: folder.id,
  }).queryKey;

  const getContainerQueryKey = (targetParentNodeId: string | null) => {
    return trpc.tree.getChildrenPaginated.infiniteQueryOptions(
      getInfiniteSidebarTreeQueryOptions(targetParentNodeId),
    ).queryKey;
  };

  const { mutate: deleteFolder, isPending: isDeleting } = useMutation(
    trpc.tree.deleteFolder.mutationOptions({
      onError: (error) => {
        const context = deleteFolderContextRef.current;
        if (context) {
          restoreQueries({
            queryClient,
            snapshots: context.treeSnapshots,
          });
          restoreQueries({
            queryClient,
            snapshots: context.nestedSnapshots,
          });
          restoreQueries({
            queryClient,
            snapshots: [
              context.foldersByUserSnapshot,
              context.folderByIdSnapshot,
            ],
          });
        }
        deleteFolderContextRef.current = null;

        console.error("Failed to delete folder:", error);
      },
      onMutate: async () => {
        await Promise.all([
          queryClient.cancelQueries(treeQueryFilter),
          queryClient.cancelQueries(nestedFolderPagesQueryFilter),
          queryClient.cancelQueries({ queryKey: foldersByUserQueryKey }),
          queryClient.cancelQueries({ queryKey: folderByIdQueryKey }),
        ]);

        const treeSnapshots = snapshotQueries({
          queryClient,
          queryFilter: treeQueryFilter,
        });
        const nestedSnapshots = snapshotQueries({
          queryClient,
          queryFilter: nestedFolderPagesQueryFilter,
        });
        const foldersByUserSnapshot = snapshotQuery({
          queryClient,
          queryKey: foldersByUserQueryKey,
        });
        const folderByIdSnapshot = snapshotQuery({
          queryClient,
          queryKey: folderByIdQueryKey,
        });

        const folderNodeId = folder.node_id ?? null;

        if (!folderNodeId) {
          queryClient.setQueryData(
            foldersByUserQueryKey,
            (old) =>
              old?.filter((currentFolder) => currentFolder.id !== folder.id) ??
              old,
          );

          queryClient.removeQueries({
            exact: true,
            queryKey: folderByIdQueryKey,
          });

          deleteFolderContextRef.current = {
            folderByIdSnapshot,
            foldersByUserSnapshot,
            nestedSnapshots,
            treeSnapshots,
          };
          return;
        }

        const loadedTreeItems = getLoadedTreeItems({
          queryClient,
          queryFilter: treeQueryFilter,
        });

        const descendantNodeIds = collectDescendantNodeIds({
          items: loadedTreeItems,
          rootNodeId: folderNodeId,
        });

        const folderIdsToRemove = new Set<string>([folder.id]);
        for (const item of loadedTreeItems) {
          if (item.kind === "folder" && descendantNodeIds.has(item.node_id)) {
            folderIdsToRemove.add(item.folder.id);
          }
        }

        for (const nodeId of descendantNodeIds) {
          removeNode({
            nodeId,
            queryClient,
            queryFilter: treeQueryFilter,
          });

          queryClient.removeQueries({
            exact: true,
            queryKey: getContainerQueryKey(nodeId),
          });
        }

        queryClient.setQueriesData(
          nestedFolderPagesQueryFilter,
          (old: NestedPagesInfiniteData | undefined) => {
            if (!old) {
              return old;
            }

            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => {
                  if (!item.parent_node_id) {
                    return true;
                  }

                  return !descendantNodeIds.has(item.parent_node_id);
                }),
              })),
            };
          },
        );

        queryClient.setQueryData(
          foldersByUserQueryKey,
          (old) =>
            old?.filter(
              (currentFolder) => !folderIdsToRemove.has(currentFolder.id),
            ) ?? old,
        );

        queryClient.removeQueries({
          exact: true,
          queryKey: folderByIdQueryKey,
        });

        deleteFolderContextRef.current = {
          folderByIdSnapshot,
          foldersByUserSnapshot,
          nestedSnapshots,
          treeSnapshots,
        };
      },
    }),
  );

  const isControlled = open !== undefined;
  const isDialogOpen = isControlled ? open : uncontrolledOpen;

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const showLoading = useMemo(
    () => isPending || isDeleting,
    [isDeleting, isPending],
  );
  const folderDetailsPath = `/folders/${folder.id}`;

  const confirmDelete = useCallback(() => {
    startTransition(() => {
      deleteFolder(
        {
          folder_id: folder.id,
        },
        {
          onSuccess: () => {
            deleteFolderContextRef.current = null;

            if (pathname === folderDetailsPath) {
              setDialogOpen(false);
              router.push("/journal");
              return;
            }

            setDialogOpen(false);
          },
        },
      );
    });
  }, [
    deleteFolder,
    folderDetailsPath,
    folder.id,
    pathname,
    router,
    setDialogOpen,
  ]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {children}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Deleting {folder.name ? `"${folder.name}"` : "this folder"} will
            permanently delete all nested pages and folders inside it.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDialogOpen(false);
            }}
            disabled={showLoading}
          >
            Cancel
          </Button>
          <Button
            autoFocus
            tabIndex={0}
            variant="destructive"
            onClick={confirmDelete}
            disabled={showLoading}
          >
            {showLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
