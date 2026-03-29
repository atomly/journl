"use client";

import type { Folder, Page } from "@acme/db/schema";
import {
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
  TREE_INSIDE_DROP_ZONE_CLASSNAME,
  TREE_REORDER_AFTER_BAND_CLASSNAME,
  TREE_REORDER_AFTER_LINE_CLASSNAME,
  TREE_REORDER_BEFORE_BAND_CLASSNAME,
  TREE_REORDER_BEFORE_LINE_CLASSNAME,
  TreeDragOverlay,
  treeCollisionDetection,
} from "~/lib/tree-dnd";
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
const TREE_DROP_LINE_CLASSNAME =
  "absolute right-0 left-1 h-0.5 rounded-full bg-primary";
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

type FolderTreeData = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: TreeItem[];
  loadMoreRef: RefObject<HTMLDivElement | null>;
  shouldRenderNestedContent: boolean;
  shouldShowInitialSkeleton: boolean;
};

type FolderTreeItemRef = {
  kind: "folder" | "page";
  nodeId: string;
};

type FolderTreeDragData = {
  item: FolderTreeItemRef;
  label: string;
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

function FolderTreeInsertDropBand({
  activeDragId,
  bandClassName,
  dropId,
  isDnDEnabled,
  isSiblingOver = false,
  lineClassName,
  showLine = true,
}: {
  activeDragId: string | null;
  bandClassName: string;
  dropId: string;
  isDnDEnabled: boolean;
  isSiblingOver?: boolean;
  lineClassName?: string;
  showLine?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
  });
  const isDragActive = isDnDEnabled && !!activeDragId;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-x-0 z-20",
        bandClassName,
        isDragActive ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        className={cn(
          TREE_DROP_LINE_CLASSNAME,
          lineClassName,
          isDragActive && (isOver || isSiblingOver) && showLine
            ? "opacity-100"
            : "opacity-0",
        )}
      />
    </div>
  );
}

function FolderTreeInsertDropBands({
  afterBandClassName = TREE_REORDER_AFTER_BAND_CLASSNAME,
  afterLineClassName = TREE_REORDER_AFTER_LINE_CLASSNAME,
  afterSiblingDropId,
  activeDragId,
  anchorEdgeId,
  beforeBandClassName = TREE_REORDER_BEFORE_BAND_CLASSNAME,
  beforeLineClassName = TREE_REORDER_BEFORE_LINE_CLASSNAME,
  isDnDEnabled,
  parentNodeId,
  showAfter = true,
  showBefore = true,
  showBeforeLine = true,
}: {
  afterBandClassName?: string;
  afterLineClassName?: string;
  afterSiblingDropId?: string;
  activeDragId: string | null;
  anchorEdgeId: string;
  beforeBandClassName?: string;
  beforeLineClassName?: string;
  isDnDEnabled: boolean;
  parentNodeId: string | null;
  showAfter?: boolean;
  showBefore?: boolean;
  showBeforeLine?: boolean;
}) {
  const { over } = useDndContext();
  const isAfterSiblingOver =
    !!afterSiblingDropId && over?.id === afterSiblingDropId;

  return (
    <>
      {showBefore ? (
        <FolderTreeInsertDropBand
          activeDragId={activeDragId}
          bandClassName={beforeBandClassName}
          dropId={getBeforeDropId({
            anchorEdgeId,
            parentNodeId,
          })}
          isDnDEnabled={isDnDEnabled}
          lineClassName={beforeLineClassName}
          showLine={showBeforeLine}
        />
      ) : null}
      {showAfter ? (
        <FolderTreeInsertDropBand
          activeDragId={activeDragId}
          bandClassName={afterBandClassName}
          dropId={getAfterDropId({
            anchorEdgeId,
            parentNodeId,
          })}
          isDnDEnabled={isDnDEnabled}
          isSiblingOver={isAfterSiblingOver}
          lineClassName={afterLineClassName}
        />
      ) : null}
    </>
  );
}

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
  const { attributes, listeners, setNodeRef } = useDraggable({
    data: {
      item: itemRef,
      label: page.title || "New page",
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
      <div className={itemIndentClassName}>
        <div ref={setNodeRef} className="relative py-1">
          <FolderTreeInsertDropBands
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
              "relative z-10 hover:bg-muted/60",
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
  onFolderInsideHover,
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
  onFolderInsideHover: (folderNodeId: string) => void;
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
  const itemRef: FolderTreeItemRef = {
    kind: "folder",
    nodeId: folder.node_id,
  };
  const draggableId = getDragId(itemRef);
  const folderHref = `/folders/${folder.id}`;
  const isActive = pathname === folderHref;
  const isOpen = openFolders[folder.node_id] ?? false;
  const { attributes, listeners, setNodeRef } = useDraggable({
    data: {
      item: itemRef,
      label: folder.name,
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
  const treeData = useFolderTreeData({
    enabled: isOpen,
    parentNodeId: folder.node_id,
  });
  const isDragActive = isDnDEnabled && !!activeDragId;
  const afterSiblingDropId = nextEdgeId
    ? getBeforeDropId({ anchorEdgeId: nextEdgeId, parentNodeId })
    : undefined;

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
            <FolderTreeInsertDropBands
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
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse folder" : "Expand folder"}
                  onClick={handleFolderToggle}
                  className="flex w-full min-w-0 items-center gap-1.5 text-left"
                >
                  <span className="relative flex size-3 shrink-0 items-center justify-center text-primary">
                    {isOpen ? (
                      <FolderOpen className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                    ) : (
                      <FolderClosed className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                    )}
                    <ChevronRight className="absolute inset-0 size-3 shrink-0 opacity-0 transition-all duration-150 group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100 group-data-[state=open]/folder-collapsible:rotate-90" />
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
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100"
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

          {treeData.shouldRenderNestedContent ? (
            <>
              <CollapsibleContent
                className={cn(treeData.items.length > 0 && "pt-1")}
              >
                <FolderTreeRows
                  activeDragId={activeDragId}
                  itemIndentClassName="ml-3 pl-2"
                  isDnDEnabled={isDnDEnabled}
                  onFolderInsideHover={onFolderInsideHover}
                  openFolders={openFolders}
                  parentNodeId={folder.node_id}
                  setFolderOpen={setFolderOpen}
                  treeData={treeData}
                />
              </CollapsibleContent>
              <div className="relative h-1">
                <FolderTreeInsertDropBands
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

function useFolderTreeData({
  enabled = true,
  parentNodeId,
}: {
  enabled?: boolean;
  parentNodeId: string | null;
}): FolderTreeData {
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryOptions = trpc.tree.getChildrenPaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentNodeId),
    {
      getNextPageParam: ({ nextCursor }) => {
        return nextCursor ?? undefined;
      },
    },
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      ...queryOptions,
      enabled,
    });

  const items = (data?.pages.flatMap((page) => page.items) ?? []) as TreeItem[];
  const shouldShowInitialSkeleton = items.length === 0 && isPending;
  const shouldRenderNestedContent =
    shouldShowInitialSkeleton ||
    items.length > 0 ||
    isFetchingNextPage ||
    !!hasNextPage;

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

  return {
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    items,
    loadMoreRef,
    shouldRenderNestedContent,
    shouldShowInitialSkeleton,
  };
}

function FolderTreeRows({
  activeDragId,
  itemIndentClassName,
  isDnDEnabled,
  onFolderInsideHover,
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
        return item.kind === "folder" ? (
          <DraggableFolderRow
            key={`${item.kind}-${item.node_id}`}
            activeDragId={activeDragId}
            folder={item.folder}
            isDnDEnabled={isDnDEnabled}
            isPending={item.pending}
            itemIndentClassName={itemIndentClassName}
            nextEdgeId={nextEdgeId}
            onFolderInsideHover={onFolderInsideHover}
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
    </>
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
  const treeData = useFolderTreeData({
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
      onFolderInsideHover={onFolderInsideHover}
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const hoverExpandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hoverFolderIdRef = useRef<string | null>(null);
  const dragStartOpenFoldersRef = useRef<Record<string, boolean>>({});
  const dragAutoExpandedFoldersRef = useRef<Set<string>>(new Set());
  const moveMutationContextRef = useRef<MoveMutationContext | null>(null);
  const recentDragUntilRef = useRef(0);
  const treeQueryFilter = trpc.tree.getChildrenPaginated.infiniteQueryFilter();
  const getContainerQueryKey = (targetParentNodeId: string | null) => {
    return trpc.tree.getChildrenPaginated.infiniteQueryKey(
      getInfiniteSidebarTreeQueryOptions(targetParentNodeId),
    );
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

  const resetDragFolderState = useCallback(() => {
    dragStartOpenFoldersRef.current = {};
    dragAutoExpandedFoldersRef.current.clear();
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
      dragStartOpenFoldersRef.current = { ...openFolders };
      dragAutoExpandedFoldersRef.current.clear();
      setActiveDragId(String(event.active.id));
      const dragData = event.active.data.current as
        | FolderTreeDragData
        | undefined;
      setActiveDragLabel(dragData?.label ?? null);
    },
    [markRecentDrag, openFolders],
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      clearHoverExpandTimeout();
      markRecentDrag();
      setActiveDragId(null);
      setActiveDragLabel(null);
      resetDragFolderState();
    },
    [clearHoverExpandTimeout, markRecentDrag, resetDragFolderState],
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
        dragAutoExpandedFoldersRef.current.add(folderNodeId);
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
      setActiveDragLabel(null);

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
        resetDragFolderState();
        return;
      }

      if (dropTarget.type === "inside" && dropTarget.parentNodeId) {
        const targetFolderNodeId = dropTarget.parentNodeId;
        const didAutoExpand =
          dragAutoExpandedFoldersRef.current.has(targetFolderNodeId);
        const wasOpenAtDragStart =
          dragStartOpenFoldersRef.current[targetFolderNodeId] ?? false;

        setFolderOpen(targetFolderNodeId, didAutoExpand || wasOpenAtDragStart);
      }

      resetDragFolderState();

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
    [
      clearHoverExpandTimeout,
      markRecentDrag,
      moveItem,
      resetDragFolderState,
      setFolderOpen,
    ],
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
        collisionDetection={treeCollisionDetection}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <FolderTreeInteractionsContext.Provider value={{ shouldSuppressClick }}>
          <div className="overflow-x-clip rounded-3xl border bg-background/80 p-2 shadow-xs">
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
        </FolderTreeInteractionsContext.Provider>
        <TreeDragOverlay label={activeDragLabel} />
      </DndContext>
    </section>
  );
}
