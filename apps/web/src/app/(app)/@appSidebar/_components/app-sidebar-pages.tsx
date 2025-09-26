"use client";

import type { Page } from "@acme/db/schema";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { List } from "react-window";
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
import { PAGES_INFINITE_QUERY_CONFIG } from "~/lib/pages-config";
import { useTRPC } from "~/trpc/react";
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { CreatePageButton } from "./create-page-button";

type AppSidebarPagesProps = {
  initialPagesData: {
    items: Page[];
    nextCursor: string | undefined;
  };
  defaultOpen?: boolean;
};

export const AppSidebarPages = ({
  initialPagesData,
  defaultOpen = true,
}: AppSidebarPagesProps) => {
  const trpc = useTRPC();
  const { state, setOpen } = useSidebar();

  const { data, fetchNextPage, isFetchingNextPage, hasNextPage } =
    useInfiniteQuery({
      ...trpc.pages.getInfinite.infiniteQueryOptions(
        PAGES_INFINITE_QUERY_CONFIG,
      ),
      getNextPageParam: ({ nextCursor }) => {
        return nextCursor;
      },
      initialData: {
        pageParams: [null], // null represents "no cursor" for the first page
        pages: [initialPagesData],
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
          className="min-h-8"
          tooltip="Pages"
          onClick={handlePagesClick}
        >
          {isFetchingNextPage ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <BookOpen />
          )}
          <span>Pages</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </SidebarMenuButton>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex min-h-0 flex-col">
        <SidebarMenuSub className="mr-0 flex-1 overflow-scroll pr-0">
          <CreatePageButton />
          <List
            rowComponent={PageRow}
            rowCount={pages.length}
            rowHeight={28}
            // @ts-expect-error - react-window types are incorrectly expecting index/style in rowProps
            rowProps={{
              pages,
            }}
            onRowsRendered={({ stopIndex }) => {
              // Fetch next page when user scrolls near the end
              if (
                stopIndex >= pages.length - 5 &&
                !isFetchingNextPage &&
                hasNextPage
              ) {
                fetchNextPage();
              }
            }}
          />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};

const PageRow = ({
  index,
  style,
  pages,
}: {
  index: number;
  style: React.CSSProperties;
} & { pages: Page[] }) => {
  const page = pages?.[index];
  if (!page) return null;
  return (
    <div style={style}>
      <AppSidebarPageItem page={page} />
    </div>
  );
};
