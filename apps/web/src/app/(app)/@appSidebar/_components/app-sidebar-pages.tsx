"use client";

import type { Folder } from "@acme/db/schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Folder as FolderIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { getInfiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { useTRPC } from "~/trpc/react";
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { AppSidebarPageItemSkeleton } from "./app-sidebar-page-item-skeleton";
import { AppSidebarTreeActions } from "./app-sidebar-tree-actions";

type AppSidebarPagesProps = {
  defaultOpen?: boolean;
};

type SidebarTreeProps = {
  parentFolderId: string | null;
};

const DEFAULT_TREE_ITEM_CLASSNAME =
  "ml-3.5 border-sidebar-border border-l py-0.5 ps-2.5";
const INFINITE_SCROLL_ROOT_MARGIN = "120px 0px";

function AppSidebarFolderItem({ folder }: { folder: Folder }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);
  const folderHref = `/pages/folders/${folder.id}`;
  const isActive = pathname === folderHref;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/folder-collapsible"
    >
      <SidebarMenuSubItem
        key={folder.id}
        className={cn(
          "group/folder-item group/tree-row",
          isActive && "border-sidebar-primary",
          DEFAULT_TREE_ITEM_CLASSNAME,
        )}
      >
        <div className="group/folder-navigation relative flex min-w-0 items-center gap-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-5 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
            >
              <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/folder-collapsible:rotate-90" />
            </button>
          </CollapsibleTrigger>

          <SidebarMenuSubButton
            asChild
            isActive={isActive}
            className="w-full pr-8"
          >
            <Link
              href={folderHref}
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              className="flex w-full min-w-0 items-center gap-2"
            >
              <FolderIcon className="size-3.5 shrink-0" />
              <span className="line-clamp-1 min-w-0 flex-1 truncate text-left">
                {folder.name || "New folder"}
              </span>
            </Link>
          </SidebarMenuSubButton>

          <div className="absolute inset-y-0 right-0 flex items-center">
            <AppSidebarTreeActions
              kind="folder"
              folder={folder}
              parentFolderId={folder.id}
              onCreateStart={() => {
                setIsOpen(true);
              }}
              onCreateSuccess={() => {
                setIsOpen(true);
              }}
            />
          </div>
        </div>

        <CollapsibleContent className="pt-1">
          <SidebarMenuSub className="mx-0 mr-0 gap-0 border-none px-0">
            <SidebarTree parentFolderId={folder.id} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarTree({ parentFolderId }: SidebarTreeProps) {
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryOptions = trpc.folders.getTreePaginated.infiniteQueryOptions(
    getInfiniteSidebarTreeQueryOptions(parentFolderId),
  );
  const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      ...queryOptions,
      getNextPageParam: ({ nextCursor }) => {
        return nextCursor;
      },
    });

  const items = data?.pages?.flatMap((page) => page.items) ?? [];

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

  const shouldShowInitialSkeleton = items.length === 0 && status === "pending";

  return (
    <>
      {shouldShowInitialSkeleton ? (
        <AppSidebarPageItemSkeleton className={DEFAULT_TREE_ITEM_CLASSNAME} />
      ) : null}

      {items.map((item) =>
        item.kind === "folder" ? (
          <AppSidebarFolderItem
            key={`folder-${item.folder.id}`}
            folder={item.folder}
          />
        ) : (
          <AppSidebarPageItem
            key={`page-${item.page.id}`}
            page={item.page}
            className={DEFAULT_TREE_ITEM_CLASSNAME}
          />
        ),
      )}

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
  const { state, setOpen } = useSidebar();
  const isPagesRoute = pathname.startsWith("/pages");
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isPagesRoute}
            className={cn(
              "min-h-8 border border-transparent pr-2 text-foreground!",
              isPagesRoute && "border-sidebar-primary/50",
            )}
            tooltip="Pages"
            onClick={handlePagesClick}
          >
            <BookOpen />
            <span>Pages</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <AppSidebarTreeActions
          className="right-8"
          kind="root"
          parentFolderId={null}
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

      <CollapsibleContent className="flex h-full min-h-0 flex-col">
        <SidebarMenuSub className="mx-0 mr-0 flex-1 gap-0 overflow-scroll border-none px-0">
          <SidebarTree parentFolderId={null} />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};
