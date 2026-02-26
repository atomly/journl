"use client";

import type { Folder } from "@acme/db/schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronRight,
  Folder as FolderIcon,
  Loader2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
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
import { getInfiniteFoldersQueryOptions } from "~/trpc/options/folders-query-options";
import { getInfinitePagesQueryOptions } from "~/trpc/options/pages-query-options";
import { useTRPC } from "~/trpc/react";
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { AppSidebarPageItemSkeleton } from "./app-sidebar-page-item-skeleton";
import { CreateFolderButton } from "./create-folder-button";
import { CreatePageButton } from "./create-page-button";
import {
  DeleteFolderButton,
  DeleteFolderDialog,
  DeleteFolderDialogTrigger,
} from "./delete-folder-button";

type AppSidebarPagesProps = {
  defaultOpen?: boolean;
};

type SidebarTreeProps = {
  parentFolderId: string | null;
};

type SidebarLoadMoreButtonProps = {
  className?: string;
  disabled: boolean;
  isLoading: boolean;
  label: string;
  onClick: () => void;
};

const DEFAULT_TREE_ITEM_CLASSNAME =
  "ml-3.5 border-sidebar-border border-l py-0.5 ps-2.5";

function SidebarLoadMoreButton({
  className,
  disabled,
  isLoading,
  label,
  onClick,
}: SidebarLoadMoreButtonProps) {
  return (
    <SidebarMenuSubItem className={className}>
      <SidebarMenuSubButton asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-1.5 text-xs"
          onClick={onClick}
          disabled={disabled}
        >
          {isLoading ? <Loader2 className="size-3 animate-spin" /> : null}
          <span>{label}</span>
        </Button>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function AppSidebarFolderItem({ folder }: { folder: Folder }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/folder-collapsible"
    >
      <SidebarMenuSubItem
        key={folder.id}
        className={cn("group/folder-item", DEFAULT_TREE_ITEM_CLASSNAME)}
      >
        <DeleteFolderDialog folder={folder}>
          <div className="flex min-w-0 items-center gap-1">
            <CollapsibleTrigger asChild>
              <SidebarMenuSubButton asChild className="flex-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2"
                >
                  <ChevronRight className="size-3 transition-transform duration-200 group-data-[state=open]/folder-collapsible:rotate-90" />
                  <FolderIcon className="size-3.5 shrink-0" />
                  <span className="line-clamp-1 min-w-0 flex-1 truncate text-left">
                    {folder.name || "New folder"}
                  </span>
                </button>
              </SidebarMenuSubButton>
            </CollapsibleTrigger>
            <DeleteFolderDialogTrigger asChild>
              <DeleteFolderButton className="hidden bg-transparent! pr-0! text-destructive! group-hover/folder-item:block" />
            </DeleteFolderDialogTrigger>
          </div>
          <CollapsibleContent className="pt-1">
            <SidebarTree parentFolderId={folder.id} />
          </CollapsibleContent>
        </DeleteFolderDialog>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarTree({ parentFolderId }: SidebarTreeProps) {
  const trpc = useTRPC();
  const foldersQueryOptions = trpc.folders.getPaginated.infiniteQueryOptions(
    getInfiniteFoldersQueryOptions(parentFolderId),
  );
  const pagesQueryOptions = trpc.pages.getPaginated.infiniteQueryOptions(
    getInfinitePagesQueryOptions(parentFolderId),
  );

  const {
    data: foldersData,
    status: foldersStatus,
    fetchNextPage: fetchNextFolderPage,
    hasNextPage: hasNextFolderPage,
    isFetchingNextPage: isFetchingNextFolderPage,
  } = useInfiniteQuery({
    ...foldersQueryOptions,
    getNextPageParam: ({ nextCursor }) => {
      return nextCursor;
    },
  });

  const {
    data: pagesData,
    status: pagesStatus,
    fetchNextPage: fetchNextPagePage,
    hasNextPage: hasNextPagePage,
    isFetchingNextPage: isFetchingNextPagePage,
  } = useInfiniteQuery({
    ...pagesQueryOptions,
    getNextPageParam: ({ nextCursor }) => {
      return nextCursor;
    },
  });

  const folders = foldersData?.pages?.flatMap((page) => page.items) ?? [];
  const pages = pagesData?.pages?.flatMap((page) => page.items) ?? [];
  const shouldShowInitialSkeleton =
    folders.length === 0 &&
    pages.length === 0 &&
    (foldersStatus === "pending" || pagesStatus === "pending");

  return (
    <>
      <CreateFolderButton
        parentFolderId={parentFolderId}
        className={cn(DEFAULT_TREE_ITEM_CLASSNAME, "py-2")}
      />
      <CreatePageButton
        folderId={parentFolderId}
        className={cn(DEFAULT_TREE_ITEM_CLASSNAME, "py-2")}
      />

      {shouldShowInitialSkeleton ? (
        <AppSidebarPageItemSkeleton className={DEFAULT_TREE_ITEM_CLASSNAME} />
      ) : null}

      {folders.map((folder) => (
        <AppSidebarFolderItem key={folder.id} folder={folder} />
      ))}

      {hasNextFolderPage ? (
        <SidebarLoadMoreButton
          className={DEFAULT_TREE_ITEM_CLASSNAME}
          disabled={isFetchingNextFolderPage}
          isLoading={isFetchingNextFolderPage}
          label="Load more folders"
          onClick={() => {
            void fetchNextFolderPage();
          }}
        />
      ) : null}

      {pages.map((page) => (
        <AppSidebarPageItem
          key={page.id}
          page={page}
          className={DEFAULT_TREE_ITEM_CLASSNAME}
        />
      ))}

      {hasNextPagePage ? (
        <SidebarLoadMoreButton
          className={DEFAULT_TREE_ITEM_CLASSNAME}
          disabled={isFetchingNextPagePage}
          isLoading={isFetchingNextPagePage}
          label="Load more pages"
          onClick={() => {
            void fetchNextPagePage();
          }}
        />
      ) : null}
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
      <CollapsibleTrigger asChild>
        <SidebarMenuButton
          isActive={isPagesRoute}
          className={cn(
            "min-h-8 border border-transparent text-foreground!",
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

      <CollapsibleContent className="flex h-full min-h-0 flex-col">
        <SidebarMenuSub className="mx-0 mr-0 flex-1 gap-0 overflow-scroll border-none px-0">
          <SidebarTree parentFolderId={null} />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};
