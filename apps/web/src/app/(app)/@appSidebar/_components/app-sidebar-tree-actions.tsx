"use client";

import type { Folder } from "@acme/db/schema";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FilePlus2,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAppEventEmitter } from "~/components/events/app-event-context";
import { useSidebar } from "~/components/ui/sidebar";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useTreeItemMoves } from "~/hooks/use-tree-item-moves";
import { cn } from "~/lib/cn";
import {
  findNodeInQueries,
  insertItem,
  removeNode,
  seedEmptyContainer,
  type TreeItem,
  updateNode,
} from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { DeleteFolderDialog } from "./delete-folder-button";

type AppSidebarTreeActionsProps = {
  className?: string;
  disabled?: boolean;
  folder?: Folder;
  kind: "folder" | "root";
  onCreateStart?: () => void;
  onCreateSuccess?: () => void;
  parentNodeId: string | null;
  triggerMode?: "direct-page" | "menu";
  triggerVariant?: "empty-state" | "inline" | "sidebar";
};

export function AppSidebarTreeActions({
  className,
  disabled = false,
  folder,
  kind,
  onCreateStart,
  onCreateSuccess,
  parentNodeId,
  triggerMode = "menu",
  triggerVariant = "sidebar",
}: AppSidebarTreeActionsProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const eventEmitter = useAppEventEmitter();
  const moves = useTreeItemMoves(
    folder?.node_id
      ? {
          label: folder.name || "New folder",
          node_id: folder.node_id,
          parent_node_id: folder.parent_node_id ?? null,
        }
      : undefined,
  );

  const getContainerQueryKey = (targetParentNodeId: string | null) => {
    return trpc.tree.getChildrenPaginated.infiniteQueryKey(
      getInfiniteSidebarTreeQueryOptions(targetParentNodeId),
    );
  };

  const { mutate: createFolder, isPending: isCreatingFolder } = useMutation(
    trpc.tree.createFolder.mutationOptions<{ optimisticNodeId: string }>({
      onError: (error, _variables, context) => {
        if (context) {
          removeNode({
            nodeId: context.optimisticNodeId,
            queryClient,
            queryFilter: treeQueryFilter,
          });
        }

        console.error("Failed to create folder:", error);
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries(treeQueryFilter);

        const optimisticNodeId = crypto.randomUUID();
        const optimisticEdgeId = crypto.randomUUID();
        const optimisticFolderId = crypto.randomUUID();
        const now = new Date().toISOString();
        const parentId = variables.destination.parent_node_id;

        const optimisticItem = {
          edge_id: optimisticEdgeId,
          folder: {
            created_at: now,
            edge_id: optimisticEdgeId,
            id: optimisticFolderId,
            name: variables.name,
            node_id: optimisticNodeId,
            parent_node_id: parentId,
            updated_at: now,
            user_id: "",
          },
          kind: "folder",
          node_id: optimisticNodeId,
          parent_node_id: parentId,
          pending: true,
        } satisfies TreeItem;

        insertItem({
          anchorEdgeId: variables.destination.anchor_edge_id,
          item: optimisticItem,
          position: variables.destination.position,
          queryClient,
          queryKey: getContainerQueryKey(parentId),
        });
        seedEmptyContainer({
          queryClient,
          queryKey: getContainerQueryKey(optimisticNodeId),
        });

        return { optimisticNodeId };
      },
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries(treeQueryFilter),
          queryClient.invalidateQueries({ queryKey: trpc.folders.pathKey() }),
        ]),
      onSuccess: (newFolder, variables, context) => {
        if (context) {
          const optimisticNode = findNodeInQueries({
            nodeId: context.optimisticNodeId,
            queryClient,
            queryFilter: treeQueryFilter,
          });

          if (optimisticNode) {
            updateNode({
              nodeId: context.optimisticNodeId,
              queryClient,
              queryFilter: treeQueryFilter,
              updater: () => newFolder,
            });
          } else {
            insertItem({
              anchorEdgeId: variables.destination.anchor_edge_id,
              item: newFolder,
              position: variables.destination.position,
              queryClient,
              queryKey: getContainerQueryKey(
                variables.destination.parent_node_id,
              ),
            });
          }
        }

        seedEmptyContainer({
          queryClient,
          queryKey: getContainerQueryKey(newFolder.node_id),
        });
      },
    }),
  );

  const { mutate: createPage, isPending: isCreatingPage } = useMutation(
    trpc.tree.createPage.mutationOptions<{ optimisticNodeId: string }>({
      onError: (error, _variables, context) => {
        if (context) {
          removeNode({
            nodeId: context.optimisticNodeId,
            queryClient,
            queryFilter: treeQueryFilter,
          });
        }

        console.error("Failed to create page:", error);
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries(treeQueryFilter);

        const optimisticNodeId = crypto.randomUUID();
        const optimisticEdgeId = crypto.randomUUID();
        const optimisticPageId = crypto.randomUUID();
        const optimisticDocumentId = crypto.randomUUID();
        const now = new Date().toISOString();
        const parentId = variables.destination.parent_node_id;

        const optimisticItem = {
          edge_id: optimisticEdgeId,
          kind: "page",
          node_id: optimisticNodeId,
          page: {
            created_at: now,
            document_id: optimisticDocumentId,
            edge_id: optimisticEdgeId,
            id: optimisticPageId,
            node_id: optimisticNodeId,
            parent_node_id: parentId,
            title: variables.title,
            updated_at: now,
            user_id: "",
          },
          parent_node_id: parentId,
          pending: true,
        } satisfies TreeItem;

        insertItem({
          anchorEdgeId: variables.destination.anchor_edge_id,
          item: optimisticItem,
          position: variables.destination.position,
          queryClient,
          queryKey: getContainerQueryKey(parentId),
        });

        return { optimisticNodeId };
      },
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries(treeQueryFilter),
          queryClient.invalidateQueries({ queryKey: trpc.folders.pathKey() }),
        ]),
      onSuccess: (newPage, variables, context) => {
        if (context) {
          const optimisticNode = findNodeInQueries({
            nodeId: context.optimisticNodeId,
            queryClient,
            queryFilter: treeQueryFilter,
          });

          if (optimisticNode) {
            updateNode({
              nodeId: context.optimisticNodeId,
              queryClient,
              queryFilter: treeQueryFilter,
              updater: () => newPage,
            });
          } else {
            insertItem({
              anchorEdgeId: variables.destination.anchor_edge_id,
              item: newPage,
              position: variables.destination.position,
              queryClient,
              queryKey: getContainerQueryKey(
                variables.destination.parent_node_id,
              ),
            });
          }

          eventEmitter.buffer(
            new PageCreatedEvent({
              id: newPage.page.id,
              title: newPage.page.title,
            }),
          );
        }
      },
    }),
  );

  const showLoading =
    disabled || isPending || isCreatingFolder || isCreatingPage;

  const handleCreateFolder = () => {
    onCreateStart?.();

    startTransition(() => {
      createFolder(
        {
          destination: {
            parent_node_id: parentNodeId,
          },
          name: "New folder",
        },
        {
          onSuccess: () => {
            onCreateSuccess?.();
          },
        },
      );
    });
  };

  const handleCreatePage = () => {
    onCreateStart?.();

    startTransition(() => {
      createPage(
        {
          destination: {
            parent_node_id: parentNodeId,
          },
          title: "",
        },
        {
          onSuccess: (newPage) => {
            onCreateSuccess?.();

            if (kind === "folder") {
              return;
            }

            if (isMobile) {
              setOpenMobile(false);
            }

            router.push(`/pages/${newPage.page.id}`);
          },
        },
      );
    });
  };

  if (triggerMode === "direct-page") {
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-8 w-full justify-start gap-2 rounded-md border border-sidebar-border/80 border-dashed px-3 text-sidebar-foreground/80 shadow-none hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground",
          className,
        )}
        onClick={handleCreatePage}
        disabled={showLoading}
      >
        {showLoading ? (
          <Plus className="size-3.5 animate-pulse" />
        ) : (
          <Plus className="size-3.5 shrink-0" />
        )}
        <span>New page</span>
      </Button>
    );
  }

  const menu = (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={
              folder ? `Actions for ${folder.name || "New folder"}` : "Add item"
            }
            variant="ghost"
            size={triggerVariant === "empty-state" ? "default" : "sm"}
            className={cn(
              triggerVariant === "sidebar"
                ? "absolute top-1/2 right-1.5 z-10 h-6 w-6 -translate-y-1/2 rounded-sm p-0 text-sidebar-foreground transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden md:pointer-events-none md:opacity-0 md:group-hover/tree-row:pointer-events-auto md:group-hover/tree-row:opacity-100 md:group-focus-within/tree-row:pointer-events-auto md:group-focus-within/tree-row:opacity-100"
                : triggerVariant === "empty-state"
                  ? "h-10 rounded-full px-4 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  : "h-8 w-8 rounded-md p-0",
              className,
            )}
            onClick={(event) => {
              event.stopPropagation();
            }}
            disabled={showLoading}
          >
            {folder ? (
              <MoreHorizontal className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {triggerVariant === "empty-state" ? <span>Add content</span> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side={isMobile ? "bottom" : "right"}
          sideOffset={6}
        >
          <DropdownMenuItem
            onClick={() => {
              handleCreatePage();
            }}
            disabled={showLoading}
          >
            <FilePlus2 />
            New page
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              handleCreateFolder();
            }}
            disabled={showLoading}
          >
            <FolderPlus />
            New folder
          </DropdownMenuItem>
          {moves.menuItems}
          {kind === "folder" ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 />
              Delete folder
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  if (kind !== "folder" || !folder) {
    return menu;
  }

  return (
    <DeleteFolderDialog
      folder={folder}
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
    >
      {menu}
    </DeleteFolderDialog>
  );
}
