"use client";

import type { Folder } from "@acme/db/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  collectDescendantNodeIds,
  getLoadedTreeItems,
  type NestedPagesInfiniteData,
  prependItems,
  type QuerySnapshot,
  removeNode,
  restoreQueries,
  seedEmptyContainer,
  setNodeParent,
  snapshotQueries,
  snapshotQuery,
  type TreeChildrenInfiniteData,
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

const ROOT_FOLDER_OPTION = "__root__";

type DeleteStrategy = "delete_all" | "move";

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
  const [strategy, setStrategy] = useState<DeleteStrategy>("delete_all");
  const [moveToFolderId, setMoveToFolderId] = useState(ROOT_FOLDER_OPTION);
  const { data: folders = [] } = useQuery(
    trpc.folders.getByUser.queryOptions(),
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
      onMutate: async (variables) => {
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

        if (variables.strategy === "delete_all") {
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
        }

        if (variables.strategy === "move") {
          const destinationParentNodeId =
            variables.move_to_parent_node_id ?? null;
          const sourceChildrenQueryKey = getContainerQueryKey(folderNodeId);

          const sourceChildren =
            queryClient
              .getQueryData<TreeChildrenInfiniteData>(sourceChildrenQueryKey)
              ?.pages.flatMap((page) => page.items) ?? [];

          removeNode({
            nodeId: folderNodeId,
            queryClient,
            queryFilter: treeQueryFilter,
          });

          for (const child of sourceChildren) {
            removeNode({
              nodeId: child.node_id,
              queryClient,
              queryFilter: treeQueryFilter,
            });
          }

          prependItems({
            items: sourceChildren.map((child) =>
              setNodeParent({
                item: child,
                parentNodeId: destinationParentNodeId,
              }),
            ),
            queryClient,
            queryKey: getContainerQueryKey(destinationParentNodeId),
          });

          seedEmptyContainer({
            queryClient,
            queryKey: sourceChildrenQueryKey,
          });

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
                  items: page.items.map((item) => {
                    if (item.parent_node_id !== folderNodeId) {
                      return item;
                    }

                    return {
                      ...item,
                      parent_node_id: destinationParentNodeId,
                    };
                  }),
                })),
              };
            },
          );

          queryClient.setQueryData(
            foldersByUserQueryKey,
            (old) =>
              old?.filter((currentFolder) => currentFolder.id !== folder.id) ??
              old,
          );
        }

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

      if (!nextOpen) {
        setStrategy("delete_all");
        setMoveToFolderId(ROOT_FOLDER_OPTION);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const destinationFolders = useMemo(() => {
    return folders.filter((currentFolder) => {
      return currentFolder.id !== folder.id;
    });
  }, [folders, folder.id]);

  const showLoading = useMemo(
    () => isPending || isDeleting,
    [isDeleting, isPending],
  );
  const folderDetailsPath = `/pages/folders/${folder.id}`;

  const confirmDelete = useCallback(() => {
    startTransition(() => {
      deleteFolder(
        {
          folder_id: folder.id,
          move_to_parent_node_id:
            strategy === "move"
              ? moveToFolderId === ROOT_FOLDER_OPTION
                ? null
                : (folders.find((item) => item.id === moveToFolderId)
                    ?.node_id ?? null)
              : undefined,
          strategy,
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
    folders,
    moveToFolderId,
    pathname,
    router,
    setDialogOpen,
    strategy,
  ]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {children}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Choose whether to delete all nested content or move direct child
            pages and folders before deleting{" "}
            {folder.name ? `"${folder.name}"` : "this folder"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="font-medium text-sm">Delete strategy</div>
            <Select
              value={strategy}
              onValueChange={(value) => {
                setStrategy(value as DeleteStrategy);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete_all">
                  Delete all nested content
                </SelectItem>
                <SelectItem value="move">Move direct children first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {strategy === "move" && (
            <div className="grid gap-2">
              <div className="font-medium text-sm">Move direct children to</div>
              <Select value={moveToFolderId} onValueChange={setMoveToFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_FOLDER_OPTION}>Root</SelectItem>
                  {destinationFolders.map((destinationFolder) => (
                    <SelectItem
                      key={destinationFolder.id}
                      value={destinationFolder.id}
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="size-3.5" />
                        {destinationFolder.name || "New folder"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

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
