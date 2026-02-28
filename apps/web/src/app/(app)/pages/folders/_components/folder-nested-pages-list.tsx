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
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronRight, FileText, Folder as FolderIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSidebar } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/cn";
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { AppSidebarTreeActions } from "../../../@appSidebar/_components/app-sidebar-tree-actions";
import {
  DeletePageButton,
  DeletePageDialog,
  DeletePageDialogTrigger,
} from "../../../@appSidebar/_components/delete-page-button";

const INFINITE_SCROLL_ROOT_MARGIN = "200px 0px";
const NESTED_LEVEL_CLASSNAME = "ml-6 border-sidebar-border/50 border-l pl-3";
const ROW_CLASSNAME =
  "group flex items-center gap-2 rounded-sm px-3 py-2 transition-colors hover:bg-muted/60";
const DROP_ZONE_CLASSNAME = "h-1 rounded-sm transition-colors";
const DRAG_CLICK_SUPPRESSION_MS = 200;
const ROOT_PARENT_KEY = "root";

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
  rootFolderId?: string | null;
};

type TreeLevelProps = {
  activeDragId: string | null;
  isDnDEnabled: boolean;
  nested?: boolean;
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
  dropId,
  isDnDEnabled,
}: {
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
    <div className="px-3 py-0.5">
      <div
        ref={setNodeRef}
        className={cn(
          DROP_ZONE_CLASSNAME,
          "bg-transparent",
          isOver && "bg-primary/25",
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
  const itemRef: FolderTreeItemRef = {
    kind: "page",
    nodeId: page.node_id,
  };
  const draggableId = getDragId(itemRef);
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
      <div
        ref={setNodeRef}
        onClickCapture={(event) => {
          if (!shouldSuppressClick()) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
        }}
        className={cn(
          ROW_CLASSNAME,
          activeDragId === draggableId && "opacity-60",
        )}
        style={
          transform
            ? {
                transform: CSS.Translate.toString(transform),
              }
            : undefined
        }
        {...(isDnDEnabled
          ? {
              ...attributes,
              ...listeners,
            }
          : undefined)}
      >
        <Link
          href={`/pages/${page.id}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-2"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{page.title || "New page"}</span>
          </span>
          <span className="shrink-0 text-muted-foreground text-xs">
            {new Date(page.updated_at).toLocaleDateString()}
          </span>
        </Link>
        <DeletePageDialogTrigger asChild>
          <DeletePageButton className="h-7 w-7 shrink-0 p-0 text-destructive opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100" />
        </DeletePageDialogTrigger>
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
  const itemRef: FolderTreeItemRef = {
    kind: "folder",
    nodeId: folder.node_id,
  };
  const draggableId = getDragId(itemRef);
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
    <div
      ref={setNodeRef}
      className={cn(
        ROW_CLASSNAME,
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
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-muted"
        onClick={(event) => {
          event.stopPropagation();
          setFolderOpen(folder.node_id, !isOpen);
        }}
      >
        <ChevronRight
          className={cn("size-3 transition-transform", isOpen && "rotate-90")}
        />
      </button>

      <div
        ref={setInsideDropNodeRef}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-sm",
          isOverInside && isDnDEnabled && "bg-primary/10",
        )}
      >
        <Link
          href={`/pages/folders/${folder.id}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.name || "New folder"}</span>
        </Link>

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

      {isOpen ? (
        <FolderTreeLevel
          activeDragId={activeDragId}
          isDnDEnabled={isDnDEnabled}
          parentNodeId={folder.node_id}
          onFolderInsideHover={onFolderInsideHover}
          openFolders={openFolders}
          setFolderOpen={setFolderOpen}
          shouldSuppressClick={shouldSuppressClick}
          nested
        />
      ) : null}
    </div>
  );
}

function FolderTreeLevel({
  activeDragId,
  isDnDEnabled,
  parentNodeId,
  onFolderInsideHover,
  openFolders,
  setFolderOpen,
  shouldSuppressClick,
  nested = false,
}: TreeLevelProps) {
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const queryOptions = trpc.tree.getChildrenPaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentNodeId),
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      ...queryOptions,
      getNextPageParam: (lastPage) => {
        return lastPage.nextCursor;
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
    <div className={cn("space-y-1", nested && NESTED_LEVEL_CLASSNAME)}>
      {shouldShowInitialSkeleton ? (
        <>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </>
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

      {isFetchingNextPage ? <Skeleton className="h-9 w-full" /> : null}

      <div ref={loadMoreRef} className="h-px w-full" />
    </div>
  );
}

export function FolderNestedPagesList({
  rootFolderId = null,
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
  const recentDragUntilRef = useRef(0);

  const rootFolderQuery = useQuery(
    trpc.folders.getById.queryOptions(
      rootFolderId
        ? {
            id: rootFolderId,
          }
        : skipToken,
    ),
  );
  const rootParentNodeId = rootFolderId
    ? (rootFolderQuery.data?.node_id ?? null)
    : null;

  const { mutate: moveItem } = useMutation(
    trpc.tree.moveItem.mutationOptions({}),
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
      }, 350);
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

      moveItem(
        {
          destination,
          node_id: activeData.item.nodeId,
        },
        {
          onSettled: () => {
            void queryClient.invalidateQueries(
              trpc.tree.getChildrenPaginated.infiniteQueryFilter(),
            );
            void queryClient.invalidateQueries(
              trpc.tree.getNestedPagesPaginated.infiniteQueryFilter(),
            );
          },
        },
      );
    },
    [
      clearHoverExpandTimeout,
      isDnDEnabled,
      markRecentDrag,
      moveItem,
      queryClient,
      trpc.tree,
    ],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-base">Contents</h2>
          <p className="text-muted-foreground text-sm">
            Includes folders and pages in this tree.
          </p>
        </div>
        <AppSidebarTreeActions
          kind="root"
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
        <div className="rounded-md border p-2">
          <FolderTreeLevel
            activeDragId={activeDragId}
            isDnDEnabled={isDnDEnabled}
            parentNodeId={rootParentNodeId}
            onFolderInsideHover={handleFolderInsideHover}
            openFolders={openFolders}
            setFolderOpen={setFolderOpen}
            shouldSuppressClick={shouldSuppressClick}
          />
        </div>
      </DndContext>
    </section>
  );
}
