"use client";

import type { Folder, Page } from "@acme/db/schema";
import {
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  FileText,
  Folder as FolderIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { cn } from "~/lib/cn";
import {
  moveNode as moveTreeNode,
  type QuerySnapshot,
  restoreQueries,
  snapshotQueries,
  updateNode,
  updatePageTitleInNestedPages,
} from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
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
const DROP_ZONE_CLASSNAME = "h-1 rounded-sm transition-colors";
const INFINITE_SCROLL_ROOT_MARGIN = "120px 0px";
const DRAG_CLICK_SUPPRESSION_MS = 200;
const ROOT_PARENT_KEY = "root";
const MAX_PAGE_TITLE_LENGTH = 500;
const MAX_FOLDER_TITLE_LENGTH = 500;
const PAGE_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

type TreeFolder = Folder & {
  edge_id: string;
  node_id: string;
  parent_node_id: string | null;
};

type TreePage = Page & {
  edge_id: string;
  node_id: string;
  parent_node_id: string | null;
};

type TreeItem =
  | {
      edge_id: string;
      folder: TreeFolder;
      kind: "folder";
      node_id: string;
      pending?: boolean;
      parent_node_id: string | null;
    }
  | {
      edge_id: string;
      kind: "page";
      node_id: string;
      pending?: boolean;
      page: TreePage;
      parent_node_id: string | null;
    };

type FolderNestedPagesListProps = {
  rootParentNodeId?: string | null;
};

type MoveMutationContext = {
  treeSnapshots: QuerySnapshot[];
};

type TreeLevelProps = {
  activeDragId: string | null;
  emptyStateVariant?: "root" | "tree";
  enabled?: boolean;
  itemIndentClassName: string;
  isDnDEnabled: boolean;
  onFolderInsideHover: (folderNodeId: string) => void;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
};

type FolderTreeItemRef = {
  kind: "folder" | "page";
  nodeId: string;
};

type FolderTreeDragData = {
  item: FolderTreeItemRef;
  parentNodeId: string | null;
};

type DropTarget =
  | {
      parentNodeId: string | null;
      type: "inside" | "parent";
    }
  | {
      anchorEdgeId: string;
      parentNodeId: string | null;
      type: "after" | "before";
    };

function encodeParentKey(parentNodeId: string | null) {
  return parentNodeId ?? ROOT_PARENT_KEY;
}

function decodeParentKey(parentKey: string) {
  return parentKey === ROOT_PARENT_KEY ? null : parentKey;
}

function getDragId(item: FolderTreeItemRef) {
  return `drag:${item.kind}:${item.nodeId}`;
}

function getBeforeDropId({
  anchorEdgeId,
  parentNodeId,
}: {
  anchorEdgeId: string;
  parentNodeId: string | null;
}) {
  return `drop:before:${encodeParentKey(parentNodeId)}:${anchorEdgeId}`;
}

function getAfterDropId({
  anchorEdgeId,
  parentNodeId,
}: {
  anchorEdgeId: string;
  parentNodeId: string | null;
}) {
  return `drop:after:${encodeParentKey(parentNodeId)}:${anchorEdgeId}`;
}

function getInsideDropId(nodeId: string) {
  return `drop:inside:${nodeId}`;
}

function getParentDropId(parentNodeId: string | null) {
  return `drop:parent:${encodeParentKey(parentNodeId)}`;
}

function parseDropTarget(id: unknown): DropTarget | null {
  if (typeof id !== "string") {
    return null;
  }

  const parts = id.split(":");
  if (parts[0] !== "drop") {
    return null;
  }

  if (parts[1] === "inside") {
    const nodeId = parts[2];
    if (!nodeId) {
      return null;
    }

    return {
      parentNodeId: nodeId,
      type: "inside",
    };
  }

  if (parts[1] === "parent") {
    const parentKey = parts[2];
    if (!parentKey) {
      return null;
    }

    return {
      parentNodeId: decodeParentKey(parentKey),
      type: "parent",
    };
  }

  const position = parts[1];
  const parentKey = parts[2];
  const anchorEdgeId = parts[3];

  if (!parentKey || !anchorEdgeId) {
    return null;
  }

  if (position !== "before" && position !== "after") {
    return null;
  }

  return {
    anchorEdgeId,
    parentNodeId: decodeParentKey(parentKey),
    type: position,
  };
}

function FolderTreeDropZone({
  activeDragId,
  className,
  dropId,
  itemIndentClassName,
  isDnDEnabled,
}: {
  activeDragId: string | null;
  className?: string;
  dropId: string;
  itemIndentClassName: string;
  isDnDEnabled: boolean;
}) {
  const { isMobile } = useSidebar();
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
  });

  if (!isDnDEnabled) {
    return null;
  }

  if (isMobile && !activeDragId) {
    return null;
  }

  return (
    <div className={cn(itemIndentClassName, "py-0", className)}>
      <div
        ref={setNodeRef}
        className={cn(
          DROP_ZONE_CLASSNAME,
          "bg-transparent",
          isOver && "bg-primary/35",
        )}
      />
    </div>
  );
}

function RootFolderEmptyState({
  activeDragId,
  isDnDEnabled,
  parentNodeId,
}: {
  activeDragId: string | null;
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
        "-m-2 rounded-[calc(theme(borderRadius.3xl)-2px)] bg-muted/25 px-5 py-6 transition-colors sm:px-6",
        isOver &&
          isDnDEnabled &&
          "bg-primary/6 outline outline-1 outline-primary/25",
        activeDragId && "min-h-32",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background">
            <FolderIcon className="size-4 text-primary" />
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
  page,
  parentNodeId,
}: {
  activeDragId: string | null;
  isDnDEnabled: boolean;
  itemIndentClassName: string;
  page: TreePage;
  parentNodeId: string | null;
}) {
  const { shouldSuppressClick } = useFolderTreeInteractions();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(page.title);
  const shouldSkipBlurCommitRef = useRef(false);
  const itemRef: FolderTreeItemRef = {
    kind: "page",
    nodeId: page.node_id,
  };
  const draggableId = getDragId(itemRef);
  const pageHref = `/pages/${page.id}`;
  const isActive = pathname === pageHref;
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const nestedFolderPagesQueryFilter =
    trpc.tree.getNestedPagesPaginated.infiniteQueryFilter();
  const { mutate: updatePageTitle } = useMutation(
    trpc.pages.updateTitle.mutationOptions({}),
  );
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    data: {
      item: itemRef,
      parentNodeId,
    } satisfies FolderTreeDragData,
    disabled: !isDnDEnabled || isEditing,
    id: draggableId,
  });

  useEffect(() => {
    setDraftTitle(page.title);
  }, [page.title]);

  const commitTitle = useCallback(
    (nextTitle: string) => {
      if (nextTitle === page.title) {
        return;
      }

      queryClient.setQueryData(
        trpc.pages.getById.queryOptions({ id: page.id }).queryKey,
        (old) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            title: nextTitle,
            updated_at: new Date().toISOString(),
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

      updatePageTitle(
        { id: page.id, title: nextTitle },
        {
          onError: () => {
            void queryClient.invalidateQueries({
              queryKey: trpc.pages.getById.queryOptions({ id: page.id })
                .queryKey,
            });
            void queryClient.invalidateQueries(treeQueryFilter);
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
      <div className={cn(itemIndentClassName, "py-0")}>
        <div
          ref={setNodeRef}
          className={cn(
            TREE_ROW_CLASSNAME,
            "hover:bg-muted/60",
            isActive && "bg-primary/5 ring-1 ring-primary/20",
            activeDragId === draggableId && "opacity-60",
          )}
          style={
            transform
              ? {
                  transform: CSS.Translate.toString(transform),
                }
              : undefined
          }
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
                onSelect={() => {
                  setDraftTitle(page.title);
                  setIsEditing(true);
                }}
              >
                <Pencil className="size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
  onFolderInsideHover,
  openFolders,
  parentNodeId,
  setFolderOpen,
}: {
  activeDragId: string | null;
  folder: TreeFolder;
  isDnDEnabled: boolean;
  isPending?: boolean;
  itemIndentClassName: string;
  onFolderInsideHover: (folderNodeId: string) => void;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
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
  const itemRef: FolderTreeItemRef = {
    kind: "folder",
    nodeId: folder.node_id,
  };
  const draggableId = getDragId(itemRef);
  const folderHref = `/folders/${folder.id}`;
  const isActive = pathname === folderHref;
  const isOpen = openFolders[folder.node_id] ?? false;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    data: {
      item: itemRef,
      parentNodeId,
    } satisfies FolderTreeDragData,
    disabled: !isDnDEnabled || isEditing,
    id: draggableId,
  });
  const insideDropId = getInsideDropId(folder.node_id);
  const { isOver: isOverInside, setNodeRef: setInsideDropNodeRef } =
    useDroppable({
      id: insideDropId,
    });

  useEffect(() => {
    if (isOverInside) {
      onFolderInsideHover(folder.node_id);
    }
  }, [folder.node_id, isOverInside, onFolderInsideHover]);

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
        <div className={cn(itemIndentClassName, "py-0")}>
          <div
            ref={setNodeRef}
            className={cn(
              TREE_ROW_CLASSNAME,
              "group/folder-item",
              isActive && "bg-primary/5 ring-1 ring-primary/20",
              activeDragId === draggableId && "opacity-60",
            )}
            style={
              transform
                ? {
                    transform: CSS.Translate.toString(transform),
                  }
                : undefined
            }
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
            <div
              {...(isDnDEnabled && !isEditing
                ? {
                    ...attributes,
                    ...listeners,
                  }
                : undefined)}
              ref={setInsideDropNodeRef}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1.5 rounded-md",
                isOverInside && isDnDEnabled && "bg-primary/10",
              )}
            >
              {isEditing ? (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background">
                    <FolderIcon className="size-3 text-primary" />
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
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse folder" : "Expand folder"}
                  onClick={handleFolderToggle}
                  className="flex w-full min-w-0 items-center gap-1.5 text-left"
                >
                  <span className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background">
                    <FolderIcon className="size-3 text-primary transition-opacity duration-150 group-focus-within/folder-item:opacity-0 group-hover/folder-item:opacity-0" />
                    <ArrowRight className="absolute size-3 text-primary opacity-0 transition-all duration-150 group-focus-within/folder-item:opacity-100 group-hover/folder-item:opacity-100 group-data-[state=open]/folder-collapsible:rotate-90" />
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
                      aria-label="Open folder"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-focus-within/folder-item:opacity-100 group-hover/folder-item:opacity-100"
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
                      onSelect={() => {
                        setDraftName(folder.name);
                        setIsEditing(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
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

          <CollapsibleContent className="mt-0.5">
            <div className="space-y-0.5">
              <FolderTreeLevel
                activeDragId={activeDragId}
                emptyStateVariant="tree"
                enabled={isOpen}
                itemIndentClassName="ml-3 pl-2"
                isDnDEnabled={isDnDEnabled}
                onFolderInsideHover={onFolderInsideHover}
                openFolders={openFolders}
                parentNodeId={folder.node_id}
                setFolderOpen={setFolderOpen}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </DeleteFolderDialog>
  );
}

function FolderTreeLevel({
  activeDragId,
  emptyStateVariant = "tree",
  enabled = true,
  itemIndentClassName,
  isDnDEnabled,
  onFolderInsideHover,
  openFolders,
  parentNodeId,
  setFolderOpen,
}: TreeLevelProps) {
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryOptions = trpc.tree.getChildrenPaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentNodeId),
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      ...queryOptions,
      enabled,
      getNextPageParam: ({ nextCursor }) => {
        return nextCursor;
      },
    });

  const items = (data?.pages.flatMap((page) => page.items) ?? []) as TreeItem[];

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void fetchNextPage();
        }
      },
      {
        rootMargin: INFINITE_SCROLL_ROOT_MARGIN,
      },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const shouldShowInitialSkeleton = items.length === 0 && isPending;

  return (
    <>
      {shouldShowInitialSkeleton ? (
        <div className={cn(itemIndentClassName, "py-0")}>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : null}

      {items.length === 0 && !shouldShowInitialSkeleton ? (
        emptyStateVariant === "root" ? (
          <RootFolderEmptyState
            activeDragId={activeDragId}
            isDnDEnabled={isDnDEnabled}
            parentNodeId={parentNodeId}
          />
        ) : (
          <FolderTreeDropZone
            activeDragId={activeDragId}
            dropId={getParentDropId(parentNodeId)}
            itemIndentClassName={itemIndentClassName}
            isDnDEnabled={isDnDEnabled}
          />
        )
      ) : null}

      {items.map((item) => {
        return (
          <Fragment key={`${item.kind}-${item.node_id}`}>
            <FolderTreeDropZone
              activeDragId={activeDragId}
              dropId={getBeforeDropId({
                anchorEdgeId: item.edge_id,
                parentNodeId,
              })}
              itemIndentClassName={itemIndentClassName}
              isDnDEnabled={isDnDEnabled}
            />

            {item.kind === "folder" ? (
              <DraggableFolderRow
                activeDragId={activeDragId}
                folder={item.folder}
                isDnDEnabled={isDnDEnabled}
                isPending={item.pending}
                itemIndentClassName={itemIndentClassName}
                onFolderInsideHover={onFolderInsideHover}
                openFolders={openFolders}
                parentNodeId={parentNodeId}
                setFolderOpen={setFolderOpen}
              />
            ) : (
              <DraggablePageRow
                activeDragId={activeDragId}
                isDnDEnabled={isDnDEnabled}
                itemIndentClassName={itemIndentClassName}
                page={item.page}
                parentNodeId={parentNodeId}
              />
            )}

            <FolderTreeDropZone
              activeDragId={activeDragId}
              dropId={getAfterDropId({
                anchorEdgeId: item.edge_id,
                parentNodeId,
              })}
              itemIndentClassName={itemIndentClassName}
              isDnDEnabled={isDnDEnabled}
            />
          </Fragment>
        );
      })}

      {isFetchingNextPage ? (
        <div className={cn(itemIndentClassName, "py-0")}>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : null}

      <div className={cn(itemIndentClassName, "py-0")} aria-hidden>
        <div ref={loadMoreRef} className="h-px w-full" />
      </div>
    </>
  );
}

export function FolderNestedPagesList({
  rootParentNodeId = null,
}: FolderNestedPagesListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const hoverExpandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hoverFolderIdRef = useRef<string | null>(null);
  const moveMutationContextRef = useRef<MoveMutationContext | null>(null);
  const recentDragUntilRef = useRef(0);
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const getContainerQueryKey = (targetParentNodeId: string | null) => {
    return trpc.tree.getChildrenPaginated.infiniteQueryOptions(
      getInfiniteSidebarTreeQueryOptions(targetParentNodeId),
    ).queryKey;
  };

  const { mutate: moveItem } = useMutation(
    trpc.tree.moveItem.mutationOptions({
      onError: () => {
        const context = moveMutationContextRef.current;
        if (!context) {
          return;
        }

        restoreQueries({
          queryClient,
          snapshots: context.treeSnapshots,
        });
        moveMutationContextRef.current = null;
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries(treeQueryFilter);

        const treeSnapshots = snapshotQueries({
          queryClient,
          queryFilter: treeQueryFilter,
        });

        moveTreeNode({
          destination: variables.destination,
          getContainerQueryKey,
          nodeId: variables.node_id,
          queryClient,
          queryFilter: treeQueryFilter,
        });

        moveMutationContextRef.current = {
          treeSnapshots,
        };
      },
      onSuccess: (result) => {
        updateNode({
          nodeId: result.node_id,
          queryClient,
          queryFilter: treeQueryFilter,
          updater: (item) =>
            item.kind === "folder"
              ? {
                  ...item,
                  edge_id: result.edge_id,
                  folder: {
                    ...item.folder,
                    edge_id: result.edge_id,
                    parent_node_id: result.parent_node_id,
                  },
                  parent_node_id: result.parent_node_id,
                }
              : {
                  ...item,
                  edge_id: result.edge_id,
                  page: {
                    ...item.page,
                    edge_id: result.edge_id,
                    parent_node_id: result.parent_node_id,
                  },
                  parent_node_id: result.parent_node_id,
                },
        });
        moveMutationContextRef.current = null;
      },
    }),
  );

  const clearHoverExpandTimeout = useCallback(() => {
    if (hoverExpandTimeoutRef.current) {
      clearTimeout(hoverExpandTimeoutRef.current);
      hoverExpandTimeoutRef.current = null;
    }
    hoverFolderIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearHoverExpandTimeout();
    };
  }, [clearHoverExpandTimeout]);

  const setFolderOpen = useCallback((folderNodeId: string, open: boolean) => {
    setOpenFolders((previous) => {
      if (previous[folderNodeId] === open) {
        return previous;
      }

      return {
        ...previous,
        [folderNodeId]: open,
      };
    });
  }, []);

  const markRecentDrag = useCallback(() => {
    recentDragUntilRef.current = Date.now() + DRAG_CLICK_SUPPRESSION_MS;
  }, []);

  const shouldSuppressClick = useCallback(() => {
    return Date.now() < recentDragUntilRef.current;
  }, []);

  const isDnDEnabled = true;
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 300, tolerance: 8 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      navigator.vibrate?.(50);
      markRecentDrag();
      setActiveDragId(String(event.active.id));
    },
    [markRecentDrag],
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      clearHoverExpandTimeout();
      markRecentDrag();
      setActiveDragId(null);
    },
    [clearHoverExpandTimeout, markRecentDrag],
  );

  const handleFolderInsideHover = useCallback(
    (folderNodeId: string) => {
      if (!isDnDEnabled) {
        return;
      }

      if (openFolders[folderNodeId]) {
        clearHoverExpandTimeout();
        return;
      }

      if (hoverFolderIdRef.current === folderNodeId) {
        return;
      }

      clearHoverExpandTimeout();
      hoverFolderIdRef.current = folderNodeId;
      hoverExpandTimeoutRef.current = setTimeout(() => {
        setFolderOpen(folderNodeId, true);
      }, 700);
    },
    [clearHoverExpandTimeout, openFolders, setFolderOpen],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!isDnDEnabled) {
        return;
      }

      const dropTarget = parseDropTarget(event.over?.id);
      if (
        !dropTarget ||
        dropTarget.type !== "inside" ||
        !dropTarget.parentNodeId
      ) {
        clearHoverExpandTimeout();
        return;
      }

      handleFolderInsideHover(dropTarget.parentNodeId);
    },
    [clearHoverExpandTimeout, handleFolderInsideHover],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      clearHoverExpandTimeout();
      markRecentDrag();
      setActiveDragId(null);

      if (!isDnDEnabled) {
        return;
      }

      const activeData = event.active.data.current as
        | FolderTreeDragData
        | undefined;
      if (!activeData?.item) {
        return;
      }

      const dropTarget = parseDropTarget(event.over?.id);
      if (!dropTarget) {
        return;
      }

      const destination =
        dropTarget.type === "before" || dropTarget.type === "after"
          ? {
              anchor_edge_id: dropTarget.anchorEdgeId,
              parent_node_id: dropTarget.parentNodeId,
              position: dropTarget.type,
            }
          : {
              parent_node_id: dropTarget.parentNodeId,
            };

      if (
        activeData.item.kind === "folder" &&
        destination.parent_node_id === activeData.item.nodeId
      ) {
        return;
      }

      moveItem({
        destination,
        node_id: activeData.item.nodeId,
      });
    },
    [clearHoverExpandTimeout, markRecentDrag, moveItem],
  );

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

      <DndContext
        collisionDetection={pointerWithin}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <FolderTreeInteractionsContext.Provider value={{ shouldSuppressClick }}>
          <div className="rounded-3xl border bg-background/80 p-2 shadow-xs">
            <div className="space-y-0.5">
              <FolderTreeLevel
                activeDragId={activeDragId}
                emptyStateVariant="root"
                itemIndentClassName=""
                isDnDEnabled={isDnDEnabled}
                onFolderInsideHover={handleFolderInsideHover}
                openFolders={openFolders}
                parentNodeId={rootParentNodeId}
                setFolderOpen={setFolderOpen}
              />
            </div>
          </div>
        </FolderTreeInteractionsContext.Provider>
      </DndContext>
    </section>
  );
}
