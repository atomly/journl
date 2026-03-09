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
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
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
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { AppSidebarPageItemSkeleton } from "./app-sidebar-page-item-skeleton";
import { AppSidebarTreeActions } from "./app-sidebar-tree-actions";

type AppSidebarPagesProps = {
  defaultOpen?: boolean;
};

type MoveMutationContext = {
  treeSnapshots: QuerySnapshot[];
};

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

type SidebarTreeProps = {
  activeDragId: string | null;
  enabled?: boolean;
  isDnDEnabled: boolean;
  onFolderInsideHover: (folderNodeId: string) => void;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
};

type SidebarTreeItemRef = {
  kind: "folder" | "page";
  nodeId: string;
};

type SidebarTreeDragData = {
  item: SidebarTreeItemRef;
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

const DEFAULT_TREE_ITEM_CLASSNAME =
  "ml-2 border-sidebar-border border-l py-0.5 ps-1";
const DROP_ZONE_CLASSNAME = "h-1 rounded-sm transition-colors";

type SidebarTreeInteractions = {
  shouldSuppressClick: () => boolean;
};

const SidebarTreeInteractionsContext =
  createContext<SidebarTreeInteractions | null>(null);

function useSidebarTreeInteractions(): SidebarTreeInteractions {
  const ctx = useContext(SidebarTreeInteractionsContext);
  if (!ctx) {
    throw new Error(
      "useSidebarTreeInteractions must be used within SidebarTreeInteractionsProvider",
    );
  }
  return ctx;
}
const INFINITE_SCROLL_ROOT_MARGIN = "120px 0px";
const DRAG_CLICK_SUPPRESSION_MS = 200;
const ROOT_PARENT_KEY = "root";
const APP_SIDEBAR_PAGES_CONTENT_ID = "app-sidebar-pages-content";

function encodeParentKey(parentNodeId: string | null) {
  return parentNodeId ?? ROOT_PARENT_KEY;
}

function decodeParentKey(parentKey: string) {
  return parentKey === ROOT_PARENT_KEY ? null : parentKey;
}

function getDragId(item: SidebarTreeItemRef) {
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

function SidebarTreeDropZone({
  activeDragId,
  className,
  dropId,
  isDnDEnabled,
}: {
  activeDragId: string | null;
  className?: string;
  dropId: string;
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
    <SidebarMenuSubItem
      className={cn(DEFAULT_TREE_ITEM_CLASSNAME, "py-0", className)}
    >
      <div
        ref={setNodeRef}
        className={cn(
          DROP_ZONE_CLASSNAME,
          "bg-transparent",
          isOver && "bg-sidebar-primary/35",
        )}
      />
    </SidebarMenuSubItem>
  );
}

function DraggablePageRow({
  activeDragId,
  isDnDEnabled,
  page,
  parentNodeId,
}: {
  activeDragId: string | null;
  isDnDEnabled: boolean;
  page: TreePage;
  parentNodeId: string | null;
}) {
  const { shouldSuppressClick } = useSidebarTreeInteractions();
  const itemRef: SidebarTreeItemRef = {
    kind: "page",
    nodeId: page.node_id,
  };
  const draggableId = getDragId(itemRef);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    data: {
      item: itemRef,
      parentNodeId,
    } satisfies SidebarTreeDragData,
    disabled: !isDnDEnabled,
    id: draggableId,
  });

  return (
    <AppSidebarPageItem
      page={page}
      className={DEFAULT_TREE_ITEM_CLASSNAME}
      dragActivatorProps={
        isDnDEnabled
          ? {
              ...attributes,
              ...listeners,
            }
          : undefined
      }
      isDragging={activeDragId === draggableId}
      itemRef={setNodeRef}
      itemStyle={
        transform
          ? {
              transform: CSS.Translate.toString(transform),
            }
          : undefined
      }
      onItemClickCapture={(event) => {
        if (!shouldSuppressClick()) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      }}
    />
  );
}

function DraggableFolderRow({
  activeDragId,
  folder,
  isDnDEnabled,
  isPending = false,
  onFolderInsideHover,
  openFolders,
  parentNodeId,
  setFolderOpen,
}: {
  activeDragId: string | null;
  folder: TreeFolder;
  isDnDEnabled: boolean;
  isPending?: boolean;
  onFolderInsideHover: (folderNodeId: string) => void;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
}) {
  const { shouldSuppressClick } = useSidebarTreeInteractions();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const itemRef: SidebarTreeItemRef = {
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
    } satisfies SidebarTreeDragData,
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

  const handleFolderToggle = useCallback(() => {
    if (shouldSuppressClick()) {
      return;
    }

    setFolderOpen(folder.node_id, !isOpen);
  }, [folder.node_id, isOpen, setFolderOpen, shouldSuppressClick]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => {
        setFolderOpen(folder.node_id, open);
      }}
      className="group/folder-collapsible"
    >
      <SidebarMenuSubItem
        ref={setNodeRef}
        onClickCapture={(event) => {
          if (!shouldSuppressClick()) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
        }}
        className={cn(
          "group/folder-item group/tree-row",
          isActive && "border-sidebar-primary",
          activeDragId === draggableId && "opacity-60",
          DEFAULT_TREE_ITEM_CLASSNAME,
        )}
        style={
          transform
            ? {
                transform: CSS.Translate.toString(transform),
              }
            : undefined
        }
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
            "group/folder-navigation relative flex min-w-0 items-center gap-0.5 rounded-sm",
            isOverInside && isDnDEnabled && "bg-sidebar-primary/15",
          )}
        >
          <SidebarMenuSubButton
            asChild
            isActive={isActive}
            className="w-full pr-12"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
              onClick={handleFolderToggle}
              className="flex w-full min-w-0 items-center gap-1"
            >
              <span className="relative flex size-3 shrink-0 items-center justify-center">
                {isOpen ? (
                  <FolderOpen className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                ) : (
                  <FolderClosed className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                )}
                <ChevronRight className="absolute inset-0 size-3 shrink-0 opacity-0 transition-all duration-150 group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100 group-data-[state=open]/folder-collapsible:rotate-90" />
              </span>
              <span className="line-clamp-1 min-w-0 flex-1 truncate text-left">
                {folder.name || "New folder"}
              </span>
            </button>
          </SidebarMenuSubButton>

          {isPending ? (
            <output className="absolute top-1/2 right-7 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-sidebar-foreground/70 opacity-100">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="sr-only">Folder is still being created</span>
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
              className="absolute top-1/2 right-7 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100"
            >
              <ArrowRight className="size-3.5" />
            </Link>
          )}

          <AppSidebarTreeActions
            disabled={isPending}
            kind="folder"
            folder={folder}
            parentNodeId={folder.node_id}
            onCreateStart={() => {
              setFolderOpen(folder.node_id, true);
            }}
            onCreateSuccess={() => {
              setFolderOpen(folder.node_id, true);
            }}
          />
        </div>

        <CollapsibleContent className="pt-1">
          <SidebarMenuSub className="mx-0 mr-0 gap-0 border-none px-0">
            <SidebarTree
              activeDragId={activeDragId}
              enabled={isOpen}
              isDnDEnabled={isDnDEnabled}
              onFolderInsideHover={onFolderInsideHover}
              openFolders={openFolders}
              parentNodeId={folder.node_id}
              setFolderOpen={setFolderOpen}
            />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarTree({
  activeDragId,
  enabled = true,
  isDnDEnabled,
  onFolderInsideHover,
  openFolders,
  parentNodeId,
  setFolderOpen,
}: SidebarTreeProps) {
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

  const items = (data?.pages?.flatMap((page) => page.items) ??
    []) as TreeItem[];

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
        <AppSidebarPageItemSkeleton className={DEFAULT_TREE_ITEM_CLASSNAME} />
      ) : null}

      {items.length === 0 && !shouldShowInitialSkeleton ? (
        <SidebarTreeDropZone
          activeDragId={activeDragId}
          dropId={getParentDropId(parentNodeId)}
          isDnDEnabled={isDnDEnabled}
        />
      ) : null}

      {items.map((item) => {
        return (
          <Fragment key={`${item.kind}-${item.node_id}`}>
            <SidebarTreeDropZone
              activeDragId={activeDragId}
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
                isPending={item.pending}
                onFolderInsideHover={onFolderInsideHover}
                openFolders={openFolders}
                parentNodeId={parentNodeId}
                setFolderOpen={setFolderOpen}
              />
            ) : (
              <DraggablePageRow
                activeDragId={activeDragId}
                isDnDEnabled={isDnDEnabled}
                page={item.page}
                parentNodeId={parentNodeId}
              />
            )}

            <SidebarTreeDropZone
              activeDragId={activeDragId}
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
        <AppSidebarPageItemSkeleton className={DEFAULT_TREE_ITEM_CLASSNAME} />
      ) : null}

      <SidebarMenuSubItem
        className={cn(DEFAULT_TREE_ITEM_CLASSNAME, "py-0")}
        aria-hidden
      >
        <div ref={loadMoreRef} className="h-px w-full" />
      </SidebarMenuSubItem>
    </>
  );
}

export const AppSidebarPages = ({
  defaultOpen = true,
}: AppSidebarPagesProps) => {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { state, setOpen } = useSidebar();
  const isPagesRoute =
    pathname.startsWith("/pages") || pathname.startsWith("/folders");
  const [isOpen, setIsOpen] = useState(defaultOpen);
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
  const rootTreeQueryKey = trpc.tree.getChildrenPaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(null),
  ).queryKey;
  const isRootFetching = useIsFetching({
    queryKey: rootTreeQueryKey,
  });

  // Auto-expand ancestor folders on navigation
  const activePageId = pathname.startsWith("/pages/")
    ? (params.id ?? null)
    : null;
  const activeFolderId = pathname.startsWith("/folders/")
    ? (params.id ?? null)
    : null;
  const ancestorQueryInput = activePageId
    ? { page_id: activePageId }
    : activeFolderId
      ? { folder_id: activeFolderId }
      : null;
  const { data: ancestorPath } = useQuery({
    ...trpc.tree.getAncestorPath.queryOptions(ancestorQueryInput ?? {}),
    enabled: !!ancestorQueryInput,
  });
  const lastExpandedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ancestorPath || ancestorPath.length === 0) {
      return;
    }

    // Only auto-expand once per pathname to avoid fighting user collapse
    if (lastExpandedPathRef.current === pathname) {
      return;
    }
    lastExpandedPathRef.current = pathname;

    const folderAncestorNodeIds = ancestorPath
      .filter((a) => a.node_type === "folder")
      .map((a) => a.node_id);

    if (folderAncestorNodeIds.length === 0) {
      return;
    }

    setOpenFolders((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const nodeId of folderAncestorNodeIds) {
        if (!next[nodeId]) {
          next[nodeId] = true;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [ancestorPath, pathname]);

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

  const handlePagesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (state === "collapsed") {
      setOpen(true);
      setIsOpen(true);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

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
        | SidebarTreeDragData
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
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/collapsible flex min-h-0 flex-1 flex-col"
    >
      <div className="group/tree-row relative">
        <CollapsibleTrigger
          asChild
          aria-controls={APP_SIDEBAR_PAGES_CONTENT_ID}
        >
          <SidebarMenuButton
            isActive={isPagesRoute}
            className={cn(
              "min-h-8 border border-transparent pr-2 text-foreground!",
              isPagesRoute && "border-sidebar-primary/50",
            )}
            tooltip="Library"
            onClick={handlePagesClick}
          >
            {isRootFetching > 0 ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <BookOpen />
            )}
            <span>Library</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <AppSidebarTreeActions
          className="right-8"
          kind="root"
          parentNodeId={null}
          onCreateStart={() => {
            if (state === "collapsed") {
              setOpen(true);
            }
            setIsOpen(true);
          }}
          onCreateSuccess={() => {
            setIsOpen(true);
          }}
        />
      </div>

      <CollapsibleContent
        id={APP_SIDEBAR_PAGES_CONTENT_ID}
        className="flex h-full min-h-0 flex-col"
      >
        {state !== "collapsed" ? (
          <div className="px-2 py-2">
            <AppSidebarTreeActions
              kind="root"
              parentNodeId={null}
              triggerMode="direct-page"
              className="group-data-[collapsible=icon]:hidden"
              onCreateStart={() => {
                setIsOpen(true);
              }}
              onCreateSuccess={() => {
                setIsOpen(true);
              }}
            />
          </div>
        ) : null}
        <DndContext
          collisionDetection={pointerWithin}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
          sensors={sensors}
        >
          <SidebarTreeInteractionsContext.Provider
            value={{ shouldSuppressClick }}
          >
            <SidebarMenuSub className="mx-0 mr-0 flex-1 gap-0 overflow-scroll border-none px-0">
              <SidebarTree
                activeDragId={activeDragId}
                isDnDEnabled={isDnDEnabled}
                onFolderInsideHover={handleFolderInsideHover}
                openFolders={openFolders}
                parentNodeId={null}
                setFolderOpen={setFolderOpen}
              />
            </SidebarMenuSub>
          </SidebarTreeInteractionsContext.Provider>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  );
};
