"use client";

import type { Folder } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FolderPlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSidebar } from "~/components/ui/sidebar";
import { cn } from "~/lib/cn";
import {
  findNodeInQueries,
  insertItem,
  type QuerySnapshot,
  restoreQueries,
  seedEmptyContainer,
  snapshotQueries,
  type TreeItem,
  updateNode,
} from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { DeleteFolderDialog } from "./delete-folder-button";

type AppSidebarTreeActionsProps = {
  className?: string;
  folder?: Folder;
  kind: "folder" | "root";
  onCreateStart?: () => void;
  onCreateSuccess?: () => void;
  parentNodeId: string | null;
  triggerMode?: "direct-page" | "menu";
  triggerVariant?: "empty-state" | "inline" | "sidebar";
};

type CreateMutationContext = {
  optimisticNodeId: string;
  treeSnapshots: QuerySnapshot[];
};

export function AppSidebarTreeActions({
  className,
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
  const createFolderContextRef = useRef<CreateMutationContext | null>(null);
  const createPageContextRef = useRef<CreateMutationContext | null>(null);
  const { isMobile, setOpenMobile } = useSidebar();
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();

  const getContainerQueryKey = (targetParentNodeId: string | null) => {
    return trpc.tree.getChildrenPaginated.infiniteQueryOptions(
      getInfiniteSidebarTreeQueryOptions(targetParentNodeId),
    ).queryKey;
  };

  const { mutate: createFolder, isPending: isCreatingFolder } = useMutation(
    trpc.tree.createFolder.mutationOptions({
      onError: (error) => {
        const context = createFolderContextRef.current;
        if (context) {
          restoreQueries({
            queryClient,
            snapshots: context.treeSnapshots,
          });
        }
        createFolderContextRef.current = null;

        console.error("Failed to create folder:", error);
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries(treeQueryFilter);

        const treeSnapshots = snapshotQueries({
          queryClient,
          queryFilter: treeQueryFilter,
        });

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

        createFolderContextRef.current = {
          optimisticNodeId,
          treeSnapshots,
        };
      },
      onSuccess: (newFolder, variables) => {
        const context = createFolderContextRef.current;
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
        createFolderContextRef.current = null;

        seedEmptyContainer({
          queryClient,
          queryKey: getContainerQueryKey(newFolder.node_id),
        });
      },
    }),
  );

  const { mutate: createPage, isPending: isCreatingPage } = useMutation(
    trpc.tree.createPage.mutationOptions({
      onError: (error) => {
        const context = createPageContextRef.current;
        if (context) {
          restoreQueries({
            queryClient,
            snapshots: context.treeSnapshots,
          });
        }
        createPageContextRef.current = null;

        console.error("Failed to create page:", error);
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries(treeQueryFilter);

        const treeSnapshots = snapshotQueries({
          queryClient,
          queryFilter: treeQueryFilter,
        });

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
        } satisfies TreeItem;

        insertItem({
          anchorEdgeId: variables.destination.anchor_edge_id,
          item: optimisticItem,
          position: variables.destination.position,
          queryClient,
          queryKey: getContainerQueryKey(parentId),
        });

        createPageContextRef.current = {
          optimisticNodeId,
          treeSnapshots,
        };
      },
      onSuccess: (newPage, variables) => {
        const context = createPageContextRef.current;
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
        }
        createPageContextRef.current = null;
      },
    }),
  );

  const showLoading = isPending || isCreatingFolder || isCreatingPage;

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
          "h-8 w-full justify-start gap-2 rounded-md border border-dashed border-sidebar-border/80 px-3 text-sidebar-foreground/80 shadow-none hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground",
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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Add item"
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
          <Plus className="size-3.5" />
          {triggerVariant === "empty-state" ? <span>Add content</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isMobile ? "bottom" : "right"}
        sideOffset={6}
      >
        <DropdownMenuItem
          onSelect={() => {
            handleCreatePage();
          }}
          disabled={showLoading}
        >
          <FilePlus2 />
          New page
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            handleCreateFolder();
          }}
          disabled={showLoading}
        >
          <FolderPlus />
          New folder
        </DropdownMenuItem>
        {kind === "folder" ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 />
            Delete folder
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
