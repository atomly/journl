"use client";

import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { TreeInsertDropBands } from "~/components/tree-insert-drop-bands";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { useSidebar } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { useTreeChildren } from "~/hooks/use-tree-children";
import { useTreeController } from "~/hooks/use-tree-controller";
import {
  TreeMoveProvider,
  useTreeItemMoves,
} from "~/hooks/use-tree-item-moves";
import { cn } from "~/lib/cn";
import {
  TREE_INSIDE_DROP_ZONE_CLASSNAME,
  TreeDragOverlay,
  TreeEndDropTarget,
} from "~/lib/tree-dnd";
import {
  getBeforeDropId,
  getDragId,
  getInsideDropId,
  getParentDropId,
  type TreeDragData,
  type TreeFolder,
  type TreeItem,
  type TreeItemRef,
  type TreePage,
} from "~/lib/tree-model";
import {
  updateNode,
  updatePageTitleInNestedPages,
} from "~/trpc/cache/tree-cache";
import { useTRPC } from "~/trpc/react";
import { AppSidebarTreeActions } from "../../@appSidebar/_components/app-sidebar-tree-actions";
import { DeleteFolderDialog } from "../../@appSidebar/_components/delete-folder-button";
import { DeletePageDialog } from "../../@appSidebar/_components/delete-page-button";

type FolderTreeInteractions = {
  shouldSuppressClick: () => boolean;
};

const FolderTreeInteractionsContext =
  createContext<FolderTreeInteractions | null>(null);

function useFolderTreeInteractions(): FolderTreeInteractions {
  const ctx = useContext(FolderTreeInteractionsContext);
  if (!ctx) {
    throw new Error(
      "useFolderTreeInteractions must be used within FolderTreeInteractionsProvider",
    );
  }
  return ctx;
}

const TREE_ROW_CLASSNAME =
  "group/tree-row flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors";
const MAX_PAGE_TITLE_LENGTH = 500;
const MAX_FOLDER_TITLE_LENGTH = 500;
const PAGE_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

type FolderNestedPagesListProps = {
  rootParentNodeId?: string | null;
};

type TreeLevelProps = {
  activeDragId: string | null;
  emptyStateVariant?: "root" | "tree";
  enabled?: boolean;
  itemIndentClassName: string;
  isDnDEnabled: boolean;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
};

type FolderTreeData = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: TreeItem[];
  loadMoreRef: RefObject<HTMLDivElement | null>;
  shouldRenderNestedContent: boolean;
  shouldShowInitialSkeleton: boolean;
};

function RootFolderEmptyState({
  isDnDEnabled,
  parentNodeId,
}: {
  isDnDEnabled: boolean;
  parentNodeId: string | null;
}) {
  const dropId = getParentDropId(parentNodeId);
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "-m-2 rounded-[calc(var(--radius-3xl)-2px)] bg-muted/25 px-5 py-6 transition-colors sm:px-6",
        isOver && isDnDEnabled && "bg-primary/6 outline outline-primary/25",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background">
            <FolderClosed className="size-4 text-primary" />
          </div>
          <div className="max-w-lg space-y-1">
            <p className="font-medium text-sm">This folder is empty</p>
            <p className="text-muted-foreground text-sm">
              Add a page or a nested folder to start organizing this space.
            </p>
          </div>
        </div>

        <AppSidebarTreeActions
          kind="folder"
          parentNodeId={parentNodeId}
          triggerVariant="empty-state"
        />
      </div>
    </div>
  );
}

function DraggablePageRow({
  activeDragId,
  isDnDEnabled,
  itemIndentClassName,
  nextEdgeId,
  page,
  parentNodeId,
  showBeforeLine = true,
}: {
  activeDragId: string | null;
  isDnDEnabled: boolean;
  itemIndentClassName: string;
  nextEdgeId?: string;
  page: TreePage;
  parentNodeId: string | null;
  showBeforeLine?: boolean;
}) {
  const { shouldSuppressClick } = useFolderTreeInteractions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(page.title);
  const [titleError, setTitleError] = useState(false);
  const shouldSkipBlurCommitRef = useRef(false);
  const titleVersionRef = useRef(page.updated_at);
  const itemRef: TreeItemRef = {
    kind: "page",
    nodeId: page.node_id,
  };
  const draggableId = getDragId(itemRef);
  const moves = useTreeItemMoves({
    label: page.title || "New page",
    node_id: page.node_id,
    parent_node_id: parentNodeId,
  });
  const pageHref = `/pages/${page.id}`;
  const isActive = pathname === pageHref;
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const nestedFolderPagesQueryFilter =
    trpc.tree.getNestedPagesPaginated.infiniteQueryFilter();
  const { mutate: updatePageTitle } = useMutation(
    trpc.pages.updateTitle.mutationOptions({}),
  );
  const { attributes, listeners, setNodeRef } = useDraggable({
    data: {
      edgeId: page.edge_id,
      item: itemRef,
      label: page.title || "New page",
      parentNodeId,
    } satisfies TreeDragData,
    disabled: !isDnDEnabled || isEditing,
    id: draggableId,
  });

  useEffect(() => {
    if (!isEditing && !titleError) setDraftTitle(page.title);
  }, [page.title, titleError, isEditing]);

  const commitTitle = useCallback(
    (nextTitle: string) => {
      setTitleError(false);
      if (nextTitle === page.title) {
        return;
      }

      const updateCaches = (saved: { updated_at: string }) => {
        queryClient.setQueryData(
          trpc.pages.getById.queryOptions({ id: page.id }).queryKey,
          (old) => {
            if (!old) {
              return old;
            }

            return {
              ...old,
              title: nextTitle,
              updated_at: saved.updated_at,
            };
          },
        );

        updateNode({
          nodeId: page.node_id,
          queryClient,
          queryFilter: treeQueryFilter,
          updater: (item) =>
            item.kind === "page"
              ? {
                  ...item,
                  page: {
                    ...item.page,
                    title: nextTitle,
                    updated_at: saved.updated_at,
                  },
                }
              : item,
        });

        updatePageTitleInNestedPages({
          pageId: page.id,
          queryClient,
          queryFilter: nestedFolderPagesQueryFilter,
          title: nextTitle,
        });
      };
      updatePageTitle(
        {
          expected_updated_at: titleVersionRef.current,
          id: page.id,
          title: nextTitle,
        },
        {
          onError: () => {
            setDraftTitle(nextTitle);
            setIsEditing(true);
            setTitleError(true);
            void queryClient.invalidateQueries({
              queryKey: trpc.pages.getById.queryOptions({ id: page.id })
                .queryKey,
            });
            void queryClient.invalidateQueries(treeQueryFilter);
            void queryClient.invalidateQueries(nestedFolderPagesQueryFilter);
          },
          onSuccess: (saved) => {
            titleVersionRef.current = saved.updated_at;
            updateCaches(saved);
            void queryClient.invalidateQueries(nestedFolderPagesQueryFilter);
          },
        },
      );
    },
    [
      nestedFolderPagesQueryFilter,
      page.id,
      page.node_id,
      page.title,
      queryClient,
      treeQueryFilter,
      trpc.pages.getById,
      updatePageTitle,
    ],
  );

  return (
    <DeletePageDialog
      page={page}
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
    >
      <div className={itemIndentClassName}>
        <div ref={setNodeRef} className="relative py-1">
          <TreeInsertDropBands
            beforeBandClassName="top-0 h-1/2"
            afterBandClassName="bottom-0 h-1/2"
            activeDragId={activeDragId}
            afterSiblingDropId={
              nextEdgeId
                ? getBeforeDropId({ anchorEdgeId: nextEdgeId, parentNodeId })
                : undefined
            }
            anchorEdgeId={page.edge_id}
            isDnDEnabled={isDnDEnabled}
            parentNodeId={parentNodeId}
            showBeforeLine={showBeforeLine}
          />
          <div
            className={cn(
              TREE_ROW_CLASSNAME,
              "relative z-10 select-none hover:bg-muted/60",
              isActive && "bg-primary/5 ring-1 ring-primary/20",
              activeDragId === draggableId && "opacity-60",
            )}
            onClickCapture={(event) => {
              if (isEditing) {
                return;
              }

              if (!shouldSuppressClick()) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
            }}
            {...(isDnDEnabled && !isEditing
              ? {
                  ...attributes,
                  ...listeners,
                }
              : undefined)}
          >
            {isEditing ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background">
                    <FileText className="size-3 text-muted-foreground" />
                  </span>
                  {titleError && (
                    <span role="alert" className="text-destructive text-xs">
                      Title not saved. Your draft is kept; copy it before
                      leaving.
                    </span>
                  )}
                  <Input
                    autoFocus
                    maxLength={MAX_PAGE_TITLE_LENGTH}
                    value={draftTitle}
                    onBlur={() => {
                      if (shouldSkipBlurCommitRef.current) {
                        shouldSkipBlurCommitRef.current = false;
                        return;
                      }

                      setIsEditing(false);
                      commitTitle(draftTitle);
                    }}
                    onChange={(event) => {
                      setDraftTitle(event.target.value);
                    }}
                    onFocus={(event) => {
                      event.currentTarget.select();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        shouldSkipBlurCommitRef.current = true;
                        setDraftTitle(page.title);
                        setIsEditing(false);
                      }
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    placeholder="New page"
                    className="h-8"
                  />
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {PAGE_DATE_FORMATTER.format(new Date(page.updated_at))}
                </span>
              </div>
            ) : (
              <Link
                draggable={false}
                data-tree-drag-handle
                href={pageHref}
                className="flex min-w-0 flex-1 items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background">
                    <FileText className="size-3 text-muted-foreground" />
                  </span>
                  <span className="truncate font-medium">
                    {page.title || "New page"}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {PAGE_DATE_FORMATTER.format(new Date(page.updated_at))}
                </span>
              </Link>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  aria-label="Page settings"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md bg-transparent! p-0 text-muted-foreground"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    titleVersionRef.current = page.updated_at;
                    setTitleError(false);
                    setDraftTitle(page.title);
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
                {moves.menuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </DeletePageDialog>
  );
}

function DraggableFolderRow({
  activeDragId,
  folder,
  isDnDEnabled,
  isPending = false,
  itemIndentClassName,
  nextEdgeId,
  openFolders,
  parentNodeId,
  setFolderOpen,
  showBeforeLine = true,
}: {
  activeDragId: string | null;
  folder: TreeFolder;
  isDnDEnabled: boolean;
  isPending?: boolean;
  itemIndentClassName: string;
  nextEdgeId?: string;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
  showBeforeLine?: boolean;
}) {
  const { shouldSuppressClick } = useFolderTreeInteractions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const shouldSkipBlurCommitRef = useRef(false);
  const itemRef: TreeItemRef = {
    kind: "folder",
    nodeId: folder.node_id,
  };
  const draggableId = getDragId(itemRef);
  const moves = useTreeItemMoves({
    label: folder.name || "New folder",
    node_id: folder.node_id,
    parent_node_id: parentNodeId,
  });
  const folderHref = `/folders/${folder.id}`;
  const isActive = pathname === folderHref;
  const isOpen = openFolders[folder.node_id] ?? false;
  const { attributes, listeners, setNodeRef } = useDraggable({
    data: {
      edgeId: folder.edge_id,
      item: itemRef,
      label: folder.name,
      parentNodeId,
    } satisfies TreeDragData,
    disabled: !isDnDEnabled || isEditing || isPending,
    id: draggableId,
  });
  const insideDropId = getInsideDropId(folder.node_id);
  const { isOver: isOverInside, setNodeRef: setInsideDropNodeRef } =
    useDroppable({
      id: insideDropId,
    });
  const treeData = useTreeChildren({
    enabled: isOpen,
    parentNodeId: folder.node_id,
  });
  const isDragActive = isDnDEnabled && !!activeDragId;
  const afterSiblingDropId = nextEdgeId
    ? getBeforeDropId({ anchorEdgeId: nextEdgeId, parentNodeId })
    : undefined;

  useEffect(() => {
    setDraftName(folder.name);
  }, [folder.name]);

  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const { mutate: renameFolder } = useMutation(
    trpc.folders.rename.mutationOptions({}),
  );

  const commitFolderName = useCallback(
    (nextName: string) => {
      if (nextName === folder.name) {
        return;
      }

      queryClient.setQueryData(
        trpc.folders.getById.queryOptions({ id: folder.id }).queryKey,
        (old) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            name: nextName,
            updated_at: new Date().toISOString(),
          };
        },
      );

      queryClient.setQueryData(
        trpc.folders.getByUser.queryOptions().queryKey,
        (old) => {
          if (!old) {
            return old;
          }

          return old.map((item) =>
            item.id === folder.id ? { ...item, name: nextName } : item,
          );
        },
      );

      updateNode({
        nodeId: folder.node_id,
        queryClient,
        queryFilter: treeQueryFilter,
        updater: (item) =>
          item.kind === "folder"
            ? {
                ...item,
                folder: {
                  ...item.folder,
                  name: nextName,
                },
              }
            : item,
      });

      renameFolder(
        {
          id: folder.id,
          name: nextName,
        },
        {
          onError: () => {
            void queryClient.invalidateQueries({
              queryKey: trpc.folders.getById.queryOptions({ id: folder.id })
                .queryKey,
            });
            void queryClient.invalidateQueries({
              queryKey: trpc.folders.getByUser.queryOptions().queryKey,
            });
            void queryClient.invalidateQueries(treeQueryFilter);
          },
        },
      );
    },
    [
      folder.id,
      folder.name,
      folder.node_id,
      queryClient,
      renameFolder,
      treeQueryFilter,
      trpc.folders.getById,
      trpc.folders.getByUser,
    ],
  );

  const handleFolderToggle = useCallback(() => {
    if (isEditing || shouldSuppressClick()) {
      return;
    }

    setFolderOpen(folder.node_id, !isOpen);
  }, [folder.node_id, isEditing, isOpen, setFolderOpen, shouldSuppressClick]);

  return (
    <DeleteFolderDialog
      folder={folder}
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
    >
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => {
          setFolderOpen(folder.node_id, open);
        }}
        className="group/folder-collapsible"
      >
        <div className={itemIndentClassName}>
          <div
            ref={setNodeRef}
            className="relative py-1"
            onClickCapture={(event) => {
              if (isEditing) {
                return;
              }

              if (!shouldSuppressClick()) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <TreeInsertDropBands
              activeDragId={activeDragId}
              afterSiblingDropId={afterSiblingDropId}
              anchorEdgeId={folder.edge_id}
              isDnDEnabled={isDnDEnabled}
              parentNodeId={parentNodeId}
              showAfter={!treeData.shouldRenderNestedContent}
              showBeforeLine={showBeforeLine}
            />
            <div
              ref={setInsideDropNodeRef}
              className={cn(
                TREE_INSIDE_DROP_ZONE_CLASSNAME,
                isDragActive ? "pointer-events-auto" : "pointer-events-none",
              )}
            />
            <div
              {...(isDnDEnabled && !isEditing
                ? {
                    ...attributes,
                    ...listeners,
                  }
                : undefined)}
              className={cn(
                TREE_ROW_CLASSNAME,
                "group/folder-navigation relative z-10",
                isActive && "bg-primary/5 ring-1 ring-primary/20",
                activeDragId === draggableId && "opacity-60",
                isOverInside &&
                  isDragActive &&
                  "bg-primary/20 ring-1 ring-primary/30",
              )}
            >
              {isEditing ? (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="relative flex size-3 shrink-0 items-center justify-center text-primary">
                    {isOpen ? (
                      <FolderOpen className="size-3 shrink-0" />
                    ) : (
                      <FolderClosed className="size-3 shrink-0" />
                    )}
                  </span>
                  <Input
                    autoFocus
                    maxLength={MAX_FOLDER_TITLE_LENGTH}
                    value={draftName}
                    onBlur={() => {
                      if (shouldSkipBlurCommitRef.current) {
                        shouldSkipBlurCommitRef.current = false;
                        return;
                      }

                      setIsEditing(false);
                      commitFolderName(draftName);
                    }}
                    onChange={(event) => {
                      setDraftName(event.target.value);
                    }}
                    onFocus={(event) => {
                      event.currentTarget.select();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        shouldSkipBlurCommitRef.current = true;
                        setDraftName(folder.name);
                        setIsEditing(false);
                      }
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    placeholder="New folder"
                    className="h-8"
                  />
                </span>
              ) : (
                <button
                  data-tree-drag-handle
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${folder.name || "New folder"}`}
                  onClick={handleFolderToggle}
                  className="flex w-full min-w-0 items-center gap-1.5 text-left"
                >
                  <span className="relative flex size-3 shrink-0 items-center justify-center text-primary">
                    {isOpen ? (
                      <FolderOpen className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                    ) : (
                      <FolderClosed className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                    )}
                    <ChevronRight className="absolute inset-0 size-3 shrink-0 opacity-0 transition-all duration-150 group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100 group-data-[open]/folder-collapsible:rotate-90" />
                  </span>
                  <span className="line-clamp-1 min-w-0 flex-1 truncate text-left font-medium">
                    {folder.name || "New folder"}
                  </span>
                </button>
              )}

              <div className="ml-1 flex shrink-0 items-center gap-0.5">
                {!isEditing ? (
                  isPending ? (
                    <output className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="sr-only">
                        Folder is still being created
                      </span>
                    </output>
                  ) : (
                    <Link
                      href={folderHref}
                      aria-label={`Open ${folder.name || "New folder"}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100 md:opacity-0"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  )
                ) : null}

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      aria-label="Folder settings"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md bg-transparent! p-0 text-muted-foreground"
                      disabled={isPending}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setDraftName(folder.name);
                        setIsEditing(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                    {moves.menuItems}
                  </DropdownMenuContent>
                </DropdownMenu>

                <AppSidebarTreeActions
                  disabled={isPending}
                  kind="folder"
                  folder={folder}
                  parentNodeId={folder.node_id}
                  triggerVariant="inline"
                  onCreateStart={() => {
                    setFolderOpen(folder.node_id, true);
                  }}
                  onCreateSuccess={() => {
                    setFolderOpen(folder.node_id, true);
                  }}
                />
              </div>
            </div>
          </div>

          {treeData.shouldRenderNestedContent ? (
            <>
              <CollapsibleContent
                animateHeight
                className={cn(treeData.items.length > 0 && "pt-1")}
              >
                <FolderTreeRows
                  activeDragId={activeDragId}
                  itemIndentClassName="ml-3 pl-2"
                  isDnDEnabled={isDnDEnabled}
                  openFolders={openFolders}
                  parentNodeId={folder.node_id}
                  setFolderOpen={setFolderOpen}
                  treeData={treeData}
                />
              </CollapsibleContent>
              <div className="relative h-1">
                <TreeInsertDropBands
                  activeDragId={activeDragId}
                  afterSiblingDropId={afterSiblingDropId}
                  anchorEdgeId={folder.edge_id}
                  afterBandClassName="top-0 h-1"
                  afterLineClassName="top-0"
                  isDnDEnabled={isDnDEnabled}
                  parentNodeId={parentNodeId}
                  showBefore={false}
                />
              </div>
            </>
          ) : null}
        </div>
      </Collapsible>
    </DeleteFolderDialog>
  );
}

function FolderTreeRows({
  activeDragId,
  itemIndentClassName,
  isDnDEnabled,
  openFolders,
  parentNodeId,
  setFolderOpen,
  treeData,
}: Omit<TreeLevelProps, "emptyStateVariant" | "enabled"> & {
  treeData: FolderTreeData;
}) {
  return (
    <>
      {treeData.shouldShowInitialSkeleton ? (
        <div className={itemIndentClassName}>
          <div className="relative py-1">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      ) : null}

      {treeData.items.map((item, index) => {
        const isFirst = index === 0;
        const nextEdgeId = treeData.items[index + 1]?.edge_id;
        if (item.pending && item.kind === "page")
          return (
            <div key={item.node_id} className={itemIndentClassName}>
              <Skeleton className="my-1 h-9 w-full rounded-lg" />
            </div>
          );
        return item.kind === "folder" ? (
          <DraggableFolderRow
            key={`${item.kind}-${item.node_id}`}
            activeDragId={activeDragId}
            folder={item.folder}
            isDnDEnabled={isDnDEnabled}
            isPending={item.pending}
            itemIndentClassName={itemIndentClassName}
            nextEdgeId={nextEdgeId}
            openFolders={openFolders}
            parentNodeId={parentNodeId}
            setFolderOpen={setFolderOpen}
            showBeforeLine={isFirst}
          />
        ) : (
          <DraggablePageRow
            key={`${item.kind}-${item.node_id}`}
            activeDragId={activeDragId}
            isDnDEnabled={isDnDEnabled}
            itemIndentClassName={itemIndentClassName}
            nextEdgeId={nextEdgeId}
            page={item.page}
            parentNodeId={parentNodeId}
            showBeforeLine={isFirst}
          />
        );
      })}

      {treeData.isFetchingNextPage ? (
        <div className={itemIndentClassName}>
          <div className="relative py-1">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      ) : null}

      {treeData.hasNextPage ? (
        <div className={itemIndentClassName} aria-hidden>
          <div className="relative py-1">
            <div ref={treeData.loadMoreRef} className="h-px w-full" />
          </div>
        </div>
      ) : null}
      {treeData.items.length > 0 ? (
        <TreeEndDropTarget
          className={itemIndentClassName}
          parentNodeId={parentNodeId}
          active={isDnDEnabled && activeDragId !== null}
        />
      ) : null}
    </>
  );
}

function FolderTreeLevel({
  activeDragId,
  emptyStateVariant = "tree",
  enabled = true,
  itemIndentClassName,
  isDnDEnabled,
  openFolders,
  parentNodeId,
  setFolderOpen,
}: TreeLevelProps) {
  const treeData = useTreeChildren({
    enabled,
    parentNodeId,
  });

  if (
    emptyStateVariant === "root" &&
    treeData.items.length === 0 &&
    !treeData.shouldShowInitialSkeleton
  ) {
    return (
      <RootFolderEmptyState
        isDnDEnabled={isDnDEnabled}
        parentNodeId={parentNodeId}
      />
    );
  }

  return (
    <FolderTreeRows
      activeDragId={activeDragId}
      itemIndentClassName={itemIndentClassName}
      isDnDEnabled={isDnDEnabled}
      openFolders={openFolders}
      parentNodeId={parentNodeId}
      setFolderOpen={setFolderOpen}
      treeData={treeData}
    />
  );
}

export function FolderNestedPagesList({
  rootParentNodeId = null,
}: FolderNestedPagesListProps) {
  const _trpc = useTRPC();
  const _queryClient = useQueryClient();

  const {
    openFolders,
    setFolderOpen,
    activeDragId,
    activeDragLabel,
    isDnDEnabled,
    shouldSuppressClick,
    dndContextProps,
  } = useTreeController();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-base">Content</h2>
          <p className="text-muted-foreground text-sm">
            Includes folders and pages in this folder:
          </p>
        </div>
        <AppSidebarTreeActions
          kind="folder"
          parentNodeId={rootParentNodeId}
          triggerVariant="inline"
        />
      </div>

      <DndContext {...dndContextProps}>
        <TreeMoveProvider>
          <FolderTreeInteractionsContext.Provider
            value={{ shouldSuppressClick }}
          >
            <div className="overflow-x-clip rounded-3xl border bg-background/80 p-2 shadow-xs">
              <FolderTreeLevel
                activeDragId={activeDragId}
                emptyStateVariant="root"
                itemIndentClassName=""
                isDnDEnabled={isDnDEnabled}
                openFolders={openFolders}
                parentNodeId={rootParentNodeId}
                setFolderOpen={setFolderOpen}
              />
            </div>
          </FolderTreeInteractionsContext.Provider>
        </TreeMoveProvider>
        <TreeDragOverlay label={activeDragLabel} />
      </DndContext>
    </section>
  );
}
