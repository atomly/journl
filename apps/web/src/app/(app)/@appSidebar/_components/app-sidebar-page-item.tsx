"use client";

import type { Page } from "@acme/db/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  SwipeAction,
  SwipeActionContent,
  SwipeActionReveal,
} from "~/components/ui/swipe-action";
import { cn } from "~/lib/cn";
import {
  DeletePageButton,
  DeletePageDialog,
  DeletePageDialogTrigger,
} from "./delete-page-button";

type AppSidebarPageItemProps = {
  page: Page;
  className?: string;
};

export function AppSidebarPageItem({
  page,
  className,
}: AppSidebarPageItemProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const isActive = pathname.includes(page?.id ?? "");
  const handlePageNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuSubItem
      key={page?.id}
      className={cn(
        "border-sidebar-border border-l",
        isActive && "border-sidebar-primary",
        className,
      )}
    >
      <DeletePageDialog
        page={page}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <SwipeAction
          className="rounded-md md:hidden"
          onFullSwipe={() => {
            setIsDeleteDialogOpen(true);
          }}
        >
          <SwipeActionReveal className="-ml-px">
            <DeletePageDialogTrigger asChild>
              <DeletePageButton
                variant="destructive"
                className="h-7 w-full rounded-none px-3 text-xs"
              >
                Delete
              </DeletePageButton>
            </DeletePageDialogTrigger>
          </SwipeActionReveal>
          <SwipeActionContent className="group/swipe-content rounded-md">
            <SidebarMenuSubButton
              asChild
              isActive={isActive}
              className="group-data-[state=open]/swipe-content:rounded-r-none"
            >
              <Link
                href={`/pages/${page?.id}`}
                onClick={handlePageNavigationClick}
                className="line-clamp-1 min-w-0 flex-1 truncate hover:underline"
              >
                {page?.title || "New page"}
              </Link>
            </SidebarMenuSubButton>
          </SwipeActionContent>
        </SwipeAction>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <div className="group/page-item hidden items-center justify-between md:flex">
            <Link
              href={`/pages/${page?.id}`}
              onClick={handlePageNavigationClick}
              className="line-clamp-1 min-w-0 flex-1 truncate hover:underline"
            >
              {page?.title || "New page"}
            </Link>
            {!!page && (
              <DeletePageDialogTrigger asChild>
                <DeletePageButton className="pointer-events-none invisible bg-transparent! pr-0! text-destructive! opacity-0 transition-opacity group-focus-within/page-item:pointer-events-auto group-focus-within/page-item:visible group-focus-within/page-item:opacity-100 group-hover/page-item:pointer-events-auto group-hover/page-item:visible group-hover/page-item:opacity-100" />
              </DeletePageDialogTrigger>
            )}
          </div>
        </SidebarMenuSubButton>
      </DeletePageDialog>
    </SidebarMenuSubItem>
  );
}
