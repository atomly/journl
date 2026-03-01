"use client";

import type { Folder, Page } from "@acme/db/schema";
import {
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
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
import { ChevronRight, FileText, Folder as FolderIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { useSidebar } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/cn";
import {
  moveNode as moveTreeNode,
  type QuerySnapshot,
  restoreQueries,
  snapshotQueries,
  updateNode,
} from "~/trpc/cache/tree-cache";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { AppSidebarTreeActions } from "../../../@appSidebar/_components/app-sidebar-tree-actions";
import {
  DeletePageButton,
  DeletePageDialog,
  DeletePageDialogTrigger,
} from "../../../@appSidebar/_components/delete-page-button";

const TREE_ITEM_INDENT_CLASSNAME = "ml-3 pl-2";
const TREE_ROW_CLASSNAME =
  "group/tree-row flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors";
const DROP_ZONE_CLASSNAME = "h-1 rounded-sm transition-colors";
const INFINITE_SCROLL_ROOT_MARGIN = "120px 0px";
const DRAG_CLICK_SUPPRESSION_MS = 200;
const ROOT_PARENT_KEY = "root";
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
      parent_node_id: string | null;
    }
  | {
      edge_id: string;
      kind: "page";
      node_id: string;
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
  isDnDEnabled: boolean;
  onFolderInsideHover: (folderNodeId: string) => void;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
  shouldSuppressClick: () => boolean;
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
  className,
  dropId,
  isDnDEnabled,
}: {
  className?: string;
  dropId: string;
  isDnDEnabled: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
  });

  if (!isDnDEnabled) {
    return null;
  }

  return (
    <div className={cn(TREE_ITEM_INDENT_CLASSNAME, "py-0", className)}>
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

function DraggablePageRow({
  activeDragId,
  isDnDEnabled,
  page,
  parentNodeId,
  shouldSuppressClick,
}: {
  activeDragId: string | null;
  isDnDEnabled: boolean;
  page: TreePage;
  parentNodeId: string | null;
  shouldSuppressClick: () => boolean;
}) {
  const pathname = usePathname();
  const itemRef: FolderTreeItemRef = {
    kind: "page",
    nodeId: page.node_id,
  };
  const draggableId = getDragId(itemRef);
  const pageHref = `/pages/${page.id}`;
  const isActive = pathname === pageHref;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    data: {
      item: itemRef,
      parentNodeId,
    } satisfies FolderTreeDragData,
    disabled: !isDnDEnabled,
    id: draggableId,
  });

  return (
    <DeletePageDialog page={page}>
      <div className={cn(TREE_ITEM_INDENT_CLASSNAME, "py-0")}>
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
            if (!shouldSuppressClick()) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
          }}
          {...(isDnDEnabled
            ? {
                ...attributes,
                ...listeners,
              }
            : undefined)}
        >
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

          <DeletePageDialogTrigger asChild>
            <DeletePageButton className="pointer-events-none invisible bg-transparent! pr-0! text-destructive! opacity-0 transition-opacity group-focus-within/tree-row:pointer-events-auto group-focus-within/tree-row:visible group-focus-within/tree-row:opacity-100 group-hover/tree-row:pointer-events-auto group-hover/tree-row:visible group-hover/tree-row:opacity-100" />
          </DeletePageDialogTrigger>
        </div>
      </div>
    </DeletePageDialog>
  );
}

function DraggableFolderRow({
  activeDragId,
  folder,
  isDnDEnabled,
  onFolderInsideHover,
  openFolders,
  parentNodeId,
  setFolderOpen,
  shouldSuppressClick,
}: {
  activeDragId: string | null;
  folder: TreeFolder;
  isDnDEnabled: boolean;
  onFolderInsideHover: (folderNodeId: string) => void;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
  shouldSuppressClick: () => boolean;
}) {
  const pathname = usePathname();
  const itemRef: FolderTreeItemRef = {
    kind: "folder",
    nodeId: folder.node_id,
  };
  const draggableId = getDragId(itemRef);
  const folderHref = `/pages/folders/${folder.id}`;
  const isActive = pathname === folderHref;
  const isOpen = openFolders[folder.node_id] ?? false;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    data: {
      item: itemRef,
      parentNodeId,
    } satisfies FolderTreeDragData,
    disabled: !isDnDEnabled,
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

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => {
        setFolderOpen(folder.node_id, open);
      }}
      className="group/folder-collapsible"
    >
      <div className={cn(TREE_ITEM_INDENT_CLASSNAME, "py-0")}>
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
            if (!shouldSuppressClick()) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div
            {...(isDnDEnabled
              ? {
                  ...attributes,
                  ...listeners,
                }
              : undefined)}
            ref={setInsideDropNodeRef}
            className={cn(
              "relative flex min-w-0 flex-1 items-center gap-1.5 rounded-md pr-7",
              isOverInside && isDnDEnabled && "bg-primary/10",
            )}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={isOpen ? "Collapse folder" : "Expand folder"}
              >
                <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/folder-collapsible:rotate-90" />
              </button>
            </CollapsibleTrigger>

            <Link
              href={folderHref}
              className="flex w-full min-w-0 items-center gap-2"
            >
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background">
                <FolderIcon className="size-3 text-primary" />
              </span>
              <span className="line-clamp-1 min-w-0 flex-1 truncate text-left font-medium">
                {folder.name || "New folder"}
              </span>
            </Link>

            <div className="absolute inset-y-0 right-0 flex items-center">
              <AppSidebarTreeActions
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
              isDnDEnabled={isDnDEnabled}
              onFolderInsideHover={onFolderInsideHover}
              openFolders={openFolders}
              parentNodeId={folder.node_id}
              setFolderOpen={setFolderOpen}
              shouldSuppressClick={shouldSuppressClick}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function FolderTreeLevel({
  activeDragId,
  isDnDEnabled,
  onFolderInsideHover,
  openFolders,
  parentNodeId,
  setFolderOpen,
  shouldSuppressClick,
}: TreeLevelProps) {
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryOptions = trpc.tree.getChildrenPaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentNodeId),
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      ...queryOptions,
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
        <div className={cn(TREE_ITEM_INDENT_CLASSNAME, "py-0")}>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : null}

      {items.length === 0 && !shouldShowInitialSkeleton ? (
        <FolderTreeDropZone
          dropId={getParentDropId(parentNodeId)}
          isDnDEnabled={isDnDEnabled}
        />
      ) : null}

      {items.map((item) => {
        return (
          <Fragment key={`${item.kind}-${item.node_id}`}>
            <FolderTreeDropZone
              dropId={getBeforeDropId({
                anchorEdgeId: item.edge_id,
                parentNodeId,
              })}
              isDnDEnabled={isDnDEnabled}
            />

            {item.kind === "folder" ? (
              <DraggableFolderRow
                activeDragId={activeDragId}
                folder={item.folder}
                isDnDEnabled={isDnDEnabled}
                onFolderInsideHover={onFolderInsideHover}
                openFolders={openFolders}
                parentNodeId={parentNodeId}
                setFolderOpen={setFolderOpen}
                shouldSuppressClick={shouldSuppressClick}
              />
            ) : (
              <DraggablePageRow
                activeDragId={activeDragId}
                isDnDEnabled={isDnDEnabled}
                page={item.page}
                parentNodeId={parentNodeId}
                shouldSuppressClick={shouldSuppressClick}
              />
            )}

            <FolderTreeDropZone
              dropId={getAfterDropId({
                anchorEdgeId: item.edge_id,
                parentNodeId,
              })}
              isDnDEnabled={isDnDEnabled}
            />
          </Fragment>
        );
      })}

      {isFetchingNextPage ? (
        <div className={cn(TREE_ITEM_INDENT_CLASSNAME, "py-0")}>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : null}

      <div className={cn(TREE_ITEM_INDENT_CLASSNAME, "py-0")} aria-hidden>
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
  const { isMobile } = useSidebar();
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

  const isDnDEnabled = !isMobile;
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
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
    [clearHoverExpandTimeout, isDnDEnabled, openFolders, setFolderOpen],
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
    [clearHoverExpandTimeout, handleFolderInsideHover, isDnDEnabled],
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
    [clearHoverExpandTimeout, isDnDEnabled, markRecentDrag, moveItem],
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-base">Contents</h2>
          <p className="text-muted-foreground text-sm">
            Includes folders and pages in this tree.
          </p>
        </div>
        <AppSidebarTreeActions
          kind="folder"
          parentNodeId={rootParentNodeId}
          triggerVariant="inline"
        />
      </div>

      <DndContext
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={isDnDEnabled ? sensors : undefined}
      >
        <div className="rounded-3xl border bg-background/80 p-2 shadow-xs">
          <div className="space-y-0.5">
            <FolderTreeLevel
              activeDragId={activeDragId}
              isDnDEnabled={isDnDEnabled}
              onFolderInsideHover={handleFolderInsideHover}
              openFolders={openFolders}
              parentNodeId={rootParentNodeId}
              setFolderOpen={setFolderOpen}
              shouldSuppressClick={shouldSuppressClick}
            />
          </div>
        </div>
      </DndContext>
    </section>
  );
}
