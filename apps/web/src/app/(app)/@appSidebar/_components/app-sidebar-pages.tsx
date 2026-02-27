"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuSub,
  useSidebar,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/cn";
import type { PaginatedPagesInput } from "~/trpc";
import { useTRPC } from "~/trpc/react";
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { AppSidebarPageItemSkeleton } from "./app-sidebar-page-item-skeleton";
import { CreatePageButton } from "./create-page-button";

type AppSidebarPagesProps = {
  infinitePagesQueryOptions: PaginatedPagesInput;
  defaultOpen?: boolean;
};

const APPROXIMATE_ITEM_HEIGHT = 28;
const VIEWPORT_INCREASE_FACTOR = 5;

export const AppSidebarPages = ({
  infinitePagesQueryOptions,
  defaultOpen = true,
}: AppSidebarPagesProps) => {
  const trpc = useTRPC();
  const pathname = usePathname();
  const { state, setOpen } = useSidebar();
  const isPagesRoute = pathname.startsWith("/pages");
  const queryOptions = trpc.pages.getPaginated.infiniteQueryOptions(
    infinitePagesQueryOptions,
  );
  const {
    status,
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    ...queryOptions,
    getNextPageParam: ({ nextCursor }) => {
      return nextCursor;
    },
  });

  const pages = data?.pages?.flatMap((page) => page.items) ?? [];

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
          {isLoading || isFetchingNextPage ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <BookOpen />
          )}
          <span>Pages</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </SidebarMenuButton>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex h-full min-h-0 flex-col">
        <SidebarMenuSub className="mx-0 mr-0 flex-1 gap-0 overflow-scroll border-none px-0">
          <CreatePageButton className="ml-3.5 border-sidebar-border border-l py-2 ps-2.5" />
          <Virtuoso
            className="h-full w-full"
            data={pages}
            increaseViewportBy={
              APPROXIMATE_ITEM_HEIGHT * VIEWPORT_INCREASE_FACTOR
            }
            itemContent={(_, page) => (
              <AppSidebarPageItem
                page={page}
                className="ml-3.5 py-0.5 ps-2.5"
              />
            )}
            endReached={() => {
              if (status === "success" && hasNextPage) {
                fetchNextPage();
              }
            }}
            rangeChanged={(range) => {
              if (
                status === "success" &&
                hasNextPage &&
                isOpen &&
                range?.startIndex === 0 &&
                range?.endIndex >= pages.length - 1 &&
                pages.length > 0
              ) {
                fetchNextPage();
              }
            }}
            components={{
              Footer: () =>
                isFetchingNextPage ? (
                  <AppSidebarPageItemSkeleton className="ml-3.5 border-sidebar-border border-l ps-2.5" />
                ) : null,
            }}
          />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};
