"use client";

import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useIsFetching, useQuery } from "@tanstack/react-query";
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
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { TreeEmptyDropTarget } from "~/components/tree-empty-drop-target";
import { TreeInsertDropBands } from "~/components/tree-insert-drop-bands";
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
import { useTreeChildren } from "~/hooks/use-tree-children";
import { useTreeController } from "~/hooks/use-tree-controller";
import { TreeMoveProvider } from "~/hooks/use-tree-item-moves";
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
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { AppSidebarPageItemSkeleton } from "./app-sidebar-page-item-skeleton";
import { AppSidebarTreeActions } from "./app-sidebar-tree-actions";

type AppSidebarPagesProps = {
  defaultOpen?: boolean;
};

type SidebarTreeProps = {
  activeDragId: string | null;
  enabled?: boolean;
  isDnDEnabled: boolean;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
};

type SidebarTreeData = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: TreeItem[];
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  shouldRenderNestedContent: boolean;
  shouldShowInitialSkeleton: boolean;
};

const DEFAULT_TREE_ITEM_CLASSNAME = "ml-2 border-sidebar-border border-l ps-1";

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
const APP_SIDEBAR_PAGES_CONTENT_ID = "app-sidebar-pages-content";

function SidebarTreeEmptyDropTarget({
  activeDragId,
  dropId,
  isDnDEnabled,
}: {
  activeDragId: string | null;
  dropId: string;
  isDnDEnabled: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
  });
  const isDragActive = isDnDEnabled && !!activeDragId;

  return (
    <SidebarMenuSubItem className={DEFAULT_TREE_ITEM_CLASSNAME}>
      <TreeEmptyDropTarget
        active={isDragActive}
        isOver={isOver}
        targetRef={setNodeRef}
      />
    </SidebarMenuSubItem>
  );
}

function DraggablePageRow({
  activeDragId,
  isDnDEnabled,
  nextEdgeId,
  page,
  parentNodeId,
  showBeforeLine = true,
}: {
  activeDragId: string | null;
  isDnDEnabled: boolean;
  nextEdgeId?: string;
  page: TreePage;
  parentNodeId: string | null;
  showBeforeLine?: boolean;
}) {
  const { shouldSuppressClick } = useSidebarTreeInteractions();
  const itemRef: TreeItemRef = {
    kind: "page",
    nodeId: page.node_id,
  };
  const draggableId = getDragId(itemRef);
  const { attributes, listeners, setNodeRef } = useDraggable({
    data: {
      edgeId: page.edge_id,
      item: itemRef,
      label: page.title || "New page",
      parentNodeId,
    } satisfies TreeDragData,
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
      dropOverlay={
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
      }
      isDragging={activeDragId === draggableId}
      itemRef={setNodeRef}
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
  nextEdgeId?: string;
  openFolders: Record<string, boolean>;
  parentNodeId: string | null;
  setFolderOpen: (folderNodeId: string, open: boolean) => void;
  showBeforeLine?: boolean;
}) {
  const { shouldSuppressClick } = useSidebarTreeInteractions();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const itemRef: TreeItemRef = {
    kind: "folder",
    nodeId: folder.node_id,
  };
  const draggableId = getDragId(itemRef);
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
    disabled: !isDnDEnabled || isPending,
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
      >
        <div className="relative py-1">
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
            {...(isDnDEnabled
              ? {
                  ...attributes,
                  ...listeners,
                }
              : undefined)}
            className={cn(
              "min-h-7 select-none rounded-md",
              "group/folder-navigation relative z-10 flex min-w-0 items-center gap-0.5",
              isOverInside &&
                isDragActive &&
                "bg-primary/20 ring-1 ring-primary/30",
            )}
          >
            <SidebarMenuSubButton
              asChild
              isActive={isActive}
              className="w-full pr-12"
            >
              <button
                type="button"
                data-tree-drag-handle
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${folder.name || "New folder"}`}
                onClick={handleFolderToggle}
                className="flex w-full min-w-0 items-center gap-1"
              >
                <span className="relative flex size-3 shrink-0 items-center justify-center">
                  {isOpen ? (
                    <FolderOpen className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                  ) : (
                    <FolderClosed className="size-3 shrink-0 transition-opacity duration-150 group-focus-within/folder-navigation:opacity-0 group-hover/folder-navigation:opacity-0" />
                  )}
                  <ChevronRight className="absolute inset-0 size-3 shrink-0 opacity-0 transition-all duration-150 group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100 group-data-[open]/folder-collapsible:rotate-90" />
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
                className="absolute top-1/2 right-7 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-sidebar-foreground opacity-100 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-focus-within/folder-navigation:opacity-100 group-hover/folder-navigation:opacity-100 md:opacity-0"
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
        </div>

        {treeData.shouldRenderNestedContent ? (
          <>
            <CollapsibleContent
              animateHeight
              className={cn(treeData.items.length > 0 && "pt-1")}
            >
              <SidebarMenuSub className="mx-0 mr-0 gap-0 border-none px-0">
                <SidebarTreeRows
                  activeDragId={activeDragId}
                  isDnDEnabled={isDnDEnabled}
                  openFolders={openFolders}
                  parentNodeId={folder.node_id}
                  setFolderOpen={setFolderOpen}
                  showEmptyParentDropZone={false}
                  treeData={treeData}
                />
              </SidebarMenuSub>
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
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarTreeRows({
  activeDragId,
  isDnDEnabled,
  openFolders,
  parentNodeId,
  setFolderOpen,
  showEmptyParentDropZone,
  treeData,
}: Omit<SidebarTreeProps, "enabled"> & {
  showEmptyParentDropZone: boolean;
  treeData: SidebarTreeData;
}) {
  return (
    <>
      {treeData.shouldShowInitialSkeleton ? (
        <AppSidebarPageItemSkeleton className={DEFAULT_TREE_ITEM_CLASSNAME} />
      ) : null}

      {showEmptyParentDropZone &&
      treeData.items.length === 0 &&
      !treeData.shouldShowInitialSkeleton ? (
        <SidebarTreeEmptyDropTarget
          activeDragId={activeDragId}
          dropId={getParentDropId(parentNodeId)}
          isDnDEnabled={isDnDEnabled}
        />
      ) : null}

      {treeData.items.map((item, index) => {
        const isFirst = index === 0;
        const nextEdgeId = treeData.items[index + 1]?.edge_id;
        if (item.pending && item.kind === "page")
          return (
            <AppSidebarPageItemSkeleton
              key={item.node_id}
              className={DEFAULT_TREE_ITEM_CLASSNAME}
            />
          );
        return item.kind === "folder" ? (
          <DraggableFolderRow
            key={`${item.kind}-${item.node_id}`}
            activeDragId={activeDragId}
            folder={item.folder}
            isDnDEnabled={isDnDEnabled}
            isPending={item.pending}
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
            nextEdgeId={nextEdgeId}
            page={item.page}
            parentNodeId={parentNodeId}
            showBeforeLine={isFirst}
          />
        );
      })}

      {treeData.isFetchingNextPage ? (
        <AppSidebarPageItemSkeleton className={DEFAULT_TREE_ITEM_CLASSNAME} />
      ) : null}

      {treeData.hasNextPage ? (
        <SidebarMenuSubItem
          className={cn(DEFAULT_TREE_ITEM_CLASSNAME, "py-0")}
          aria-hidden
        >
          <div ref={treeData.loadMoreRef} className="h-px w-full" />
        </SidebarMenuSubItem>
      ) : null}
      {treeData.items.length > 0 ? (
        <TreeEndDropTarget
          as="li"
          className={DEFAULT_TREE_ITEM_CLASSNAME}
          fill={parentNodeId === null}
          parentNodeId={parentNodeId}
          active={isDnDEnabled && activeDragId !== null}
        />
      ) : null}
    </>
  );
}

function SidebarTree({
  activeDragId,
  enabled = true,
  isDnDEnabled,
  openFolders,
  parentNodeId,
  setFolderOpen,
}: SidebarTreeProps) {
  const treeData = useTreeChildren({
    enabled,
    parentNodeId,
  });

  return (
    <SidebarTreeRows
      activeDragId={activeDragId}
      isDnDEnabled={isDnDEnabled}
      openFolders={openFolders}
      parentNodeId={parentNodeId}
      setFolderOpen={setFolderOpen}
      showEmptyParentDropZone
      treeData={treeData}
    />
  );
}

export const AppSidebarPages = ({
  defaultOpen = true,
}: AppSidebarPagesProps) => {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const trpc = useTRPC();
  const { state, setOpen } = useSidebar();
  const isPagesRoute =
    pathname.startsWith("/pages") || pathname.startsWith("/folders");
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const {
    openFolders,
    setOpenFolders,
    setFolderOpen,
    activeDragId,
    activeDragLabel,
    isDnDEnabled,
    shouldSuppressClick,
    dndContextProps,
  } = useTreeController();
  const rootTreeQueryKey = trpc.tree.getChildrenPaginated.infiniteQueryKey(
    getInfiniteSidebarTreeQueryOptions(null),
  );
  const isRootFetching = useIsFetching({ queryKey: rootTreeQueryKey });
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
    if (
      lastExpandedPathRef.current ===
      `${pathname}:${ancestorPath.map((a) => a.node_id).join("/")}`
    ) {
      return;
    }
    lastExpandedPathRef.current = `${pathname}:${ancestorPath.map((a) => a.node_id).join("/")}`;

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
  }, [ancestorPath, pathname, setOpenFolders]);

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
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[open]/collapsible:rotate-90" />
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
        <DndContext {...dndContextProps}>
          <TreeMoveProvider>
            <SidebarTreeInteractionsContext.Provider
              value={{ shouldSuppressClick }}
            >
              <SidebarMenuSub className="mx-0 mr-0 flex-1 gap-0 overflow-x-clip overflow-y-scroll border-none px-0">
                <SidebarTree
                  activeDragId={activeDragId}
                  isDnDEnabled={isDnDEnabled}
                  openFolders={openFolders}
                  parentNodeId={null}
                  setFolderOpen={setFolderOpen}
                />
              </SidebarMenuSub>
            </SidebarTreeInteractionsContext.Provider>
          </TreeMoveProvider>
          <TreeDragOverlay label={activeDragLabel} />
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  );
};
